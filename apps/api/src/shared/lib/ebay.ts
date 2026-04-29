/**
 * Cliente eBay Browse API.
 *
 * Auth: OAuth 2.0 client credentials flow.
 *  - POST https://api.ebay.com/identity/v1/oauth2/token
 *  - Header: Authorization: Basic base64("<App ID>:<Cert ID>")
 *  - Body: grant_type=client_credentials & scope=https://api.ebay.com/oauth/api_scope
 *  - Resposta: { access_token, expires_in: 7200, token_type: "Bearer" }
 *
 * Usado pra capa avariada / sem texto / vintage onde Amazon BR + Metron +
 * Rika + Fandom nao cobrem. Free tier: 5k chamadas/dia.
 *
 * Fail open em qualquer erro (sem chave, OAuth fail, HTTP 4xx/5xx,
 * captcha) — retorna [] e o pipeline segue com o resto das fontes.
 */

import { withCircuitBreaker } from './circuit-breaker';
import { logger } from './logger';

const OAUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const ITEM_URL = 'https://api.ebay.com/buy/browse/v1/item';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';
const COMICS_CATEGORY_ID = '259104'; // "Comics" no taxonomy do eBay
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

// Token OAuth: bom por ~2h. Cacheamos pra nao queimar quota com refresh.
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string | null> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) return null;

  // Token valido com folga de 60s pra nao expirar mid-request
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const auth = Buffer.from(`${appId}:${certId}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: SCOPE,
  }).toString();

  let res: Response;
  try {
    res = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn('ebay: OAuth network error', { err: (err as Error)?.message });
    return null;
  }

  if (!res.ok) {
    logger.warn('ebay: OAuth HTTP error', { status: res.status });
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return data.access_token;
}

export interface EbayItemSummary {
  itemId: string; // formato "v1|<n>|<n>"
  epid: string | null; // eBay Product ID — agrega multiplos listings do mesmo gibi
  title: string;
  image: string | null;
  url: string;
  price: { value: string; currency: string } | null;
  condition: string | null; // "Used", "New", "Like New"
  seller: string | null;
}

interface RawEbayItem {
  itemId?: string;
  epid?: string;
  title?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl: string }>;
  itemWebUrl?: string;
  price?: { value: string; currency: string };
  condition?: string;
  seller?: { username?: string };
}

interface RawSearchResponse {
  itemSummaries?: RawEbayItem[];
  total?: number;
}

const cache = new Map<string, { value: EbayItemSummary[]; expiresAt: number }>();

function cacheGet(key: string): EbayItemSummary[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: EbayItemSummary[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Busca itens no eBay por termo livre. Limita a categoria Comics (259104)
 * pra reduzir ruido de itens nao-quadrinhos com nomes parecidos.
 *
 * Dedup por epid: multiples listings do mesmo gibi colapsam pra um. Sem
 * epid (gibis raros), o itemId vai como id no externalRef.
 */
export async function searchEbay(
  query: string,
  opts: { limit?: number } = {},
): Promise<EbayItemSummary[]> {
  const limit = Math.min(opts.limit ?? 5, 25);
  const cacheKey = `q=${query}&l=${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const token = await getOAuthToken();
  if (!token) return [];

  return await withCircuitBreaker(
    'ebay',
    async () => {
      const params = new URLSearchParams({
        q: query,
        category_ids: COMICS_CATEGORY_ID,
        limit: String(limit),
        sort: 'bestMatch',
      });

      const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`eBay HTTP ${res.status}`);
      const data = (await res.json()) as RawSearchResponse;
      const items = (data.itemSummaries ?? []).map(mapItem).filter((i): i is EbayItemSummary => !!i);

      // Dedup por epid (mantem o primeiro — bestMatch ordering ja prioriza)
      const seen = new Set<string>();
      const unique: EbayItemSummary[] = [];
      for (const item of items) {
        const key = item.epid ?? item.itemId;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
      }

      cacheSet(cacheKey, unique);
      return unique;
    },
    { fallback: [] as EbayItemSummary[], failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

/**
 * Resolve um item especifico por epid (ou itemId fallback). Usado no
 * fluxo de import quando o usuario escolhe um candidato eBay.
 */
export async function getEbayItem(epidOrItemId: string): Promise<EbayItemSummary | null> {
  const token = await getOAuthToken();
  if (!token) return null;

  return await withCircuitBreaker(
    'ebay',
    async () => {
      // Se parecer epid (so digitos), usa endpoint legacy resolver
      const isEpid = /^\d+$/.test(epidOrItemId);
      const url = isEpid
        ? `${ITEM_URL}/get_items_by_item_group?item_group_id=${encodeURIComponent(epidOrItemId)}`
        : `${ITEM_URL}/${encodeURIComponent(epidOrItemId)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        // Fallback: busca pelo epid via search
        if (isEpid) {
          const items = await searchEbay(epidOrItemId, { limit: 3 });
          return items.find((i) => i.epid === epidOrItemId) ?? items[0] ?? null;
        }
        throw new Error(`eBay HTTP ${res.status}`);
      }
      const data = (await res.json()) as RawEbayItem & { items?: RawEbayItem[] };
      // get_items_by_item_group retorna { items: [...] }
      const raw = data.items?.[0] ?? data;
      return mapItem(raw);
    },
    { fallback: null as EbayItemSummary | null, failureThreshold: 3, openMs: 5 * 60_000 },
  );
}

function mapItem(raw: RawEbayItem): EbayItemSummary | null {
  const itemId = raw.itemId?.trim();
  const title = raw.title?.trim();
  if (!itemId || !title) return null;

  // Imagem: prefere image.imageUrl (alta res); fallback pro thumbnail
  const image = raw.image?.imageUrl ?? raw.thumbnailImages?.[0]?.imageUrl ?? null;

  return {
    itemId,
    epid: raw.epid?.trim() || null,
    title,
    image,
    url: raw.itemWebUrl ?? `https://www.ebay.com/itm/${itemId}`,
    price: raw.price ? { value: raw.price.value, currency: raw.price.currency } : null,
    condition: raw.condition ?? null,
    seller: raw.seller?.username ?? null,
  };
}
