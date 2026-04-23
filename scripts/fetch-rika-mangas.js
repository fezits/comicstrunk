// Fetch manga data from Rika with rate limit handling
// Uses delays between requests and proper headers

const fs = require('fs');
const path = require('path');

const DELAY_MS = 3000; // 3 seconds between requests
const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.rika.com.br/',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

const CATEGORIES = [
  'Mangas/Shounen',
  'Mangas/Shoujo',
  'Mangas/Seinen',
  'Mangas/Acao',
  'Mangas/Aventura-e-Fantasia',
  'Mangas/Drama',
  'Mangas/Comedia',
  'Mangas/Romance',
  'Mangas/Suspense-e-Terror',
  'Mangas/Ficcao',
  'Mangas/Outras-Categorias',
  'Mangas/Novel',
  'Mangas/ETC',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(category, from, to) {
  const url = `https://www.rika.com.br/api/catalog_system/pub/products/search/${category}?_from=${from}&_to=${to}&O=OrderByReleaseDateDESC`;

  const resp = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (resp.status === 429 || resp.status === 403) {
    return { blocked: true, data: [] };
  }

  const text = await resp.text();
  if (text.includes('Bad Request') || text.includes('Scripts are not allowed')) {
    return { blocked: true, data: [] };
  }

  try {
    const data = JSON.parse(text);
    return { blocked: false, data: Array.isArray(data) ? data : [] };
  } catch {
    return { blocked: true, data: [] };
  }
}

function parseProduct(product) {
  const sku = product.items?.[0];
  if (!sku) return null;

  const img = sku.images?.[0]?.imageUrl?.split('?')[0] || '';
  const isPlaceholder = img.includes('indisponivel') || img.length < 20;
  const desc = (product.description || '').replace(/<[^>]*>/g, '').trim();
  const dateMatch = desc.match(/publica..o:\s*(\d+)\/(\d+)/);
  const pageMatch = desc.match(/(\d+)\s*p.ginas/);

  return {
    sourceKey: 'rika:' + product.productId,
    title: product.productName,
    publisher: product.brand || '',
    publishYear: dateMatch ? parseInt(dateMatch[2]) : null,
    publishMonth: dateMatch ? parseInt(dateMatch[1]) : null,
    pageCount: pageMatch ? parseInt(pageMatch[1]) : null,
    coverImageUrl: isPlaceholder ? '' : img,
    description: desc.slice(0, 300),
  };
}

async function run() {
  console.log('=== RIKA MANGA FETCHER ===\n');
  console.log('Using ' + DELAY_MS + 'ms delay between requests\n');

  const allProducts = [];
  let blocked = false;

  for (const category of CATEGORIES) {
    if (blocked) break;

    console.log('Category: ' + category);
    let from = 0;
    const pageSize = 50;
    let categoryCount = 0;

    while (true) {
      const to = from + pageSize - 1;
      const result = await fetchPage(category, from, to);

      if (result.blocked) {
        console.log('  BLOCKED at page ' + from + '. Waiting 30s...');
        await sleep(30000);
        // Try once more
        const retry = await fetchPage(category, from, to);
        if (retry.blocked) {
          console.log('  Still blocked. Stopping.');
          blocked = true;
          break;
        }
        result.data = retry.data;
      }

      if (result.data.length === 0) break;

      for (const product of result.data) {
        const parsed = parseProduct(product);
        if (parsed && !allProducts.find(p => p.sourceKey === parsed.sourceKey)) {
          allProducts.push(parsed);
          categoryCount++;
        }
      }

      from += pageSize;
      await sleep(DELAY_MS);
    }

    console.log('  Fetched: ' + categoryCount + ' products (total: ' + allProducts.length + ')');
    await sleep(DELAY_MS);
  }

  console.log('\n=== RESULTS ===');
  console.log('Total manga products fetched: ' + allProducts.length);

  // Save to JSON for comparison
  const outputPath = path.join(__dirname, '..', 'docs', 'rika-mangas-raw.json');
  fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
  console.log('Saved to: docs/rika-mangas-raw.json');

  // Stats
  const withImage = allProducts.filter(p => p.coverImageUrl).length;
  const publishers = {};
  allProducts.forEach(p => { publishers[p.publisher] = (publishers[p.publisher] || 0) + 1; });

  console.log('\nWith image: ' + withImage + '/' + allProducts.length);
  console.log('\nTop publishers:');
  Object.entries(publishers).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([pub, count]) => {
    console.log('  ' + pub + ': ' + count);
  });
}

run().catch(e => console.error('FATAL:', e));
