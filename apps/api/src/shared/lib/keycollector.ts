/**
 * Cliente Key Collector Comics (https://www.keycollectorcomics.com).
 *
 * Site curado de quadrinhos colecionaveis (Image, Marvel, DC, indies).
 * SSR completo: pagina de serie (/series/{slug},{id}/) lista todos os
 * issues com cover URL inline em image.keycollectorcomics.com/media/<uuid>.
 * Cover serve em qualquer resolucao via query ?height=N.
 *
 * Politica de boa cidadania:
 * - User-Agent Chrome moderno
 * - Throttle 500ms
 * - Cache LRU TTL 1h
 * - Circuit breaker
 * - Fail open
 */

import { setTimeout as sleep } from 'timers/promises';
import { withCircuitBreaker } from './circuit-breaker';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_DELAY_MS = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 15_000;
const COVER_HEIGHT = 600; // overrides ?height=300 do archive thumb

export interface KeyCollectorIssueRef {
  issueNumber: number;
  title: string; // "Elephantmen #1"
  publisher: string | null;
  year: number | null;
  volume: number | null;
  issueSlugWithId: string; // "elephantmen-1-491495,491495"
  url: string;
  coverUrl: string | null;
}

const cache = new Map<string, { value: KeyCollectorIssueRef[]; expiresAt: number }>();

function cacheGet(key: string): KeyCollectorIssueRef[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: KeyCollectorIssueRef[]): void {
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
 * Parse de URL Key Collector de SERIE.
 *
 * Aceita:
 *   https://www.keycollectorcomics.com/series/elephantmen,66932/
 *   https://www.keycollectorcomics.com/series/elephantmen,66932
 *
 * Retorna { slug, id } onde id e o numero unico KCC (necessario porque
 * ha series homonimas).
 */
export function parseKeyCollectorSeriesUrl(
  rawUrl: string,
): { slug: string; id: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith('keycollectorcomics.com')) return null;
  const m = parsed.pathname.match(/^\/series\/([^/,]+),(\d+)\/?$/);
  if (!m) return null;
  return { slug: m[1], id: m[2] };
}

/**
 * Scrapeia pagina de serie KCC e extrai todos os issues. Pagina e SSR
 * completa — uma unica request retorna todos os cards.
 */
export async function listKeyCollectorSeriesIssues(
  slug: string,
  id: string,
): Promise<KeyCollectorIssueRef[]> {
  const cacheKey = `series:${slug},${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await withCircuitBreaker(
    'keycollector',
    async () => {
      await throttle();
      const url = `https://www.keycollectorcomics.com/series/${slug},${id}/`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Key Collector HTTP ${res.status}`);
      const html = await res.text();

      const issues = parseKeyCollectorArchive(html, slug);
      cacheSet(cacheKey, issues);
      return issues;
    },
    { fallback: [] as KeyCollectorIssueRef[], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Parse defensivo do HTML do archive. Cards seguem padrao:
 *   <div class="issue-card ...">
 *     <a href="https://www.keycollectorcomics.com/issue/{slug}-{N}-{id},{id}/">
 *       <h2>{Series} #{N}</h2>
 *     </a>
 *     <span>{Publisher}</span> ... <span>{Year}</span> ... <span>Vol. {V}</span>
 *     <img src="https://image.keycollectorcomics.com/media/<uuid>.jpg?height=300">
 *
 * Estrategia: encontrar cada anchor de issue (regex robusto contra HTML
 * verboso), depois caminhar no HTML antes/depois pra extrair year/cover.
 */
function parseKeyCollectorArchive(html: string, seriesSlug: string): KeyCollectorIssueRef[] {
  const out: KeyCollectorIssueRef[] = [];
  const seen = new Set<string>();
  const escapedSlug = seriesSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  // Anchor pra issue: href=".../issue/{slug}-{N}-{numericId},{numericId}/"
  // O slug aqui pode incluir variantes (ex: "elephantmen-1", "elephantmen-1b").
  const anchorRe = new RegExp(
    `<a[^>]+href="https://www\\.keycollectorcomics\\.com/issue/(${escapedSlug}-([\\d]+)(?:-?[a-z]*)-(\\d+)),(\\d+)/"[^>]*>\\s*<h2[^>]*>\\s*([^<]+?)\\s*</h2>`,
    'gi',
  );

  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const issueSlugWithId = `${m[1]},${m[4]}`;
    if (seen.has(issueSlugWithId)) continue;
    seen.add(issueSlugWithId);

    const issueNumber = parseInt(m[2], 10);
    const title = m[5].trim();
    if (!Number.isFinite(issueNumber) || issueNumber < 0 || issueNumber > 99999) continue;

    // Procura janela de 4KB depois do anchor pra extrair year/publisher/cover.
    const anchorEnd = m.index + m[0].length;
    const window = html.slice(anchorEnd, anchorEnd + 4000);

    // Publisher: <span>Image</span>
    let publisher: string | null = null;
    const pubMatch = window.match(/<span>([A-Z][a-zA-Z .&-]{2,30})<\/span>/);
    if (pubMatch) publisher = pubMatch[1].trim();

    // Year: <span>2006</span>
    let year: number | null = null;
    const yearMatch = window.match(/<span>(19\d{2}|20\d{2})<\/span>/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    // Volume: <span class="italic">Vol. 1</span>
    let volume: number | null = null;
    const volMatch = window.match(/<span class="italic">Vol\.\s*(\d+)<\/span>/i);
    if (volMatch) volume = parseInt(volMatch[1], 10);

    // Cover: src="https://image.keycollectorcomics.com/media/<uuid>.jpg?height=N"
    let coverUrl: string | null = null;
    const imgMatch = window.match(
      /src="(https:\/\/image\.keycollectorcomics\.com\/media\/[a-f0-9-]+\.(?:jpg|jpeg|png|webp))(?:\?height=\d+)?"/i,
    );
    if (imgMatch) coverUrl = `${imgMatch[1]}?height=${COVER_HEIGHT}`;

    out.push({
      issueNumber,
      title,
      publisher,
      year,
      volume,
      issueSlugWithId,
      url: `https://www.keycollectorcomics.com/issue/${issueSlugWithId}/`,
      coverUrl,
    });
  }

  // Ordenar por issue number crescente
  out.sort((a, b) => a.issueNumber - b.issueNumber);
  return out;
}
