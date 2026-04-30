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
import { withCircuitBreaker } from './circuit-breaker';

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
 *
 * Tentamos no passado restringir via rh=n:7841731011 ("HQs, Mangas e Graphic
 * Novels") mas Amazon ignora o filtro quando combinado com keyword search —
 * volta o mesmo conjunto. Pra evitar resultados nao-HQ ("Flash 100: Quick
 * Fiction"), o admin de gestao de capas ordena a cascata por publisher
 * (US comics passam por Fandom/Metron/eBay antes de cair em Amazon).
 */
export async function searchAmazonBR(
  query: string,
  opts: { limit?: number } = {},
): Promise<AmazonBRProductSummary[]> {
  const limit = opts.limit ?? 5;
  const cacheKey = `q=${query}&l=${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await withCircuitBreaker(
    'amazon-br',
    async () => {
      await throttle();

      const params = new URLSearchParams({
        k: query,
        i: 'stripbooks',
      });
      const url = `${SEARCH_URL}?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        // 4xx/5xx contam como falha pro breaker (Amazon bloqueando IP, p.ex.)
        throw new Error(`Amazon BR HTTP ${res.status}`);
      }
      const html = await res.text();

      // Captcha/bloqueio: tambem conta como falha — se persistir, abrimos circuito.
      if (
        html.includes('captcha') ||
        html.includes('Robot Check') ||
        html.includes('automated requests') ||
        html.length < 5000
      ) {
        throw new Error('Amazon BR captcha/blocked');
      }

      const products = parseAmazonSearch(html, limit);
      cacheSet(cacheKey, products);
      return products;
    },
    { fallback: [], failureThreshold: 3, openMs: 5 * 60_000 },
  );
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

  // Localizar inicio de cada card (independente da ordem dos atributos:
  // Amazon as vezes coloca data-asin antes de data-component-type, e vice-versa).
  const STARTER = /<div\b[^>]*\bdata-component-type="s-search-result"[^>]*>/gi;
  const ASIN_RE = /\bdata-asin="([A-Z0-9]{10,})"/i;

  const starts: { tagStart: number; tagEnd: number; asin: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = STARTER.exec(html)) !== null) {
    const tagStart = m.index;
    const tagEnd = m.index + m[0].length;
    const asinMatch = ASIN_RE.exec(m[0]);
    if (!asinMatch) continue;
    starts.push({ tagStart, tagEnd, asin: asinMatch[1] });
  }

  for (let i = 0; i < starts.length && products.length < limit; i++) {
    const { tagEnd, asin } = starts[i];
    const bodyEnd = i + 1 < starts.length ? starts[i + 1].tagStart : Math.min(html.length, tagEnd + 8000);
    const body = html.slice(tagEnd, bodyEnd);
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
