#!/usr/bin/env tsx
import 'dotenv/config';
import { uploadImage } from '../src/shared/lib/cloudinary';

const url = 'https://static.wikia.nocookie.net/marvel_dc/images/e/ed/Wonder_Woman_Vol_1_176.jpg/revision/latest?cb=20090422155718';

async function main(): Promise<void> {
  console.log('1. Fetch...');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ComicsTrunk/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  console.log('   status:', res.status, 'content-type:', res.headers.get('content-type'));
  if (!res.ok) return;

  const ab = await res.arrayBuffer();
  const raw = Buffer.from(ab);
  console.log('2. Buffer:', raw.length, 'bytes');

  console.log('3. Sharp import...');
  let compressed = raw;
  try {
    const sharpMod = await import('sharp');
    const sharp = sharpMod.default;
    console.log('   sharp loaded');
    compressed = await sharp(raw)
      .resize(600, null, { withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    console.log('   compressed to', compressed.length, 'bytes');
  } catch (err) {
    console.log('   sharp ERROR:', err);
    return;
  }

  console.log('4. Upload R2...');
  try {
    const result = await uploadImage(compressed, 'covers');
    console.log('   uploaded:', result.publicId);
    console.log('   url:', result.url);
  } catch (err) {
    console.log('   upload ERROR:', err);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
