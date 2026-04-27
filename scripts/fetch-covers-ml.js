const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'newpop-covers');

const entries = [
  { id: 'cmo776y2i05jpaj8jooy86il3', title: 'Made in Abyss # 09', search: 'Made in Abyss 9 Newpop manga' },
  { id: 'cmo776y7506liaj8j9zk3cprr', title: 'Mushishi # 4', search: 'Mushishi 4 Newpop manga' },
  { id: 'cmo776y7506ljaj8jzrguldlv', title: 'Mushishi # 5', search: 'Mushishi 5 Newpop manga' },
  { id: 'cmo776y9q078qaj8jeom5su5h', title: 'MADK # 2', search: 'MADK 2 Newpop manga' },
  { id: 'cmo776y9q078raj8j84quhiew', title: 'MADK # 3', search: 'MADK 3 Newpop manga' },
  { id: 'cmo776y7h06owaj8j6zospyry', title: 'No 6 # 1', search: 'No 6 vol 1 manga Newpop' },
  { id: 'cmo776y7h06oxaj8jg2j18iec', title: 'No 6 # 2', search: 'No 6 vol 2 manga Newpop' },
  { id: 'cmo776y7h06oyaj8jdry1okle', title: 'No 6 # 3', search: 'No 6 vol 3 manga Newpop' },
  { id: 'cmo776y7h06ozaj8j2283miaa', title: 'No 6 # 4', search: 'No 6 vol 4 manga Newpop' },
  { id: 'cmo776y7i06p0aj8jlouvyqo0', title: 'No 6 # 5', search: 'No 6 vol 5 manga Newpop' },
  { id: 'cmo776y6e06h2aj8jy37j6qrd', title: 'Perfect World # 05', search: 'Perfect World 5 Newpop manga' },
  { id: 'cmo776y6e06h3aj8jtcok4z8c', title: 'Perfect World # 06', search: 'Perfect World 6 Newpop manga' },
  { id: 'cmo776y7t06szaj8jkzmwzpi9', title: 'Casa do Sol # 3', search: 'Casa do Sol 3 manga Newpop' },
  { id: 'cmo776y7t06t0aj8jdicv1wlk', title: 'Casa do Sol # 4', search: 'Casa do Sol 4 manga Newpop' },
  { id: 'cmo776y9q078naj8j7q3999wm', title: 'Navillera # 2', search: 'Navillera 2 manga Newpop' },
  { id: 'cmo776y9q078oaj8j819dz26c', title: 'Navillera # 3', search: 'Navillera 3 manga Newpop' },
  { id: 'cmo776ycc07vyaj8jiwif7elu', title: 'Mo Dao Zu Shi Livro 2', search: 'Mo Dao Zu Shi 2 novel Newpop' },
  { id: 'cmo776ycc07vxaj8j7zwhi88s', title: 'Mo Dao Zu Shi Livro 3', search: 'Mo Dao Zu Shi 3 novel Newpop' },
  { id: 'cmo776ycc07vwaj8jhova9z9w', title: 'Mo Dao Zu Shi Livro 4', search: 'Mo Dao Zu Shi 4 novel Newpop' },
  { id: 'cmo776ycc07vvaj8jd31yxqt8', title: 'Mo Dao Zu Shi Livro 5', search: 'Mo Dao Zu Shi 5 novel Newpop' },
];

async function searchML(browser, query) {
  const page = await browser.newPage();
  try {
    await page.goto('https://lista.mercadolivre.com.br/' + encodeURIComponent(query), {
      waitUntil: 'networkidle', timeout: 20000,
    });
    await page.waitForTimeout(3000);

    const img = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img.poly-component__picture');
      if (imgs.length > 0) return imgs[0].src;
      // Fallback
      const allImgs = document.querySelectorAll('img');
      for (const img of allImgs) {
        if (img.src && img.src.includes('http2.mlstatic.com') && img.naturalWidth > 100) {
          return img.src;
        }
      }
      return null;
    });

    await page.close();

    if (img) {
      // Get large version: replace size in URL
      return img.replace(/-[A-Z]\.jpg/, '-F.jpg').replace(/\d+x\d+/, '2000x2000');
    }
    return null;
  } catch {
    await page.close();
    return null;
  }
}

async function download(url, filename) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 3000) return null;

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
  console.log('=== MERCADO LIVRE COVER SEARCH ===\n');
  const browser = await pw.chromium.launch({ headless: true });
  const found = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write('[' + (i+1) + '/' + entries.length + '] ' + entry.title + '... ');

    const imgUrl = await searchML(browser, entry.search);
    if (imgUrl) {
      const filename = 'newpop-' + entry.id.slice(-8) + '.jpg';
      const size = await download(imgUrl, filename);
      if (size) {
        console.log('OK (' + Math.round(size/1024) + 'KB)');
        found.push({ ...entry, filename });
      } else {
        console.log('DOWNLOAD FAILED');
      }
    } else {
      console.log('NOT FOUND');
    }
  }

  await browser.close();

  console.log('\n=== RESULTS ===');
  console.log('Found: ' + found.length + '/' + entries.length);

  if (found.length > 0) {
    const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
    let manifest = [];
    if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // Add only new ones
    for (const f of found) {
      if (!manifest.find(m => m.id === f.id)) manifest.push(f);
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Manifest: ' + manifest.length + ' total covers');
  }
}

run().catch(e => console.error(e));
