// Fetch missing Newpop covers by scraping product pages
// Uses Playwright to visit Newpop shop pages and extract product images

const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

// Read the missing covers list
const tsvData = fs.readFileSync(path.join(__dirname, '..', 'docs', 'newpop-missing-covers.tsv'), 'utf8');
const entries = tsvData.trim().split('\n').map(line => {
  const [id, title, publisher, sourceKey] = line.split('\t');
  return { id, title, publisher, sourceKey };
});

// Newpop shop URL pattern
function shopSlug(title) {
  return title
    .toLowerCase()
    .replace(/[#()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'newpop-covers');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function fetchFromShop(browser, entry) {
  const slug = shopSlug(entry.title);
  const urls = [
    'https://www.lojanewpop.com.br/' + slug,
    'https://www.newpop.com.br/' + slug + '/',
  ];

  for (const url of urls) {
    const page = await browser.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      if (!resp || resp.status() !== 200) { await page.close(); continue; }

      await page.waitForTimeout(2000);

      // Look for product image
      const imgUrl = await page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          'img.product-image',
          'img[data-zoom]',
          '.product-image img',
          '.woocommerce-product-gallery img',
          'img.wp-post-image',
          'figure img',
        ];

        for (const sel of selectors) {
          const img = document.querySelector(sel);
          if (img) {
            const src = img.getAttribute('data-zoom') || img.getAttribute('data-large_image') ||
                       img.getAttribute('data-src') || img.src || '';
            if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) {
              return src.split('?')[0];
            }
          }
        }

        // Fallback: largest image on page
        const imgs = Array.from(document.querySelectorAll('img'));
        const productImgs = imgs
          .filter(img => {
            const src = img.src || '';
            return src.startsWith('http') &&
                   (src.includes('upload') || src.includes('product') || src.includes('cdn')) &&
                   !src.includes('logo') && !src.includes('icon') && !src.includes('payment');
          })
          .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));

        return productImgs[0]?.src?.split('?')[0] || null;
      });

      await page.close();

      if (imgUrl) return { url, imgUrl };
    } catch {
      await page.close();
    }
  }

  return null;
}

async function downloadAndCompress(imgUrl, filename) {
  try {
    const resp = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 5000) return null; // too small, likely placeholder

    // Compress with sharp
    try {
      const sharpPath = path.join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp');
      const sharp = require(sharpPath);
      const outputPath = path.join(OUTPUT_DIR, filename);
      await sharp(buffer)
        .resize(600, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);

      const stat = fs.statSync(outputPath);
      return { path: outputPath, size: stat.size };
    } catch {
      // No sharp, save raw
      const outputPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outputPath, buffer);
      return { path: outputPath, size: buffer.length };
    }
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== NEWPOP COVER FETCHER ===');
  console.log('Entries to process: ' + entries.length + '\n');

  const browser = await pw.chromium.launch({ headless: true });
  const results = { found: 0, notFound: 0, error: 0 };
  const foundCovers = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write('[' + (i + 1) + '/' + entries.length + '] ' + entry.title + '... ');

    const result = await fetchFromShop(browser, entry);

    if (result) {
      const filename = 'newpop-' + entry.id.slice(-8) + '.jpg';
      const download = await downloadAndCompress(result.imgUrl, filename);

      if (download) {
        console.log('OK (' + Math.round(download.size / 1024) + 'KB)');
        results.found++;
        foundCovers.push({ ...entry, filename, imgUrl: result.imgUrl, size: download.size });
      } else {
        console.log('DOWNLOAD FAILED');
        results.error++;
      }
    } else {
      console.log('NOT FOUND');
      results.notFound++;
    }
  }

  await browser.close();

  console.log('\n=== RESULTS ===');
  console.log('Found: ' + results.found);
  console.log('Not found: ' + results.notFound);
  console.log('Error: ' + results.error);

  if (foundCovers.length > 0) {
    console.log('\nCovers to upload:');
    foundCovers.forEach(c => console.log('  ' + c.filename + ' <- ' + c.title));

    // Save manifest for upload script
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'manifest.json'),
      JSON.stringify(foundCovers, null, 2)
    );
    console.log('\nManifest saved to docs/newpop-covers/manifest.json');
  }
}

run().catch(e => console.error(e));
