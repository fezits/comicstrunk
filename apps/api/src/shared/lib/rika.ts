/**
 * Cliente fino do site Rika (https://www.rika.com.br).
 *
 * Sem API oficial; usa o endpoint VTEX catalog_system que e interceptado
 * pelos scrapers existentes em scripts/scrape-rika*.js e explorado
 * diretamente em scripts/fetch-missing-rika-covers.js.
 *
 * Endpoint: GET /api/catalog_system/pub/products/search?fq=ft:{query}&_from=0&_to={n}
 * Resposta: JSON array de produtos VTEX (mesmo formato interceptado pelo Playwright).
 *
 * Politica de boa cidadania:
 * - User-Agent identificado
 * - Throttle entre chamadas (delay minimo 200ms)
 * - Cache LRU em memoria (TTL 1h, max 500 entries)
 * - Fail open: erro ou bloqueio -> retorna []
 */

import { setTimeout as sleep } from 'timers/promises';
import { withCircuitBreaker } from './circuit-breaker';

const USER_AGENT = 'ComicsTrunk/1.0 (cover-scan; +https://comicstrunk.com)';
const REQUEST_DELAY_MS = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const BASE_URL = 'https://www.rika.com.br/api/catalog_system/pub/products/search';

export interface RikaProductSummary {
  id: string;
  title: string;
  image: string | null;
  url: string;
  publisher: string | null;
  editionNumber: number | null;
  price: number | null;
}

// === Cache LRU simples (insertion order) ===
const cache = new Map<string, { value: RikaProductSummary[]; expiresAt: number }>();

function cacheGet(key: string): RikaProductSummary[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Refresh para manter entry "recente" (LRU)
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function cacheSet(key: string, value: RikaProductSummary[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// === Throttle global ===
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
 * Busca produtos no Rika por termo livre.
 *
 * Usa o endpoint VTEX catalog_system que todos os scrapers interceptam:
 * /api/catalog_system/pub/products/search?fq=ft:{query}&_from=0&_to={limit-1}
 *
 * Retorna [] em caso de erro, bloqueio ou ausencia de resultados.
 */
export async function searchRika(
  query: string,
  opts: { limit?: number } = {},
): Promise<RikaProductSummary[]> {
  const limit = opts.limit ?? 8;
  const cacheKey = `q=${query}&l=${limit}`;

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await withCircuitBreaker(
    'rika',
    async () => {
      await throttle();

      // VTEX aceita "ft=<termo>" como full-text search. A forma antiga "fq=ft:<termo>"
      // foi rejeitada com "Invalid Parameter, ft." em 2026-04-28.
      const params = new URLSearchParams({
        ft: query,
        _from: '0',
        _to: String(limit - 1),
        O: 'OrderByScoreDESC',
      });
      const url = `${BASE_URL}?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Rika HTTP ${res.status}`);
      const body = await res.text();

      if (body.includes('Bad Request') || body.includes('Scripts') || body.includes('blocked')) {
        throw new Error('Rika blocked');
      }

      const products = parseRikaResponse(body, limit);
      cacheSet(cacheKey, products);
      return products;
    },
    { fallback: [], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

// === Tipos internos do payload VTEX ===
interface VtexImage {
  imageUrl?: string;
}

interface VtexItem {
  images?: VtexImage[];
}

interface VtexProduct {
  productId?: string | number;
  productName?: string;
  brand?: string;
  link?: string;
  linkText?: string;
  items?: VtexItem[];
}

/**
 * Parseia a resposta do endpoint VTEX.
 *
 * O endpoint retorna um JSON array — mesmo formato interceptado pelo
 * Playwright nos scrapers scrape-rika-search.js / scrape-rika-detail.js.
 *
 * Formato: items[0].images[0].imageUrl.split('?')[0]
 * Placeholder: imageUrl que contem "indisponivel" -> null
 */
function parseRikaResponse(body: string, limit: number): RikaProductSummary[] {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  const products: RikaProductSummary[] = [];

  for (const item of (raw as VtexProduct[]).slice(0, limit)) {
    const product = mapVtexProduct(item);
    if (product) products.push(product);
  }

  return products;
}

function mapVtexProduct(p: VtexProduct): RikaProductSummary | null {
  const id = p.productId ? String(p.productId) : null;
  const title = p.productName ?? '';
  if (!id || !title) return null;

  // Imagem: items[0].images[0].imageUrl sem query string
  // Placeholder "indisponivel" -> null (padrao dos scrapers existentes)
  const rawImageUrl = p.items?.[0]?.images?.[0]?.imageUrl ?? null;
  let image: string | null = null;
  if (rawImageUrl && !rawImageUrl.includes('indisponivel')) {
    const stripped = rawImageUrl.split('?')[0];
    image = stripped.startsWith('//') ? `https:${stripped}` : stripped;
  }

  // URL do produto: /linkText/p ou /link
  let url: string;
  if (p.link) {
    url = p.link.startsWith('http') ? p.link : `https://www.rika.com.br${p.link}`;
  } else if (p.linkText) {
    url = `https://www.rika.com.br/${p.linkText}/p`;
  } else {
    url = `https://www.rika.com.br/produto/${id}/p`;
  }

  return {
    id,
    title: cleanText(title),
    image,
    url,
    publisher: p.brand ? cleanText(p.brand) : detectPublisher(title),
    editionNumber: extractEdition(title),
    price: null,
  };
}

function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Detecta editora pelo titulo quando `brand` nao esta presente.
 * Lista baseada nas editoras vendidas pela Rika (Panini, JBC, Devir, etc.).
 */
function detectPublisher(text: string): string | null {
  const lower = text.toLowerCase();
  const publishers = [
    'panini',
    'devir',
    'jbc',
    'skript',
    'pixel',
    'figura',
    'darkside',
    'todavia',
    'newpop',
    'pipoca',
    'draco',
  ];
  for (const p of publishers) {
    if (lower.includes(p)) return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return null;
}

/**
 * Extrai numero de edicao do titulo.
 * Padrao: #N, nN, vol. N, tomo N, edicao N
 */
function extractEdition(text: string): number | null {
  const match = text.match(/(?:#|n[oº]\.?\s*|vol\.?\s*|tomo\s*|edi[çc][aã]o\s*)(\d{1,4})/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return n > 0 && n < 10000 ? n : null;
}
