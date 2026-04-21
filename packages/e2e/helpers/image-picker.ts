import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const IMAGES_DIR = path.resolve(__dirname, '..', 'images');
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export function getAllImagePaths(): string[] {
  if (!fs.existsSync(IMAGES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(IMAGES_DIR);
  return files
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return VALID_EXTENSIONS.includes(ext);
    })
    .map((file) => path.join(IMAGES_DIR, file));
}

/**
 * Creates a minimal 1x1 pixel PNG buffer and writes it to a temp file.
 * Used as a fallback when no real images are available in the images/ directory.
 */
function createFallbackImage(): string {
  // Minimal 1x1 pixel transparent PNG (67 bytes)
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  const tmpDir = os.tmpdir();
  const fallbackPath = path.join(tmpDir, `e2e-fallback-${Date.now()}.png`);
  fs.writeFileSync(fallbackPath, pngBuffer);
  return fallbackPath;
}

export function pickRandomImage(): string {
  const images = getAllImagePaths();

  if (images.length === 0) {
    return createFallbackImage();
  }

  return images[Math.floor(Math.random() * images.length)];
}

export function pickRandomImages(count: number): string[] {
  const images = getAllImagePaths();

  if (images.length === 0) {
    return Array.from({ length: count }, () => createFallbackImage());
  }

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(images[Math.floor(Math.random() * images.length)]);
  }
  return result;
}
