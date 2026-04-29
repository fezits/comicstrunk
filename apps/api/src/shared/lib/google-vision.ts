/**
 * Cliente Cloud Vision API (Web Detection).
 *
 * Endpoint usado: POST /v1/images:annotate com feature WEB_DETECTION.
 * O Google compara a imagem enviada contra o indice global de imagens
 * web do Google Search e devolve:
 *  - bestGuessLabels: melhor palpite de "do que e essa imagem" (string).
 *    Ex: foto de capa de "Batman: Year One" devolve "Batman: Year One".
 *  - webEntities: entidades reconhecidas com score (Batman, DC Comics).
 *  - pagesWithMatchingImages: paginas onde a mesma imagem aparece (com
 *    pageTitle do Google index — geralmente "Tartarugas Ninja: O Ultimo
 *    Ronin - Anos Perdidos | Amazon.com.br").
 *  - visuallySimilarImages / fullMatchingImages: URLs de imagens.
 *
 * Custo: $1.50 por 1k chamadas. Free tier: 1000/mes. Restricao IP da
 * chave protege contra abuso.
 *
 * Fail open: erro/captcha/quota → null.
 */

import crypto from 'crypto';
import { withCircuitBreaker } from './circuit-breaker';
import { logger } from './logger';

const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — mesma imagem dificilmente muda
const CACHE_MAX_ENTRIES = 200;

export interface GoogleVisionWebDetection {
  bestGuessLabel: string | null;
  webEntities: Array<{ description: string; score: number }>;
  pagesWithMatchingImages: Array<{ url: string; pageTitle: string | null }>;
  visuallySimilarImages: string[];
  fullMatchingImages: string[];
}

interface CacheEntry {
  value: GoogleVisionWebDetection;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKeyForImage(imageBase64: string): string {
  // SHA-256 do base64 inteiro. Antes usavamos os ultimos 64 chars do base64
  // mas isso permitia colisao em duas imagens com mesmo final (raro porem
  // possivel). Hash garante que cache hit so acontece pra imagem identica.
  return crypto.createHash('sha256').update(imageBase64).digest('hex').slice(0, 32);
}

function cacheGet(key: string): GoogleVisionWebDetection | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: GoogleVisionWebDetection): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

interface RawWebDetection {
  bestGuessLabels?: Array<{ label: string; languageCode?: string }>;
  webEntities?: Array<{ entityId?: string; description?: string; score?: number }>;
  pagesWithMatchingImages?: Array<{ url: string; pageTitle?: string }>;
  visuallySimilarImages?: Array<{ url: string }>;
  fullMatchingImages?: Array<{ url: string }>;
}

interface RawAnnotateResponse {
  responses?: Array<{
    webDetection?: RawWebDetection;
    error?: { code: number; message: string };
  }>;
}

/**
 * Chama Web Detection com a imagem em base64. Retorna null em qualquer
 * problema (sem chave, quota, rede, captcha) — chamador deve assumir
 * fail open e seguir sem essa info.
 */
export async function detectWebForImage(
  imageBase64: string,
): Promise<GoogleVisionWebDetection | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return null;

  const cacheKey = cacheKeyForImage(imageBase64);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Strip do prefixo "data:image/jpeg;base64," se vier; Vision quer so
  // o conteudo base64.
  const content = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  return await withCircuitBreaker(
    'google-vision',
    async () => {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content },
              features: [{ type: 'WEB_DETECTION', maxResults: 10 }],
            },
          ],
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Google Vision HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as RawAnnotateResponse;
      const r = data.responses?.[0];
      if (r?.error) {
        throw new Error(`Google Vision API error: ${r.error.message}`);
      }
      const wd = r?.webDetection;
      if (!wd) return null;

      const result: GoogleVisionWebDetection = {
        bestGuessLabel: wd.bestGuessLabels?.[0]?.label?.trim() || null,
        webEntities: (wd.webEntities ?? [])
          .filter((e) => e.description && (e.score ?? 0) > 0)
          .map((e) => ({ description: e.description!.trim(), score: e.score ?? 0 }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10),
        pagesWithMatchingImages: (wd.pagesWithMatchingImages ?? []).map((p) => ({
          url: p.url,
          pageTitle: p.pageTitle?.trim() || null,
        })).slice(0, 10),
        visuallySimilarImages: (wd.visuallySimilarImages ?? [])
          .map((i) => i.url)
          .slice(0, 5),
        fullMatchingImages: (wd.fullMatchingImages ?? []).map((i) => i.url).slice(0, 5),
      };

      cacheSet(cacheKey, result);
      logger.info('google-vision: detected', {
        bestGuessLabel: result.bestGuessLabel,
        entities: result.webEntities.length,
        pages: result.pagesWithMatchingImages.length,
      });
      return result;
    },
    { fallback: null as GoogleVisionWebDetection | null, failureThreshold: 3, openMs: 5 * 60_000 },
  );
}
