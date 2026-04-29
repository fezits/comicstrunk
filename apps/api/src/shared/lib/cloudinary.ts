import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './logger';

const VALID_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);

/**
 * Validacao da imagem via sharp. Carregamento lazy do sharp porque o binario
 * nativo prebuilt requer Node >=20.3 e o servidor de producao roda 20.1 — top-
 * level import crashava o boot. Lazy: se sharp nao carregar, falhamos a
 * validacao (fail-secure — buffer suspeito nao vai pro R2) sem derrubar a API.
 */
type SharpFn = (buf: Buffer) => { metadata(): Promise<{ format?: string }> };

async function validateImageBuffer(buffer: Buffer): Promise<void> {
  let sharpFn: SharpFn;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharpFn = require('sharp');
  } catch (err) {
    throw new Error(
      `uploadImage: buffer is not a valid image — sharp unavailable (${(err as Error).message})`,
    );
  }
  let metadata: { format?: string };
  try {
    metadata = await sharpFn(buffer).metadata();
  } catch (err) {
    throw new Error(`uploadImage: buffer is not a valid image (${(err as Error).message})`);
  }
  if (!metadata.format || !VALID_IMAGE_FORMATS.has(metadata.format)) {
    throw new Error(`uploadImage: unsupported image format: ${metadata.format ?? 'unknown'}`);
  }
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const cloudinaryConfigured = !!(cloudName && apiKey && apiSecret);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

// === Cloudflare R2 Configuration ===
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2Endpoint = process.env.R2_ENDPOINT;
const r2Bucket = process.env.R2_BUCKET_NAME || 'comicstrunk';
const r2PublicUrl = process.env.R2_PUBLIC_URL; // e.g. https://covers.comicstrunk.com

const r2Configured = !!(r2AccessKeyId && r2SecretAccessKey && r2Endpoint && r2PublicUrl);

let r2Client: S3Client | null = null;
if (r2Configured) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: { accessKeyId: r2AccessKeyId!, secretAccessKey: r2SecretAccessKey! },
  });
  logger.info('Cloudflare R2 configured — covers served from ' + r2PublicUrl);
} else if (!cloudinaryConfigured) {
  logger.warn(
    'Neither R2 nor Cloudinary configured — using local file storage for uploads.',
  );
}

// Local uploads directory (relative to project root)
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Base URL for serving local uploads (set by express.static in create-app) */
const apiBaseUrl = process.env.API_BASE_URL
  || (process.env.WEB_URL ? process.env.WEB_URL.replace('://', '://api.') : `http://localhost:${process.env.PORT || 3001}`);

export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  // Validate buffer is actually an image before persisting it. Sem isso,
  // qualquer bytes (resposta de SSRF, JSON, etc) sao gravados no R2 com
  // Content-Type forjado e ficam acessiveis publicamente em
  // covers.comicstrunk.com.
  await validateImageBuffer(buffer);

  // Priority 1: Cloudflare R2
  if (r2Client && r2Configured) {
    const ext = detectExtension(buffer);
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${filename}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: buffer,
      ContentType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
      CacheControl: 'public, max-age=31536000',
    }));

    return { url: `${r2PublicUrl}/${key}`, publicId: key };
  }

  // Priority 2: Cloudinary
  if (cloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({ url: result.secure_url, publicId: result.public_id });
          } else {
            reject(new Error('Cloudinary upload returned no result'));
          }
        },
      );
      stream.end(buffer);
    });
  }

  // Priority 3: Local file storage fallback
  const subDir = path.join(UPLOADS_DIR, folder.replace(/\//g, path.sep));
  ensureDir(subDir);

  const ext = detectExtension(buffer);
  const filename = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(subDir, filename);

  fs.writeFileSync(filePath, buffer);

  const publicId = `${folder}/${filename}`;
  const url = `${apiBaseUrl}/uploads/${folder}/${filename}`;

  return { url, publicId };
}

export async function deleteImage(publicId: string): Promise<void> {
  // R2
  if (r2Client && r2Configured) {
    await r2Client.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: publicId }));
    return;
  }

  // Cloudinary
  if (cloudinaryConfigured) {
    await cloudinary.uploader.destroy(publicId);
    return;
  }

  // Local file deletion
  const filePath = path.join(UPLOADS_DIR, publicId.replace(/\//g, path.sep));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** Detect image extension from buffer magic bytes */
function detectExtension(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return '.jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return '.png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return '.gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return '.webp';
  return '.jpg'; // default
}

/** Path to uploads directory — used by create-app for express.static */
export const UPLOADS_PATH = UPLOADS_DIR;

/** Build the public URL for a cover file (R2 or local) */
export function localCoverUrl(filename: string, folder = 'covers'): string {
  if (r2Configured && r2PublicUrl) {
    return `${r2PublicUrl}/${folder}/${filename}`;
  }
  return `${apiBaseUrl}/uploads/comicstrunk/covers/${filename}`;
}

/** The base URL used for local uploads — allows callers to detect stale URLs */
export const LOCAL_API_BASE_URL = apiBaseUrl;

/**
 * Resolve coverImageUrl for any object that has coverImageUrl + coverFileName.
 * Use this in all service modules that return catalog entry data.
 * Priority: coverFileName → R2/local URL, /uploads/ URL → rewrite, external → as-is
 */
export function resolveCoverUrl<T extends { coverImageUrl: string | null; coverFileName?: string | null }>(
  entry: T,
): T {
  if (entry.coverFileName) {
    return { ...entry, coverImageUrl: localCoverUrl(entry.coverFileName) };
  }
  const url = entry.coverImageUrl;
  if (url && url.includes('/uploads/')) {
    const filename = url.split('/').pop();
    if (filename) return { ...entry, coverImageUrl: localCoverUrl(filename) };
  }
  return entry;
}
