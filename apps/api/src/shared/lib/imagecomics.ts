/**
 * Cliente Image Comics (https://imagecomics.com).
 *
 * Site oficial. SSR completo: paginas listam issues com cover URL inline
 * (cdn.imagecomics.com/...). Nao tem API publica documentada — scraping
 * direto via fetch + regex.
 *
 * Estrutura:
 *   /comics/series/{slug}              -> pagina da serie (snapshot recente)
 *   /comics/list/series/{slug}/releases       -> archive p1 (24 issues)
 *   /comics/list/series/{slug}/releases/p2    -> archive p2
 *   /comics/list/series/{slug}/releases/p3    -> ...
 *   /comics/releases/{slug}-{N}        -> pagina individual de issue
 *
 * Politica de boa cidadania:
 * - User-Agent Chrome moderno + Accept-Language en-US
 * - Throttle 500ms entre chamadas
 * - Cache LRU (TTL 1h, 500 entries)
 * - Circuit breaker (3 falhas seguidas -> 5min)
 * - Fail open
 */

import { setTimeout as sleep } from 'timers/promises';
import { withCircuitBreaker } from './circuit-breaker';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_DELAY_MS = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_PAGES = 20; // limite de seguranca: 20 paginas x 24 = 480 issues

export interface ImageComicsIssueRef {
  issueNumber: number;
  title: string; // "Birthright #50"
  releaseSlug: string; // "birthright-50"
  coverUrl: string | null;
  url: string;
}

const cache = new Map<string, { value: ImageComicsIssueRef[]; expiresAt: number }>();

function cacheGet(key: string): ImageComicsIssueRef[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: ImageComicsIssueRef[]): void {
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
 * Parse de URL Image Comics de pagina de SERIE.
 *
 * Aceita:
 *   https://imagecomics.com/comics/series/birthright       -> "birthright"
 *   https://imagecomics.com/comics/list/series/birthright/releases -> "birthright"
 *   birthright (slug puro)                                 -> "birthright"
 */
export function parseImageComicsSeriesUrl(rawUrlOrSlug: string): { slug: string } | null {
  const trimmed = rawUrlOrSlug.trim();
  if (!trimmed) return null;
  // Slug puro (sem /, sem :)
  if (!trimmed.includes('/') && !trimmed.includes(':')) {
    return { slug: trimmed.toLowerCase() };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith('imagecomics.com')) return null;
  const m = parsed.pathname.match(/\/comics\/(?:list\/)?series\/([^/]+)/);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).trim().toLowerCase();
  if (!slug) return null;
  return { slug };
}

/**
 * Lista todos os issues de uma serie no Image Comics, paginando ate esgotar.
 *
 * Retorna [{ issueNumber, title, releaseSlug, coverUrl, url }] ordenado por
 * numero crescente. Inclui apenas issues "single" (slug formato `<series>-{N}`),
 * exclui collected editions e variants nominados.
 */
export async function listImageComicsSeriesIssues(
  seriesSlug: string,
): Promise<ImageComicsIssueRef[]> {
  const cacheKey = `series:${seriesSlug}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  return await withCircuitBreaker(
    'imagecomics',
    async () => {
      const all: ImageComicsIssueRef[] = [];
      const seenSlugs = new Set<string>();
      let lastPageSlugCount = -1;

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        await throttle();
        const path =
          pageNum === 1
            ? `/comics/list/series/${seriesSlug}/releases`
            : `/comics/list/series/${seriesSlug}/releases/p${pageNum}`;
        const url = `https://imagecomics.com${path}`;

        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
          // Se primeira pagina falhar, e erro real. Se subsequente, considera fim.
          if (pageNum === 1) throw new Error(`Image Comics archive HTTP ${res.status}`);
          break;
        }
        const html = await res.text();

        const issues = parseImageArchivePage(html, seriesSlug);
        const newOnes = issues.filter((i) => !seenSlugs.has(i.releaseSlug));
        for (const i of newOnes) {
          seenSlugs.add(i.releaseSlug);
          all.push(i);
        }

        // Detectar fim: pagina retorna zero novos OU mesmo conjunto de slugs
        // (defesa contra paginacao infinita que volta loop).
        if (newOnes.length === 0) break;
        if (issues.length === lastPageSlugCount && newOnes.length < issues.length / 2) break;
        lastPageSlugCount = issues.length;
      }

      all.sort((a, b) => a.issueNumber - b.issueNumber);
      cacheSet(cacheKey, all);
      return all;
    },
    { fallback: [] as ImageComicsIssueRef[], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Parse defensivo do HTML de uma pagina de archive Image Comics. Cards seguem
 * padrao:
 *   <a href="https://imagecomics.com/comics/releases/{slug}-{N}" class="cover-image ...">
 *     <img src="https://cdn.imagecomics.com/.../{slug}-{N}_<hash>.jpg" alt="..." ...>
 *   </a>
 *   <a href="...">
 *     <span class="u-mb0_5">{Series} #{N}</span>
 *   </a>
 *
 * Localizamos cada anchor com class "cover-image" e extraimos: slug do href,
 * imageUrl da img filho, title da span do anchor IRMAO seguinte.
 */
function parseImageArchivePage(html: string, seriesSlug: string): ImageComicsIssueRef[] {
  const out: ImageComicsIssueRef[] = [];
  // Anchors com class cover-image E href apontando pra release de issue do mesmo slug.
  const escapedSlug = seriesSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const cardRe = new RegExp(
    `<a\\s+href="https://imagecomics\\.com/comics/releases/(${escapedSlug}-(\\d+))"\\s+class="cover-image[^"]*">\\s*<img\\s+src="([^"]+)"\\s+alt="([^"]*)"`,
    'gi',
  );

  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const releaseSlug = m[1];
    const issueNumber = parseInt(m[2], 10);
    const coverUrl = m[3];
    const altText = m[4];
    if (!Number.isFinite(issueNumber) || issueNumber < 0 || issueNumber > 99999) continue;
    // alt text geralmente eh "Birthright #50 cover"; tira o " cover" final.
    const title = altText.replace(/\s+cover$/i, '').trim() || `${releaseSlug}`;
    out.push({
      issueNumber,
      title,
      releaseSlug,
      coverUrl,
      url: `https://imagecomics.com/comics/releases/${releaseSlug}`,
    });
  }

  return out;
}

