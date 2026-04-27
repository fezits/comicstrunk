// Fetch remaining Rika categories not yet imported
// Categories already imported: Super-herois, Mangas

const fs = require('fs');
const path = require('path');

const DELAY_MS = 2000;
const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const CATEGORIES = [
  // Bonelli
  'Bonelli/Tex',
  'Bonelli/Ken-Parker',
  'Bonelli/Magico-Vento',
  'Bonelli/Martin-Mystere',
  'Bonelli/Zagor',
  'Bonelli/Dylan-Dog',
  'Bonelli/Outras-Publicacoes-Bonelli',
  'Bonelli/Aventuras-de-Uma-Criminologa',
  // ETC
  'ETC/HQs-Autorais-Estrangeiras',
  'ETC/HQs-Autorais-Brasileiras',
  'ETC/Humor',
  'ETC/Independentes',
  'ETC/Fanzines',
  'ETC/Quadrinhos-Eroticos',
  'ETC/Literatura-Geek',
  // Infanto-Juvenis
  'Infanto-Juvenis/Turma-da-Monica',
  'Infanto-Juvenis/Disney',
  'Infanto-Juvenis/Cartoons---TV',
  // Raridades
  'Raridades/Aventura',
  'Raridades/DC-Comics',
  'Raridades/Faroeste',
  'Raridades/Infanto-Juvenis',
  'Raridades/Marvel-Comics',
  'Raridades/Publicacoes-Diversas',
  'Raridades/Revistas-Classicas',
  'Raridades/Terror',
  'Raridades/King-Comics',
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
  const url = `https://www.rika.com.br/api/catalog_system/pub/products/search/${category}?_from=${from}&_to=${to}&O=OrderByReleaseDateDESC`;
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    const text = await resp.text();
    if (text.includes('Bad Request') || text.includes('Scripts are not allowed')) {
      return { blocked: true, data: [] };
    }
    const data = JSON.parse(text);
    return { blocked: false, data: Array.isArray(data) ? data : [] };
  } catch {
    return { blocked: true, data: [] };
  }
}

async function run() {
  console.log('=== RIKA REMAINING CATEGORIES ===\n');
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
        console.log('  BLOCKED. Waiting 30s...');
        await sleep(30000);
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

    console.log('  Fetched: ' + categoryCount + ' (total: ' + allProducts.length + ')');
    await sleep(DELAY_MS);
  }

  console.log('\n=== RESULTS ===');
  console.log('Total products: ' + allProducts.length);

  const withImage = allProducts.filter(p => p.coverImageUrl).length;
  console.log('With image: ' + withImage);

  const publishers = {};
  allProducts.forEach(p => { publishers[p.publisher] = (publishers[p.publisher] || 0) + 1; });
  console.log('\nTop publishers:');
  Object.entries(publishers).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([pub, count]) => {
    console.log('  ' + pub + ': ' + count);
  });

  const outputPath = '/home/ferna5257/rika-remaining-raw.json';
  fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
  console.log('\nSaved to: ' + outputPath);
}

run().catch(e => console.error('FATAL:', e));
