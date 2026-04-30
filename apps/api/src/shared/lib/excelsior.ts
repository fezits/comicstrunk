/**
 * Cliente fino do Excelsior Comic Shop (https://excelsiorcomics.com.br) para
 * busca live. Site WordPress + WooCommerce: SSR funciona com plain fetch.
 *
 * Endpoint de busca: GET /?s={query} — devolve HTML com cards de produto que
 * incluem nome, link e thumbnail. URL da imagem segue padrao do WP Media:
 *   .../uploads/YYYY/MM/{slug}-{W}x{H}.jpeg     (thumbnail)
 *   .../uploads/YYYY/MM/{slug}.jpeg             (full size)
 *
 * Politica de boa cidadania:
 * - User-Agent Chrome moderno + Accept-Language pt-BR
 * - Throttle 500ms entre chamadas
 * - Cache LRU em memoria (TTL 1h, max 500 entries)
 * - Fail open: erro/captcha -> []
 * - Circuit breaker (3 falhas seguidas -> abre por 5min)
 *
 * Cobertura: HQs brasileiras vintage (Ebal, RGE, etc) e atuais (Panini,
 * Mythos), tambem mangas. Especialmente util para o longa-cauda BR que nao
 * cai em Amazon BR / Rika.
 */

import { setTimeout as sleep } from 'timers/promises';
import { withCircuitBreaker } from './circuit-breaker';

const SEARCH_URL = 'https://excelsiorcomics.com.br/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_DELAY_MS = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 12_000;

export interface ExcelsiorProductSummary {
  slug: string; // identificador do produto (segmento de URL apos /produto/)
  title: string;
  image: string | null; // URL full-size ja transformada
  link: string;
  publisher: string | null;
}

const cache = new Map<string, { value: ExcelsiorProductSummary[]; expiresAt: number }>();

function cacheGet(key: string): ExcelsiorProductSummary[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: ExcelsiorProductSummary[]): void {
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
 * Busca produtos no Excelsior Comic Shop via WordPress search (?s=query).
 * Filtra produtos cujo link comece com /produto/ (WooCommerce).
 */
export async function searchExcelsior(
  query: string,
  opts: { limit?: number } = {},
): Promise<ExcelsiorProductSummary[]> {
  const limit = opts.limit ?? 5;
  const cacheKey = `q=${query}&l=${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await withCircuitBreaker(
    'excelsior',
    async () => {
      await throttle();

      const params = new URLSearchParams({ s: query });
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
        throw new Error(`Excelsior HTTP ${res.status}`);
      }
      const html = await res.text();

      // Sinal basico de bloqueio/captcha. Se aparecer, conta como falha.
      if (html.length < 3000) {
        throw new Error('Excelsior response too small (possible block)');
      }

      const products = parseExcelsiorSearch(html, limit);
      cacheSet(cacheKey, products);
      return products;
    },
    { fallback: [], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Parse defensivo do HTML da pagina de busca.
 *
 * Cards seguem padrao:
 *   <img src='.../uploads/YYYY/MM/{slug}-WxH.jpeg' ... />
 *   <h3 class="name product-title">
 *     <a href="https://excelsiorcomics.com.br/produto/{slug}/" class="product-link">
 *       <span>Titulo</span>
 *     </a>
 *   </h3>
 *
 * Estrategia: encontrar TODOS os anchors que apontam pra /produto/, e para
 * cada um, varrer o HTML antes em busca da imagem mais proxima (a thumbnail
 * do mesmo card). Robusto a mudancas de class names.
 */
function parseExcelsiorSearch(html: string, limit: number): ExcelsiorProductSummary[] {
  const out: ExcelsiorProductSummary[] = [];
  const seenSlugs = new Set<string>();

  // Anchors de produto: <a href="https://excelsiorcomics.com.br/produto/SLUG/" class="product-link"...>
  const ANCHOR_RE = /<a\s+href="https:\/\/excelsiorcomics\.com\.br\/produto\/([^"/]+)\/"\s+class="product-link"[^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = ANCHOR_RE.exec(html)) !== null && out.length < limit) {
    const slug = am[1];
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const innerHtml = am[2];
    // Title em <span>...</span> dentro do anchor
    const titleMatch = innerHtml.match(/<span[^>]*>([^<]+)<\/span>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : '';
    if (!title) continue;

    // Imagem: precisamos varrer o HTML ANTES do anchor pra achar a img.src
    // do mesmo card. Pegamos a janela de 4KB antes do anchor.
    const anchorStart = am.index;
    const window = html.slice(Math.max(0, anchorStart - 4000), anchorStart);
    const imgMatch = window.match(
      /<img[^>]+src=['"](https:\/\/excelsiorcomics\.com\.br\/loja\/wp-content\/uploads\/[^'"]+\.(?:jpe?g|png|webp))['"][^>]*>(?![\s\S]*<img)/i,
    );
    let image: string | null = null;
    if (imgMatch) {
      // Transformar thumbnail (-WxH) pra full size: troca "-NxN.jpeg" por ".jpeg"
      image = imgMatch[1].replace(/-\d+x\d+(\.(?:jpe?g|png|webp))$/i, '$1');
    }

    const link = `https://excelsiorcomics.com.br/produto/${slug}/`;
    const publisher = inferPublisher(title);

    out.push({ slug, title, image, link, publisher });
  }

  return out;
}

function inferPublisher(title: string): string | null {
  const KNOWN = [
    'panini',
    'mythos',
    'jbc',
    'devir',
    'newpop',
    'pixel',
    'darkside',
    'figura',
    'todavia',
    'ebal',
    'rge',
    'vecchi',
    'abril',
    'globo',
    'taika',
    'grafipar',
    'noblet',
  ];
  const lower = title.toLowerCase();
  for (const p of KNOWN) {
    if (lower.includes(p)) return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return null;
}

function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
