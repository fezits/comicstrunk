const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

// Try direct product pages on Newpop
const products = [
  { slug: 'made-in-abyss-09', id: 'cmo776y2i05jpaj8jooy86il3', title: 'Made in Abyss 09' },
  { slug: 'mushishi-04', id: 'cmo776y7506liaj8j9zk3cprr', title: 'Mushishi 4' },
  { slug: 'madk-02', id: 'cmo776y9q078qaj8jeom5su5h', title: 'MADK 2' },
  { slug: 'perfect-world-05', id: 'cmo776y6e06h2aj8jy37j6qrd', title: 'Perfect World 05' },
  { slug: 'no-6-vol-01', id: 'cmo776y7h06owaj8j6zospyry', title: 'No 6 1' },
];

async function run() {
  const browser = await pw.chromium.launch({ headless: true });

  for (const p of products) {
    // Try various URL patterns
    const urls = [
      'https://www.newpop.com.br/produto/' + p.slug + '/',
      'https://www.newpop.com.br/loja/' + p.slug + '/',
      'https://www.newpop.com.br/' + p.slug + '/',
    ];

    let found = false;
    for (const url of urls) {
      const page = await browser.newPage();
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        if (resp && resp.status() === 200) {
          const images = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img'))
              .filter(img => (img.src || '').includes('wp-content/uploads'))
              .map(img => ({ src: img.src.split('?')[0], alt: img.alt, w: img.naturalWidth }));
          });

          if (images.length > 0) {
            console.log(p.title + ' -> FOUND at ' + url);
            console.log('  Image: ' + images[0].src);
            found = true;
            await page.close();
            break;
          }
        }
      } catch {}
      await page.close();
    }

    if (!found) {
      console.log(p.title + ' -> NOT FOUND on Newpop site');
    }
  }

  await browser.close();
}

run().catch(e => console.error(e));
