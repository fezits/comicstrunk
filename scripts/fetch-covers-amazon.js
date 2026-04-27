// Fetch missing covers from Amazon by searching title + publisher
// Uses Playwright to scrape Amazon search results

const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const titles = [
  'Made in Abyss 09 Newpop',
  'Mushishi 4 Newpop',
  'No 6 manga 1 Newpop',
  'MADK 2 Newpop manga',
  'Casa do Sol 3 manga Newpop',
  'Perfect World 05 manga Newpop',
  'Mo Dao Zu Shi Livro 2 Newpop',
  'Toradora Novel 07 Newpop',
  'Navillera Como Uma Borboleta 2 Newpop',
];

async function searchAmazon(browser, query) {
  const page = await browser.newPage();
  try {
    await page.goto('https://www.amazon.com.br/s?k=' + encodeURIComponent(query), {
      waitUntil: 'networkidle', timeout: 20000,
    });
    await page.waitForTimeout(3000);

    const results = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
      for (const card of Array.from(cards).slice(0, 3)) {
        const img = card.querySelector('img.s-image');
        const title = card.querySelector('h2 a span');
        if (img && title) {
          items.push({
            title: title.textContent.trim(),
            image: img.src,
          });
        }
      }
      return items;
    });

    return results;
  } catch {
    return [];
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await pw.chromium.launch({ headless: true });

  for (const query of titles) {
    console.log('Search: ' + query);
    const results = await searchAmazon(browser, query);
    if (results.length > 0) {
      console.log('  Found: ' + results[0].title);
      console.log('  Image: ' + results[0].image);
    } else {
      console.log('  No results');
    }
    console.log('');
  }

  await browser.close();
}

run().catch(e => console.error(e));
