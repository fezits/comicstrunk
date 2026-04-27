const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const searchTerm = process.argv[2] || 'dragon ball';

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept ALL network responses to capture product data
  const productMap = new Map();
  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (url.includes('intelligent-search') || url.includes('product_search') || url.includes('catalog_system')) {
        const text = await response.text();
        // Try to find product data in any JSON response
        const json = JSON.parse(text);
        const items = json.products || json.data?.products || (Array.isArray(json) ? json : []);
        for (const p of items) {
          const name = p.productName || p.name;
          const id = p.productId || p.id;
          if (!name || productMap.has(id)) continue;
          const images = p.items?.[0]?.images || p.images || [];
          const img = images[0]?.imageUrl || images[0]?.url || '';
          productMap.set(id, {
            id,
            name,
            brand: p.brand || p.brandName || '',
            sku: p.items?.[0]?.referenceId?.[0]?.Value || p.productReference || '',
            image: img.split('?')[0],
          });
        }
      }
    } catch {}
  });

  console.log('Searching Panini for: "' + searchTerm + '"...');
  await page.goto('https://panini.com.br/' + encodeURIComponent(searchTerm) + '?_q=' + encodeURIComponent(searchTerm) + '&map=ft', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Scroll to load more
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
  }

  const products = Array.from(productMap.values());
  console.log('\nFound ' + products.length + ' products via API interception:\n');

  for (const p of products) {
    console.log(p.name + ' | ' + p.brand + ' | SKU:' + p.sku + ' | img:' + (p.image ? 'YES' : 'NO'));
    if (p.image) console.log('  ' + p.image);
  }

  await browser.close();
}

run().catch(e => console.error(e));
