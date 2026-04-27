const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const searches = [
  { title: 'Made in Abyss 09', id: 'cmo776y2i05jpaj8jooy86il3' },
  { title: 'Mushishi 4', id: 'cmo776y7506liaj8j9zk3cprr' },
  { title: 'MADK 2', id: 'cmo776y9q078qaj8jeom5su5h' },
  { title: 'No 6 manga 1', id: 'cmo776y7h06owaj8j6zospyry' },
  { title: 'Casa do Sol 3', id: 'cmo776y7t06szaj8jkzmwzpi9' },
];

async function run() {
  const browser = await pw.chromium.launch({ headless: true });

  for (const s of searches) {
    console.log('Search: ' + s.title);
    const page = await browser.newPage();

    try {
      await page.goto('https://www.newpop.com.br/?s=' + encodeURIComponent(s.title), {
        waitUntil: 'networkidle', timeout: 20000,
      });
      await page.waitForTimeout(3000);

      const products = await page.evaluate(() => {
        const items = [];
        const imgs = document.querySelectorAll('img');
        for (const img of imgs) {
          const src = img.src || img.dataset.src || img.dataset.lazySrc || '';
          const alt = img.alt || '';
          if (src && src.includes('wp-content/uploads') && alt.length > 3) {
            items.push({ src: src.split('?')[0], alt });
          }
        }
        return items;
      });

      if (products.length > 0) {
        console.log('  Found: ' + products[0].alt);
        console.log('  Image: ' + products[0].src);
      } else {
        const title = await page.title();
        console.log('  No products. Page: ' + title);
      }
    } catch (e) {
      console.log('  Error: ' + e.message.slice(0, 80));
    }

    await page.close();
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
