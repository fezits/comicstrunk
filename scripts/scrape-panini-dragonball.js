const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading Panini Dragon Ball category...');
  await page.goto('https://panini.com.br/planet-manga/dragon-ball', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Scroll to load all products
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
  }

  // Extract all products from the page
  const products = await page.evaluate(() => {
    const results = [];
    // Try multiple selectors
    const allImgs = document.querySelectorAll('img');
    const seen = new Set();

    for (const img of allImgs) {
      const src = img.src || '';
      const alt = img.alt || '';
      if (!src.includes('panini.com.br') || src.includes('logo') || src.includes('icon') || src.length < 50) continue;
      if (seen.has(alt)) continue;
      if (alt.length < 5) continue;
      seen.add(alt);

      // Find nearest link
      const link = img.closest('a');

      results.push({
        name: alt,
        image: src.split('?')[0],
        url: link ? link.href : '',
      });
    }
    return results;
  });

  // Filter to Dragon Ball related
  const dbProducts = products.filter(p =>
    p.name.toLowerCase().includes('dragon ball') ||
    p.name.toLowerCase().includes('dragon ball super')
  );

  console.log('Total images: ' + products.length);
  console.log('Dragon Ball: ' + dbProducts.length + '\n');

  for (const p of dbProducts) {
    // Check image size
    console.log(p.name);
    console.log('  Image: ' + p.image);
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
