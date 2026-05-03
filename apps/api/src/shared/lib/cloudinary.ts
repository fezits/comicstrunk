import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './logger';

const VALID_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);

/**
 * Detect image format from the first bytes of the buffer (magic bytes).
 * Pure JS, no native deps — works even when sharp's prebuilt binary is
 * incompatible with the Node version (the case in our cPanel host where
 * Node 20.1.0 is locked but recent sharp builds require Node 20.3+).
 *
 * Returns the format string ('jpeg' | 'png' | 'webp' | 'gif') or null
 * if the bytes don't match any supported image format.
 */
function detectImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'gif';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

async function validateImageBuffer(buffer: Buffer): Promise<void> {
  const format = detectImageFormat(buffer);
  if (!format || !VALID_IMAGE_FORMATS.has(format)) {
    throw new Error(
      `uploadImage: buffer is not a valid image (detected format: ${format ?? 'unknown'})`,
    );
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
