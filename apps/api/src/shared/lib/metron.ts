/**
 * Cliente fino do MetronDB (https://metron.cloud).
 *
 * - HTTP Basic Auth (METRON_USERNAME / METRON_PASSWORD)
 * - Rate limit: 20/min burst, 5000/dia sustained. Headers expostos pelo
 *   servidor: X-RateLimit-Burst-Remaining e X-RateLimit-Sustained-Remaining.
 * - Cache LRU em memoria (TTL 1h, max 500 entries) para reduzir chamadas
 *   repetidas em buscas iguais.
 * - User-Agent identificado: ComicsTrunk/1.0 (cover-scan)
 *
 * IMPORTANTE: Atribuicao CC BY-SA 4.0 dos dados eh obrigatoria — frontend
 * mostra "Powered by Metron" discreto na pagina /scan-capa.
 */

import { withCircuitBreaker } from './circuit-breaker';

const API_BASE = 'https://metron.cloud/api';
const USER_AGENT = 'ComicsTrunk/1.0 (cover-scan; +https://comicstrunk.com)';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CACHE_MAX_ENTRIES = 500;

export interface MetronIssueSummary {
  id: number;
  series: { name: string; volume: number; year_began: number };
  number: string;
  issue: string; // "Absolute Batman (2024) #2"
  cover_date: string | null;
  store_date: string | null;
  image: string;
}

export interface MetronIssueDetail extends MetronIssueSummary {
  description?: string;
  characters?: Array<{ name: string }>;
  credits?: Array<{ creator: string; role: Array<{ name: string }> }>;
  isbn?: string;
  upc?: string;
}

interface MetronListResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// === Cache em memoria ===

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// === Rate limit guard (preventivo) ===

let lastBurstRemaining = 20;
let lastSustainedRemaining = 5000;

function rateLimitOk(): boolean {
  return lastBurstRemaining > 2 && lastSustainedRemaining > 50;
}

// === Core fetch helper ===

async function metronFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const username = process.env.METRON_USERNAME;
  const password = process.env.METRON_PASSWORD;
  if (!username || !password) {
    return null; // sem credenciais, ignore silenciosamente
  }

  if (!rateLimitOk()) {
    return null; // protecao preventiva — nao estourar limite
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const cacheKey = url.toString();
  const cached = cacheGet<T>(cacheKey);
  if (cached) return cached;

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  return await withCircuitBreaker(
    'metron',
    async () => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(10000),
      });

      // Atualizar contadores de rate limit (mesmo em erro o header pode vir)
      const burstHeader = res.headers.get('X-RateLimit-Burst-Remaining');
      const sustainedHeader = res.headers.get('X-RateLimit-Sustained-Remaining');
      if (burstHeader) lastBurstRemaining = parseInt(burstHeader, 10);
      if (sustainedHeader) lastSustainedRemaining = parseInt(sustainedHeader, 10);

      if (!res.ok) throw new Error(`Metron HTTP ${res.status}`);

      const data = (await res.json().catch(() => null)) as T | null;
      if (data) cacheSet(cacheKey, data);
      return data;
    },
    { fallback: null as T | null, failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

// === API publica ===

/**
 * Busca issues por nome da serie (e numero opcional).
 */
export async function searchMetronIssues(opts: {
  seriesName: string;
  number?: number;
}): Promise<MetronIssueSummary[]> {
  const params: Record<string, string> = {
    series_name: opts.seriesName,
    page_size: '8',
  };
  if (opts.number !== undefined) params.number = String(opts.number);

  const result = await metronFetch<MetronListResponse<MetronIssueSummary>>('/issue/', params);
  return result?.results ?? [];
}

/**
 * Detalhes de um issue especifico (capa hi-res, creditos, isbn, etc).
 */
export async function getMetronIssue(id: number): Promise<MetronIssueDetail | null> {
  return await metronFetch<MetronIssueDetail>(`/issue/${id}/`);
}

/**
 * Status do rate limit (para debugging/logging).
 */
export function getMetronRateStatus(): { burst: number; sustained: number } {
  return { burst: lastBurstRemaining, sustained: lastSustainedRemaining };
}
