const path = require('path');
const fs = require('fs');

// Resolve sharp from pnpm store
const sharpPath = path.join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp');
const sharp = require(sharpPath);

const OUTPUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'public');

// SVG favicon: "CT" initials with comic-book style
const svgFavicon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed"/>
      <stop offset="100%" style="stop-color:#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="340" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="280" fill="white" text-anchor="middle" letter-spacing="-15">CT</text>
</svg>
`;

async function generate() {
  // Generate multiple sizes for ICO
  const sizes = [16, 32, 48];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svgFavicon))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Generate 32x32 PNG as the primary favicon.ico (browsers handle PNG-in-ICO fine)
  const favicon32 = await sharp(Buffer.from(svgFavicon))
    .resize(32, 32)
    .png()
    .toBuffer();

  // Write simple ICO file (PNG-based ICO)
  const icoBuffer = createIco(pngBuffers);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'favicon.ico'), icoBuffer);
  console.log('favicon.ico written (' + icoBuffer.length + ' bytes)');

  // Also generate apple-touch-icon (180x180)
  const apple = await sharp(Buffer.from(svgFavicon))
    .resize(180, 180)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'apple-touch-icon.png'), apple);
  console.log('apple-touch-icon.png written (' + apple.length + ' bytes)');

  // 192x192 for Android
  const android = await sharp(Buffer.from(svgFavicon))
    .resize(192, 192)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'icon-192.png'), android);
  console.log('icon-192.png written (' + android.length + ' bytes)');

  // 512x512 for PWA
  const pwa = await sharp(Buffer.from(svgFavicon))
    .resize(512, 512)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'icon-512.png'), pwa);
  console.log('icon-512.png written (' + pwa.length + ' bytes)');

  console.log('Done!');
}

// Create ICO file from PNG buffers (simplified ICO format)
function createIco(images) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = images.length;
  let offset = headerSize + dirEntrySize * numImages;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // ICO type
  header.writeUInt16LE(numImages, 4);

  // Directory entries + image data
  const dirEntries = [];
  const imageData = [];

  for (const { size, buf } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // width
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // height
    entry.writeUInt8(0, 2);                          // color palette
    entry.writeUInt8(0, 3);                          // reserved
    entry.writeUInt16LE(1, 4);                       // color planes
    entry.writeUInt16LE(32, 6);                      // bits per pixel
    entry.writeUInt32LE(buf.length, 8);              // image data size
    entry.writeUInt32LE(offset, 12);                 // image data offset

    dirEntries.push(entry);
    imageData.push(buf);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageData]);
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
