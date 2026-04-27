const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const searchTerm = process.argv[2] || 'dragon ball';

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Intercept API responses
  const products = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('catalog_system/pub/products/search') || url.includes('intelligent-search/product_search')) {
      try {
        const json = await response.json();
        const items = Array.isArray(json) ? json : json.products || [];
        for (const p of items) {
          const id = p.productId;
          if (products.find(x => x.id === id)) continue;
          const sku = (p.items || [])[0] || {};
          const img = (sku.images || [])[0];
          const imgUrl = img ? img.imageUrl.split('?')[0] : '';
          const isPlaceholder = imgUrl.includes('indisponivel');
          products.push({
            id,
            name: p.productName,
            brand: p.brand,
            img: isPlaceholder ? '' : imgUrl,
            desc: (p.description || '').replace(/<[^>]*>/g, '').slice(0, 150),
          });
        }
      } catch {}
    }
  });

  console.log('Searching Rika for: "' + searchTerm + '"...');
  await page.goto('https://www.rika.com.br/' + encodeURIComponent(searchTerm) + '?map=ft&_from=0&_to=49', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Scroll to load more
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
  }

  console.log('Found ' + products.length + ' products:\n');
  for (const p of products) {
    console.log(p.name + ' | ' + p.brand + ' | img:' + (p.img ? 'YES' : 'NO') + ' | rika:' + p.id);
  }

  await browser.close();
}

run().catch(e => console.error(e));
