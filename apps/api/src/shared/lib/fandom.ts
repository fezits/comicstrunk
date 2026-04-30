/**
 * Cliente Fandom (MediaWiki) para busca de gibis.
 *
 * Usa o endpoint MediaWiki API publico de cada wiki — sem auth, sem rate
 * limit oficial divulgado. Conteudo eh CC BY-SA 3.0; atribuicao "Powered
 * by Fandom" eh exibida na pagina /scan-capa.
 *
 * Estrategia: para cada wiki configurada, faz UMA chamada combinando
 * busca + thumbnail (generator=search + prop=pageimages). Resultados das
 * wikis sao concatenados e ordenados pelo ranking interno do MediaWiki.
 *
 * Capas vem do CDN da Wikia (static.wikia.nocookie.net) — mesmo padrao
 * que ja migramos pro R2 via upload-gcd-covers-to-r2.ts.
 */

import { withCircuitBreaker } from './circuit-breaker';

const USER_AGENT = 'ComicsTrunk/1.0 (cover-scan; +https://comicstrunk.com)';
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

// Wikis cobrem 95% das HQs ocidentais. Adicionar manga/europeias requer
// avaliar se a Fandom tem cobertura boa — Marvel e DC sim, Image/Dark
// Horse tem fandom proprios mas paginas mais escassas.
const WIKIS: { domain: string; label: string }[] = [
  { domain: 'dc.fandom.com', label: 'DC Database' },
  { domain: 'marvel.fandom.com', label: 'Marvel Database' },
];

export interface FandomPageSummary {
  pageId: number;
  title: string;
  url: string;
  image: string | null;
  wikiDomain: string; // 'dc.fandom.com' | 'marvel.fandom.com'
  publisher: string | null; // inferido do dominio (DC, Marvel)
}

interface MediaWikiSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        index?: number;
        thumbnail?: { source: string; width: number; height: number };
        pageimage?: string;
      }
    >;
  };
}

const cache = new Map<string, { value: FandomPageSummary[]; expiresAt: number }>();

