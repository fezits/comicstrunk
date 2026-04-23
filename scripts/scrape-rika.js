const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

async function scrapeRika(searchTerm) {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Searching Rika for: "' + searchTerm + '"...\n');
  await page.goto('https://www.rika.com.br/' + encodeURIComponent(searchTerm) + '?map=ft', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  await page.waitForTimeout(3000);

  // Extract product data from the page
  const products = await page.evaluate(() => {
    const items = [];
    // VTEX stores embed product data in script tags or data attributes
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'ItemList' && data.itemListElement) {
          for (const item of data.itemListElement) {
            items.push({
              name: item.name,
              url: item.url,
              image: item.image,
            });
          }
        }
      } catch {}
    }

    // Also try extracting from the rendered HTML
    const productCards = document.querySelectorAll('[class*="product"], .vtex-product-summary');
    for (const card of productCards) {
      const nameEl = card.querySelector('[class*="productName"], [class*="name"], h2, h3');
      const imgEl = card.querySelector('img');
      const linkEl = card.querySelector('a[href*="/p"]');
      if (nameEl) {
        items.push({
          name: nameEl.textContent.trim(),
          url: linkEl ? linkEl.href : '',
          image: imgEl ? imgEl.src : '',
        });
      }
    }

    return items;
  });

  if (products.length === 0) {
    // Try intercepting VTEX API calls
    console.log('No products from HTML, trying to intercept API...');

    // Navigate again but intercept network
    const apiData = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/catalog_system/pub/products/search') ||
          url.includes('/api/io/_v/api/intelligent-search')) {
        try {
          const data = await response.json();
          if (Array.isArray(data)) {
            for (const p of data) {
              apiData.push({
                id: p.productId,
                name: p.productName,
                brand: p.brand,
                image: p.items?.[0]?.images?.[0]?.imageUrl || '',
                description: (p.description || '').replace(/<[^>]*>/g, '').slice(0, 200),
              });
            }
          }
        } catch {}
      }
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    if (apiData.length > 0) {
      console.log('Intercepted ' + apiData.length + ' products from API:\n');
      for (const p of apiData) {
        console.log(p.name);
        console.log('  ID: ' + p.id + ' | Publisher: ' + p.brand);
        console.log('  Image: ' + (p.image ? 'YES' : 'NO'));
        console.log('');
      }
    } else {
      // Last resort: get page title and any visible text
      const title = await page.title();
      console.log('Page title: ' + title);
      const text = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.log('Page text: ' + text.slice(0, 500));
    }
  } else {
    console.log('Found ' + products.length + ' products:\n');
    for (const p of products) {
      console.log(p.name);
      console.log('  URL: ' + p.url);
      console.log('  Image: ' + (p.image ? 'YES' : 'NO'));
      console.log('');
    }
  }

  await browser.close();
}

scrapeRika(process.argv[2] || 'guerra dos tronos').catch(e => console.error(e));
