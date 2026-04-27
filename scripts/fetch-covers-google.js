const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

// Sample titles to test
const searches = [
  { query: 'Made in Abyss 09 capa manga newpop', id: 'cmo776y2i05jpaj8jooy86il3' },
  { query: 'Mushishi 4 capa manga newpop', id: 'cmo776y7506liaj8j9zk3cprr' },
  { query: 'MADK 2 capa manga newpop', id: 'cmo776y9q078qaj8jeom5su5h' },
];

async function run() {
  const browser = await pw.chromium.launch({ headless: true });

  for (const s of searches) {
    console.log('Google: ' + s.query);
    const page = await browser.newPage();

    try {
      await page.goto('https://www.google.com/search?q=' + encodeURIComponent(s.query) + '&tbm=isch', {
        waitUntil: 'networkidle', timeout: 15000,
      });
      await page.waitForTimeout(3000);

      const images = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs
          .filter(img => img.src && img.src.startsWith('http') && img.naturalWidth > 50)
          .slice(0, 5)
          .map(img => ({ src: img.src, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight }));
      });

      if (images.length > 0) {
        console.log('  Found ' + images.length + ' images');
        images.slice(0, 2).forEach(img => console.log('  ' + img.w + 'x' + img.h + ' ' + img.src.slice(0, 80)));
      } else {
        console.log('  No images');
      }
    } catch (e) {
      console.log('  Error: ' + e.message);
    }

    await page.close();
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
