/**
 * Download de capa externa com guards SSRF + tamanho + validacao via sharp
 * (delegado a uploadImage).
 *
 * Extraido de cover-import.service.ts em 2026-04-29 para ser compartilhado
 * entre o fluxo de import (cover-scan) e o admin de gestao de capas.
 *
 * Guards:
 *   1) isSafeExternalUrl: rejeita protocolo nao-http(s) e IPs privados/loopback/
 *      link-local (incl. 169.254.169.254 = cloud metadata IMDS).
 *   2) Content-Length cap antes de baixar (header) + body cap depois.
 *   3) uploadImage valida via sharp.metadata() que o buffer e imagem real.
 */

import dns from 'dns/promises';
import net from 'net';
import { uploadImage } from './cloudinary';
import { logger } from './logger';

export const MAX_COVER_BYTES = 10 * 1024 * 1024; // 10MB hard cap

/**
 * Baixa imagem da URL e faz upload pro storage configurado (R2 → Cloudinary →
 * local). Retorna apenas o filename (sem pasta) para salvar em coverFileName,
 * ou null em caso de falha (best effort — não deve travar o caller).
 *
 * O publicId retornado por uploadImage tem formato "covers/uuid.ext"; extraimos
 * so a parte apos a ultima barra para obter o filename.
 */
export async function tryDownloadCover(url: string): Promise<string | null> {
  if (!(await isSafeExternalUrl(url))) {
    logger.warn('cover-download: refused unsafe URL', { url: url.slice(0, 200) });
    return null;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const declaredLength = res.headers.get('content-length');
    if (declaredLength && parseInt(declaredLength, 10) > MAX_COVER_BYTES) {
      logger.warn('cover-download: cover too large (header)', { declaredLength });
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 1_000) return null; // muito pequeno, provavel placeholder
    if (buffer.length > MAX_COVER_BYTES) {
      logger.warn('cover-download: cover too large (body)', { length: buffer.length });
      return null;
    }

    // uploadImage agora valida via sharp que o buffer eh imagem real — joga
    // erro se nao for. Tratamos como falha de download (best-effort).
    const { publicId } = await uploadImage(buffer, 'covers');
    const filename = publicId.split('/').pop() ?? null;
    return filename;
  } catch (err) {
    logger.warn('cover-download: tryDownloadCover failed', { err: (err as Error)?.message });
    return null;
  }
}

/**
 * Valida que a URL e segura para fetch externo:
 *   - Protocolo http/https apenas (bloqueia file://, gopher://, etc).
 *   - Hostname nao resolve para IP privado, loopback, link-local ou CGNAT.
 *
 * Tem TOCTOU residual (DNS pode mudar entre lookup e fetch real), mas elimina
 * 99% dos vetores de SSRF sem dependencia externa. Para hardening total seria
 * preciso usar request-filtering-agent ou similar.
 */
export async function isSafeExternalUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const hostname = parsed.hostname;
  if (!hostname) return false;

  if (net.isIP(hostname)) {
    return !isPrivateOrReservedIp(hostname);
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    for (const addr of addresses) {
      if (isPrivateOrReservedIp(addr.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Bloqueia ranges que nao deveriam ser alcancaveis por download externo:
 * loopback, link-local (cloud metadata em 169.254.169.254), RFC1918, CGNAT,
 * IPv6 unique-local e link-local, IPv4-mapped IPv6.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (ip === '0.0.0.0' || ip === '::' || ip === '::1') return true;
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (/^22[4-9]\.|^23\d\./.test(ip)) return true;
  if (/^24[0-9]\.|^25[0-5]\./.test(ip)) return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(lower.slice('::ffff:'.length));
  }
  return false;
}
