const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const sku = process.argv[2] || 'AMAEJ001R7';

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Try direct product page
  const url = 'https://panini.com.br/' + sku.toLowerCase();
  console.log('Fetching: ' + url);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Get the main product image
  const images = await page.evaluate(() => {
    const results = [];
    // Product gallery images
    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      const src = img.src || img.dataset.src || '';
      if (src.includes('media/catalog/product') && !src.includes('placeholder') && src.length > 50) {
        results.push({ src, width: img.naturalWidth, alt: img.alt });
      }
    }
    // Also check for zoom images
    const zooms = document.querySelectorAll('[data-zoom-image], [data-full-image]');
    for (const z of zooms) {
      const src = z.getAttribute('data-zoom-image') || z.getAttribute('data-full-image') || '';
      if (src) results.push({ src, width: 0, alt: 'zoom' });
    }
    return results;
  });

  console.log('Images found: ' + images.length);
  for (const img of images) {
    console.log('  ' + img.src + ' (' + img.alt + ')');
  }

  if (images.length === 0) {
    // Try getting page title to see if we're on the right page
    const title = await page.title();
    console.log('Page title: ' + title);
    console.log('URL: ' + page.url());
  }

  await browser.close();
}

run().catch(e => console.error(e));