function cacheGet(key: string): FandomPageSummary[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: FandomPageSummary[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Busca em todas as wikis configuradas em paralelo. Cada wiki tem seu
 * proprio circuit breaker (uma cair nao afeta as outras).
 */
export async function searchFandom(
  query: string,
  opts: { limitPerWiki?: number } = {},
): Promise<FandomPageSummary[]> {
  const limit = opts.limitPerWiki ?? 3;
  const cacheKey = `q=${query}&l=${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const results = await Promise.allSettled(
    WIKIS.map((w) => searchWiki(w, query, limit)),
  );

  const pages: FandomPageSummary[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') pages.push(...r.value);
  }

  cacheSet(cacheKey, pages);
  return pages;
}

async function searchWiki(
  wiki: { domain: string; label: string },
  query: string,
  limit: number,
): Promise<FandomPageSummary[]> {
  return await withCircuitBreaker(
    `fandom-${wiki.domain}`,
    async () => {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: String(limit),
        prop: 'pageimages',
        pithumbsize: '600',
        format: 'json',
      });
      const url = `https://${wiki.domain}/api.php?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Fandom ${wiki.domain} HTTP ${res.status}`);
      const data = (await res.json()) as MediaWikiSearchResponse;

      const pages = data.query?.pages;
      if (!pages) return [];

      const list = Object.values(pages).sort(
        (a, b) => (a.index ?? 999) - (b.index ?? 999),
      );

      const publisher = wiki.domain.startsWith('dc.')
        ? 'DC Comics'
        : wiki.domain.startsWith('marvel.')
          ? 'Marvel Comics'
          : null;

      return list.map<FandomPageSummary>((p) => {
        // Trocar a thumbnail pequena pela imagem original (sem scale-to-width).
        // Padrao do CDN: .../images/<hash>/<file>/revision/latest/scale-to-width-down/N?cb=...
        // -> .../images/<hash>/<file>/revision/latest?cb=...
        const fullImage = p.thumbnail?.source
          ? p.thumbnail.source.replace(/\/scale-to-width-down\/\d+/, '')
          : null;

        return {
          pageId: p.pageid,
          title: p.title,
          url: `https://${wiki.domain}/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
          image: fullImage,
          wikiDomain: wiki.domain,
          publisher,
        };
      });
    },
    { fallback: [] as FandomPageSummary[], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Parse de URL Fandom de pagina de SERIE pra extrair wikiDomain + pageTitle.
 *
 * Ex: https://dc.fandom.com/wiki/The_Flash_Vol_2
 *   -> { wikiDomain: 'dc.fandom.com', pageTitle: 'The Flash Vol 2' }
 *
 * Retorna null se URL nao e Fandom valida ou nao tem /wiki/ path.
 */
export function parseFandomSeriesUrl(
  rawUrl: string,
): { wikiDomain: string; pageTitle: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith('.fandom.com')) return null;
  const match = parsed.pathname.match(/^\/wiki\/(.+)$/);
  if (!match) return null;
  // Decodificar URL-encoded chars (%27 = ' etc) e trocar _ por espaco pra
  // bater com o titulo MediaWiki (que internamente armazena com espacos).
  const pageTitle = decodeURIComponent(match[1]).replace(/_/g, ' ').trim();
  if (!pageTitle) return null;
  return { wikiDomain: parsed.hostname, pageTitle };
}

export interface FandomSeriesIssueRef {
  issueNumber: number;
  /** Titulo da pagina MediaWiki, ex "The Flash Vol 2 1". */
  pageTitle: string;
  /** URL completa /wiki/ — pra abrir no navegador. */
  url: string;
  pageId: number;
}

/**
 * Lista todas as paginas de issue de uma serie Fandom via MediaWiki API
 * (action=query&list=allpages&apprefix=...).
 *
 * Por que nao scraping do HTML da pagina de serie? Cloudflare protege as
 * paginas /wiki/ com challenge bot, retornando 403 + "Just a moment..."
 * pra clients sem JS. Mas /api.php passa direto.
 *
 * Estrategia: query com apprefix=`<seriesTitle> ` (com espaco final) lista
 * todas as paginas que comecam com esse prefixo, depois filtramos as que
 * batem o padrao `<seriesTitle> <N>` (so numero, sem texto extra). Issues
 * tipo "Annual 1" ou "1000000" sao incluidos. Variantes ("Vol 2 1 Director's
 * Cut") sao excluidas pra match preciso.
 *
 * Retorno ordenado por numero.
 */
export async function listFandomSeriesIssues(
  wikiDomain: string,
  seriesPageTitle: string,
): Promise<FandomSeriesIssueRef[]> {
  return await withCircuitBreaker(
    `fandom-${wikiDomain}`,
    async () => {
      const params = new URLSearchParams({
        action: 'query',
        list: 'allpages',
        apprefix: `${seriesPageTitle} `, // espaco final filtra pra issues, nao subpags
        aplimit: '500',
        format: 'json',
      });
      const url = `https://${wikiDomain}/api.php?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Fandom allpages HTTP ${res.status}`);
      const data = (await res.json()) as {
        query?: { allpages?: { pageid: number; title: string }[] };
      };

      const allPages = data.query?.allpages ?? [];
      const slug = seriesPageTitle.replace(/ /g, '_');
      const escaped = seriesPageTitle.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const issuePattern = new RegExp(`^${escaped} (\\d+)$`);

      const seen = new Map<number, FandomSeriesIssueRef>();
      for (const p of allPages) {
        const m = p.title.match(issuePattern);
        if (!m) continue;
        const issueNumber = parseInt(m[1], 10);
        if (!Number.isFinite(issueNumber) || issueNumber < 0 || issueNumber > 9_999_999) continue;
        if (seen.has(issueNumber)) continue;
        seen.set(issueNumber, {
          issueNumber,
          pageTitle: p.title,
          pageId: p.pageid,
          url: `https://${wikiDomain}/wiki/${slug}_${issueNumber}`,
        });
      }

      return Array.from(seen.values()).sort((a, b) => a.issueNumber - b.issueNumber);
    },
    { fallback: [] as FandomSeriesIssueRef[], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Busca os dados de uma pagina especifica para enriquecimento na importacao
 * (capa em alta resolucao, eventualmente sinopse). Por enquanto so retorna
 * a thumbnail grande — sinopse fica fora pra evitar parsing fragil de HTML.
 */
export async function getFandomPage(
  wikiDomain: string,
  pageTitle: string,
): Promise<FandomPageSummary | null> {
  return await withCircuitBreaker(
    `fandom-${wikiDomain}`,
    async () => {
      const params = new URLSearchParams({
        action: 'query',
        titles: pageTitle,
        prop: 'pageimages',
        pithumbsize: '1000',
        format: 'json',
      });
      const url = `https://${wikiDomain}/api.php?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Fandom ${wikiDomain} HTTP ${res.status}`);
      const data = (await res.json()) as MediaWikiSearchResponse;

      const pages = data.query?.pages;
      if (!pages) return null;
      const first = Object.values(pages)[0];
      if (!first || !first.title) return null;

      const fullImage = first.thumbnail?.source
        ? first.thumbnail.source.replace(/\/scale-to-width-down\/\d+/, '')
        : null;

      const publisher = wikiDomain.startsWith('dc.')
        ? 'DC Comics'
        : wikiDomain.startsWith('marvel.')
          ? 'Marvel Comics'
          : null;

      return {
        pageId: first.pageid,
        title: first.title,
        url: `https://${wikiDomain}/wiki/${encodeURIComponent(first.title.replace(/ /g, '_'))}`,
        image: fullImage,
        wikiDomain,
        publisher,
      };
    },
    { fallback: null as FandomPageSummary | null, failureThreshold: 3, openMs: 5 * 60_000 },
  );
}
