const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const searchTerm = process.argv[2] || 'dragon ball super';

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Searching Panini for: "' + searchTerm + '"...\n');
  await page.goto('https://panini.com.br/' + encodeURIComponent(searchTerm) + '?_q=' + encodeURIComponent(searchTerm) + '&map=ft', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Extract product data from search results
  const products = await page.evaluate(() => {
    const items = [];
    // Try LD+JSON
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent);
        if (d['@type'] === 'ItemList') {
          for (const item of (d.itemListElement || [])) {
            items.push({ name: item.name, url: item.url, image: item.image });
          }
        }
      } catch {}
    }

    // Also try HTML elements
    if (items.length === 0) {
      const cards = document.querySelectorAll('a[href*="/p"]');
      for (const card of cards) {
        const img = card.querySelector('img');
        const name = card.querySelector('[class*="Name"], [class*="name"]');
        if (img || name) {
          items.push({
            name: name ? name.textContent.trim() : '',
            url: card.href,
            image: img ? img.src : '',
          });
        }
      }
    }

    return items;
  });

  console.log('Found ' + products.length + ' products:\n');

  // Deduplicate by name
  const seen = new Set();
  for (const p of products) {
    if (!p.name || seen.has(p.name)) continue;
    seen.add(p.name);

    // Extract SKU from URL (panini URLs have SKU)
    const skuMatch = p.url?.match(/\/([A-Z0-9]+)\/p$/i);
    const sku = skuMatch ? skuMatch[1] : '';

    console.log(p.name);
    console.log('  URL: ' + (p.url || 'N/A'));
    console.log('  Image: ' + (p.image || 'N/A'));
    console.log('  SKU: ' + sku);
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
