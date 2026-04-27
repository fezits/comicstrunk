const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'newpop-covers');

// Entries still missing after direct URL attempt
const missing = [
  { id: 'cmo776y7t06szaj8jkzmwzpi9', title: 'Casa do Sol 3', search: 'casa do sol' },
  { id: 'cmo776y2i05jpaj8jooy86il3', title: 'Made in Abyss 09', search: 'made in abyss' },
  { id: 'cmo776y9q078qaj8jeom5su5h', title: 'MADK 2', search: 'madk' },
  { id: 'cmo776y9q078raj8j84quhiew', title: 'MADK 3', search: 'madk' },
  { id: 'cmo776y7506liaj8j9zk3cprr', title: 'Mushishi 4', search: 'mushishi' },
  { id: 'cmo776y7506ljaj8jzrguldlv', title: 'Mushishi 5', search: 'mushishi' },
  { id: 'cmo776y7h06owaj8j6zospyry', title: 'No 6 # 1', search: 'no 6' },
  { id: 'cmo776y6e06h2aj8jy37j6qrd', title: 'Perfect World 05', search: 'perfect world' },
  { id: 'cmo776y9q078naj8j7q3999wm', title: 'Navillera 2', search: 'navillera' },
  { id: 'cmo776ycc07vyaj8jiwif7elu', title: 'Mo Dao Zu Shi Livro 2', search: 'mo dao zu shi' },
  { id: 'cmo776ycb07u9aj8ja7tdz5dq', title: 'Fireworks', search: 'fireworks' },
  { id: 'cmo776y4q063taj8jn75f4ndh', title: 'Loveless 07', search: 'loveless' },
  { id: 'cmo776ya107b9aj8jl22409n7', title: 'The Hellbound 2', search: 'hellbound' },
  { id: 'cmo776yad07ffaj8jbjswkd3b', title: 'Seven Days 2', search: 'seven days' },
  { id: 'cmo776ycb07u0aj8j5po6osji', title: 'Toradora Vol 07', search: 'toradora' },
  { id: 'cmo776y7s06rgaj8jzol8hz81', title: 'No Cafe Kichijouji 4', search: 'kichijouji' },
  { id: 'cmo776y8406u0aj8jt2h78gum', title: 'Jovens Sagrados 04', search: 'jovens sagrados' },
  { id: 'cmo776yad07fjaj8jy69zfwty', title: 'Unico Destino dos Viloes 02', search: 'unico destino' },
];

async function searchShop(browser, searchTerm, targetTitle) {
  const page = await browser.newPage();
  try {
    await page.goto('https://www.lojanewpop.com.br/busca?q=' + encodeURIComponent(searchTerm), {
      waitUntil: 'networkidle', timeout: 20000,
    });
    await page.waitForTimeout(3000);

    // Scroll to load images
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(2000);

    // Get product images
    const products = await page.evaluate(() => {
      const items = [];
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.src || img.dataset.src || '';
        const alt = img.alt || '';
        if (src.includes('cdn.awsli.com.br') && src.includes('produto') && alt.length > 2) {
          // Get large version
          const largeSrc = src.replace('/300x300/', '/2000x2000/').replace('/600x600/', '/2000x2000/');
          items.push({ alt, src: largeSrc.split('?')[0] });
        }
      }
      return items;
    });

    await page.close();
    return products;
  } catch {
    await page.close();
    return [];
  }
}

async function download(url, filename) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 5000) return null;

    const sharpPath = path.join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp');
    const sharp = require(sharpPath);
    const outputPath = path.join(OUTPUT_DIR, filename);
    await sharp(buffer)
      .resize(600, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    return fs.statSync(outputPath).size;
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== NEWPOP SHOP SEARCH ===\n');
  const browser = await pw.chromium.launch({ headless: true });
  const found = [];

  // Group by search term to avoid duplicate searches
  const searchGroups = new Map();
  for (const entry of missing) {
    if (!searchGroups.has(entry.search)) searchGroups.set(entry.search, []);
    searchGroups.get(entry.search).push(entry);
  }

  for (const [term, entries] of searchGroups) {
    console.log('Search: "' + term + '" (' + entries.length + ' entries)');
    const products = await searchShop(browser, term, '');

    if (products.length === 0) {
      console.log('  No products found\n');
      continue;
    }

    console.log('  Found ' + products.length + ' products:');
    products.forEach(p => console.log('    ' + p.alt));

    // Match products to entries
    for (const entry of entries) {
      // Find best matching product
      const match = products[0]; // Take first result for the search group
      if (match) {
        const filename = 'newpop-' + entry.id.slice(-8) + '.jpg';
        const size = await download(match.src, filename);
        if (size) {
          console.log('  -> ' + entry.title + ': OK (' + Math.round(size/1024) + 'KB)');
          found.push({ ...entry, filename, imgUrl: match.src });
        } else {
          console.log('  -> ' + entry.title + ': download failed');
        }
      }
    }
    console.log('');
  }

  await browser.close();

  console.log('=== RESULTS ===');
  console.log('Found: ' + found.length + '/' + missing.length);

  if (found.length > 0) {
    // Append to manifest
    const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
    let manifest = [];
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    manifest.push(...found);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Manifest updated: ' + manifest.length + ' total covers');
  }
}

run().catch(e => console.error(e));
