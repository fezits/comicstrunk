const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading Panini Dragon Ball...');
  await page.goto('https://panini.com.br/planet-manga/dragon-ball?product_list_limit=48', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Slowly scroll to trigger lazy loading
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let pos = 0; pos < totalHeight; pos += 300) {
    await page.evaluate((y) => window.scrollTo(0, y), pos);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);

  // Now extract images - get data-src or real src
  const products = await page.evaluate(() => {
    const results = [];
    const imgs = document.querySelectorAll('img.product-image-photo');
    for (const img of imgs) {
      const src = img.getAttribute('data-original') || img.getAttribute('data-src') || img.src || '';
      const alt = img.alt || '';
      if (alt && !results.find(r => r.name === alt)) {
        results.push({ name: alt, image: src });
      }
    }

    // Also try any img with dragon ball in alt
    const allImgs = document.querySelectorAll('img');
    for (const img of allImgs) {
      const alt = img.alt || '';
      const src = img.getAttribute('data-original') || img.getAttribute('data-src') || img.src || '';
      if (alt.toLowerCase().includes('dragon ball') && !results.find(r => r.name === alt) && !src.includes('loader')) {
        results.push({ name: alt, image: src });
      }
    }

    return results;
  });

  // Filter real images (not loaders, not tiny)
  console.log('Products found: ' + products.length + '\n');
  for (const p of products) {
    const isReal = p.image && !p.image.includes('loader') && !p.image.includes('placeholder') && p.image.length > 50;
    console.log(p.name);
    console.log('  ' + (isReal ? p.image.split('?')[0] : 'NO REAL IMAGE'));
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
