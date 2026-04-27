const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const productUrls = [
  'https://www.rika.com.br/guerra-dos-tronos---volume-119002925/p',
  'https://www.rika.com.br/guerra-dos-tronos---volume-219002926/p',
  'https://www.rika.com.br/guerra-dos-tronos---volume-319002927/p',
  'https://www.rika.com.br/guerra-dos-tronos---volume-419003355/p',
];

async function scrapeProduct(browser, url) {
  const page = await browser.newPage();
  const apiData = {};

  // Intercept VTEX API calls to get structured data
  page.on('response', async (response) => {
    const rUrl = response.url();
    if (rUrl.includes('/api/catalog_system/pub/products/search') && !apiData.id) {
      try {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const p = data[0];
          apiData.id = p.productId;
          apiData.title = p.productName;
          apiData.brand = p.brand;
          apiData.description = (p.description || '').replace(/<[^>]*>/g, '').trim();
          apiData.image = p.items?.[0]?.images?.[0]?.imageUrl?.split('?')[0] || '';
        }
      } catch {}
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // If API intercept didn't work, extract from page
  if (!apiData.id) {
    const ldJson = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const d = JSON.parse(s.textContent);
          if (d['@type'] === 'Product') return d;
        } catch {}
      }
      return null;
    });

    if (ldJson) {
      apiData.title = ldJson.name;
      apiData.brand = ldJson.brand?.name;
      apiData.description = ldJson.description;
      apiData.image = ldJson.image;
      apiData.id = url.match(/(\d+)\/p$/)?.[1] || '';
    }
  }

  // Parse date and pages from description
  const desc = apiData.description || '';
  const dateMatch = desc.match(/publica..o:\s*(\d+)\/(\d+)/);
  const pageMatch = desc.match(/(\d+)\s*p.ginas/);
  apiData.publishYear = dateMatch ? parseInt(dateMatch[2]) : null;
  apiData.publishMonth = dateMatch ? parseInt(dateMatch[1]) : null;
  apiData.pageCount = pageMatch ? parseInt(pageMatch[1]) : null;

  await page.close();
  return apiData;
}

async function run() {
  const browser = await pw.chromium.launch({ headless: true });

  console.log('=== GUERRA DOS TRONOS — Detalhes ===\n');

  for (const url of productUrls) {
    const data = await scrapeProduct(browser, url);
    console.log(data.title || 'UNKNOWN');
    console.log('  ID: ' + (data.id || 'N/A'));
    console.log('  Publisher: ' + (data.brand || 'N/A'));
    console.log('  Date: ' + (data.publishYear ? data.publishMonth + '/' + data.publishYear : 'N/A'));
    console.log('  Pages: ' + (data.pageCount || 'N/A'));
    console.log('  Image: ' + (data.image || 'NONE'));
    console.log('  SourceKey: rika:' + data.id);
    console.log('');
  }

  await browser.close();
  console.log('Done!');
}

run().catch(e => console.error(e));
