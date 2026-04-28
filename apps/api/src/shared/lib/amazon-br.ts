/**
 * Cliente fino do Amazon Brasil (https://www.amazon.com.br) para busca live.
 *
 * Sem API oficial (Amazon Associates PA-API exige aprovacao). Fetch direto do
 * HTML da pagina de busca + parsing por regex. Validado em 2026-04-27 retornando
 * 12+ produtos sem captcha com User-Agent Chrome realista.
 *
 * Politica de boa cidadania:
 * - User-Agent Chrome moderno + Accept-Language pt-BR
 * - Throttle 500ms entre chamadas (rate limit suave)
 * - Cache em memoria (TTL 1h, max 500 entries) — drasticamente reduz volume
 * - Fail open: erro/captcha -> retorna []
 *
 * Risco conhecido: Amazon eventualmente pode bloquear IP em volume alto. O
 * fail open garante que o resto do sistema continua funcionando.
 */

import { setTimeout as sleep } from 'timers/promises';

const SEARCH_URL = 'https://www.amazon.com.br/s';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_DELAY_MS = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 12_000;

export interface AmazonBRProductSummary {
  asin: string;
  title: string;
  image: string | null;
  link: string;
  author: string | null;
  publisher: string | null;
}

const cache = new Map<string, { value: AmazonBRProductSummary[]; expiresAt: number }>();

function cacheGet(key: string): AmazonBRProductSummary[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: AmazonBRProductSummary[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  lastCallAt = Date.now();
}

/**
 * Busca produtos no Amazon BR. Filtra para livros/HQs (i=stripbooks).
 */
export async function searchAmazonBR(
  query: string,
  opts: { limit?: number } = {},
): Promise<AmazonBRProductSummary[]> {
  const limit = opts.limit ?? 5;
  const cacheKey = `q=${query}&l=${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  await throttle();

  const params = new URLSearchParams({
    k: query,
    i: 'stripbooks', // Books category — gibis/HQs caem aqui
  });
  const url = `${SEARCH_URL}?${params.toString()}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  // Detecta captcha/bloqueio explicito e fail open
  if (
    html.includes('captcha') ||
    html.includes('Robot Check') ||
    html.includes('automated requests') ||
    html.length < 5000
  ) {
    return [];
  }

  const products = parseAmazonSearch(html, limit);
  cacheSet(cacheKey, products);
  return products;
}

/**
 * Parse defensivo do HTML da pagina de busca da Amazon BR.
 *
 * Cards seguem padrao:
 *   <div data-component-type="s-search-result" data-asin="B0XXXX">
 *     <h2><a href="..."><span>Titulo</span></a></h2>
 *     <img class="s-image" src="..." />
 *     <div class="a-row a-size-base">por Autor</div>
 *   </div>
 *
 * Regex defensiva (HTML pode mudar). Se nao bater, retorna [] e o caller
 * continua sem reclamar.
 */
function parseAmazonSearch(html: string, limit: number): AmazonBRProductSummary[] {
  const products: AmazonBRProductSummary[] = [];

  // 1) Quebra o HTML em cards de search-result usando data-asin como ancora.
  // Essa abordagem eh mais robusta que tentar regex unica enorme.
  const cardRegex = /<div[^>]*data-component-type="s-search-result"[^>]*data-asin="([A-Z0-9]{10,})"[^>]*>([\s\S]*?)(?=<div[^>]*data-component-type="s-search-result"|<\/span><\/div><\/div><\/div><\/span><\/div><\/div><\/div><\/span><\/div>$|$)/gi;

  let match;
  while ((match = cardRegex.exec(html)) !== null && products.length < limit) {
    const [, asin, body] = match;
    const product = parseCard(asin, body);
    if (product) products.push(product);
  }

  return products;
}

function parseCard(asin: string, body: string): AmazonBRProductSummary | null {
  // Title: dentro de <h2> tem <a> e <span> com o texto.
  const titleMatch = body.match(/<h2[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';
  if (!title) return null;

  // Link: href do <a> dentro do <h2>
  const linkMatch = body.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i);
  const linkRaw = linkMatch ? linkMatch[1] : '';
  const link = linkRaw.startsWith('/') ? `https://www.amazon.com.br${linkRaw}` : linkRaw;

  // Imagem: <img class="s-image" src="...">
  const imgMatch = body.match(/<img[^>]+class="[^"]*s-image[^"]*"[^>]+src="([^"]+)"/i);
  const image = imgMatch ? imgMatch[1] : null;

  // Autor: linhas tipo "por Fulano" ou "<span>Fulano</span><span>(Autor)</span>"
  let author: string | null = null;
  const authorMatch1 = body.match(/por\s+<a[^>]*>([^<]+)<\/a>/i);
  if (authorMatch1) author = cleanText(authorMatch1[1]);
  if (!author) {
    const authorMatch2 = body.match(/<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>\(Autor[^)]*\)<\/span>/i);
    if (authorMatch2) author = cleanText(authorMatch2[1]);
  }

  // Publisher: nem sempre disponivel na pagina de busca
  let publisher: string | null = null;
  const knownPublishers = ['panini', 'devir', 'jbc', 'skript', 'pixel', 'darkside', 'newpop', 'figura', 'todavia', 'mythos'];
  const lowerTitle = title.toLowerCase();
  for (const p of knownPublishers) {
    if (lowerTitle.includes(p)) {
      publisher = p.charAt(0).toUpperCase() + p.slice(1);
      break;
    }
  }

  return {
    asin,
    title,
    image,
    link: link || `https://www.amazon.com.br/dp/${asin}`,
    author,
    publisher,
  };
}

function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
