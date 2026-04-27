const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const searchTerm = process.argv[2] || 'dragon ball';

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Searching Panini for: "' + searchTerm + '"...');
  await page.goto('https://panini.com.br/' + encodeURIComponent(searchTerm) + '?_q=' + encodeURIComponent(searchTerm) + '&map=ft', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Scroll to load all products
  let lastCount = 0;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const count = await page.evaluate(() => document.querySelectorAll('img').length);
    if (count === lastCount) break;
    lastCount = count;
  }

  // Extract from __NEXT_DATA__ or window.__STATE__
  const stateData = await page.evaluate(() => {
    // Try VTEX runtime state
    const stateEl = document.querySelector('script#__STATE__');
    if (stateEl) return { type: 'state', data: stateEl.textContent.slice(0, 5000) };

    // Try Next.js data
    const nextEl = document.querySelector('script#__NEXT_DATA__');
    if (nextEl) return { type: 'next', data: nextEl.textContent.slice(0, 5000) };

    return { type: 'none', data: '' };
  });
  console.log('State type: ' + stateData.type);

  // Extract visible products from rendered DOM
  const products = await page.evaluate(() => {
    const results = [];
    // Get all links that look like product pages
    const links = document.querySelectorAll('a');
    for (const a of links) {
      const href = a.href || '';
      if (!href.includes('/p') || href.includes('?')) continue;

      const img = a.querySelector('img');
      const nameEl = a.querySelector('span, h2, h3, [class*="name"], [class*="Name"]');

      if (nameEl && nameEl.textContent.trim().length > 3) {
        const name = nameEl.textContent.trim();
        if (results.find(r => r.name === name)) continue;
        results.push({
          name,
          url: href,
          image: img ? (img.src || img.dataset.src || '') : '',
        });
      }
    }
    return results;
  });

  console.log('\nFound ' + products.length + ' products from DOM:\n');
  for (const p of products) {
    // Extract SKU from URL
    const match = p.url.match(/\/([A-Z0-9]+)\/p$/i) || p.url.match(/([A-Z]+\d+[A-Z]*\d*)\/p$/i);
    console.log(p.name);
    console.log('  URL: ' + p.url);
    console.log('  Image: ' + (p.image && !p.image.includes('data:') ? p.image.split('?')[0] : 'NO'));
    console.log('  SKU: ' + (match ? match[1] : 'N/A'));
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