/**
 * Heuristica pra extrair o slug Image Comics do title do entry.
 *
 * Estrategia: pega tudo antes do primeiro indicador de numero (#, "vol",
 * "n.", "no"). Lowercase, transforma espacos em hifen, remove caracteres
 * nao-ASCII.
 *
 * Ex:
 *   "Birthright #9"        -> "birthright"
 *   "The Walking Dead #100"-> "the-walking-dead"
 *   "Saga Vol 1 #5"        -> "saga"
 *   "Invincible #1"        -> "invincible"
 *
 * Pode produzir slug invalido — chamador deve tolerar 404.
 */
export function inferImageSeriesSlug(title: string): string | null {
  if (!title) return null;
  const cut = title.split(/\s+(?:vol\.?|#|n[oº]\.?|edi)/i)[0]?.trim();
  if (!cut) return null;
  const slug = cut
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || null;
}

/**
 * Busca o cover de UM issue especifico via URL direta. Util na cascata —
 * 1 fetch barato em vez de listar serie inteira.
 *
 * Retorna null em 404 (slug ou numero errado), erros de rede, ou pagina
 * sem capa identificavel.
 */
export async function getImageComicsRelease(
  seriesSlug: string,
  issueNumber: number,
): Promise<ImageComicsIssueRef | null> {
  if (!seriesSlug || !Number.isFinite(issueNumber) || issueNumber < 0) return null;
  const releaseSlug = `${seriesSlug}-${issueNumber}`;
  const cacheKey = `release:${releaseSlug}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached[0] ?? null;

  return await withCircuitBreaker(
    'imagecomics',
    async () => {
      await throttle();
      const url = `https://imagecomics.com/comics/releases/${releaseSlug}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        // 404 eh esperado pra slug/numero invalido — nao deve abrir circuito.
        if (res.status === 404) return null;
        throw new Error(`Image Comics release HTTP ${res.status}`);
      }
      const html = await res.text();

      // Capa: <img src="https://cdn.imagecomics.com/assets/i/releases/.../{slug}_<hash>.jpg">
      const imgMatch = html.match(
        /<img[^>]+src="(https:\/\/cdn\.imagecomics\.com\/assets\/i\/releases\/[^"]+\.(?:jpg|jpeg|png|webp))"/i,
      );
      const coverUrl = imgMatch ? imgMatch[1] : null;

      // Title: <title>Birthright #50 | Image Comics</title>
      const titleMatch = html.match(/<title>([^<]+?)\s*\|\s*Image\s+Comics/i);
      const title = titleMatch ? titleMatch[1].trim() : `${seriesSlug} #${issueNumber}`;

      const ref: ImageComicsIssueRef = {
        issueNumber,
        title,
        releaseSlug,
        coverUrl,
        url,
      };
      cacheSet(cacheKey, [ref]);
      return ref;
    },
    { fallback: null as ImageComicsIssueRef | null, failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Busca textual em Image Comics. Implementacao oportunista: infere slug do
 * query (assumindo formato "<Series> #N"), faz fetch direto da pagina do
 * issue. Se acertar, retorna 1 candidato; senao [].
 */
export async function searchImageComics(
  query: string,
  opts: { editionNumber?: number } = {},
): Promise<ImageComicsIssueRef[]> {
  const slug = inferImageSeriesSlug(query);
  if (!slug) return [];
  // Tenta extrair numero do query se nao foi passado
  let issueNumber = opts.editionNumber;
  if (issueNumber === undefined) {
    const m = query.match(/#\s*(\d+)/);
    if (m) issueNumber = parseInt(m[1], 10);
  }
  if (issueNumber === undefined || !Number.isFinite(issueNumber)) return [];

  const ref = await getImageComicsRelease(slug, issueNumber);
  if (!ref || !ref.coverUrl) return [];
  return [ref];
}
