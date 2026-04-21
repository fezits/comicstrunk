import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger';

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
} else {
  logger.warn(
    'Cloudinary not configured — using local file storage for uploads. ' +
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET for cloud storage.',
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

  // Local file storage fallback
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

/** Build the public URL for a locally-stored cover file */
export function localCoverUrl(filename: string, folder = 'comicstrunk/covers'): string {
  return `${apiBaseUrl}/uploads/${folder}/${filename}`;
}

/** The base URL used for local uploads — allows callers to detect stale URLs */
export const LOCAL_API_BASE_URL = apiBaseUrl;
