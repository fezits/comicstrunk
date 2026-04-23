const fs = require('fs');
const DELAY_MS = 2000;
const HEADERS = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };

const CATEGORIES = [
  'Importados/Gibis-em-ingles---DC',
  'Importados/Gibis-em-ingles---Marvel',
  'Importados/Gibis-em-ingles---Image',
  'Importados/Gibis-em-ingles---Vertigo',
  'Importados/Gibis-em-ingles-–-ETC',
  'Importados/Outros-Paises',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function fetchPage(category, from, to) {
  const url = 'https://www.rika.com.br/api/catalog_system/pub/products/search/' + category + '?_from=' + from + '&_to=' + to + '&O=OrderByReleaseDateDESC';
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    const text = await resp.text();
    if (text.includes('Bad Request') || text.includes('Scripts')) return { blocked: true, data: [] };
    const data = JSON.parse(text);
    return { blocked: false, data: Array.isArray(data) ? data : [] };
  } catch { return { blocked: true, data: [] }; }
}

async function run() {
  console.log('=== RIKA IMPORTADOS ===\n');
  const allProducts = [];
  let blocked = false;

  for (const category of CATEGORIES) {
    if (blocked) break;
    console.log('Category: ' + category);
    let from = 0;
    let categoryCount = 0;

    while (true) {
      const to = from + 49;
      const result = await fetchPage(category, from, to);
      if (result.blocked) {
        console.log('  BLOCKED. Waiting 30s...');
        await sleep(30000);
        const retry = await fetchPage(category, from, to);
        if (retry.blocked) { blocked = true; break; }
        result.data = retry.data;
      }
      if (result.data.length === 0) break;
      for (const p of result.data) {
        const parsed = parseProduct(p);
        if (parsed && !allProducts.find(x => x.sourceKey === parsed.sourceKey)) {
          allProducts.push(parsed);
          categoryCount++;
        }
      }
      from += 50;
      await sleep(DELAY_MS);
    }
    console.log('  Fetched: ' + categoryCount + ' (total: ' + allProducts.length + ')');
    await sleep(DELAY_MS);
  }

  console.log('\n=== RESULTS ===');
  console.log('Total: ' + allProducts.length);
  console.log('With image: ' + allProducts.filter(p => p.coverImageUrl).length);

  fs.writeFileSync('/home/ferna5257/rika-importados-raw.json', JSON.stringify(allProducts, null, 2));
  console.log('Saved to /home/ferna5257/rika-importados-raw.json');
}

run().catch(e => console.error(e));
