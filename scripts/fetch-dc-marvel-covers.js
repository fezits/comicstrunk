// Fetch DC/Marvel key TPBs and recent issues from League of Comic Geeks
// LOCG has public pages with cover images and issue data

const path = require('path');
const fs = require('fs');
const pw = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules', 'playwright'));

const OUTPUT = path.join(__dirname, '..', 'docs', 'dc-marvel-locg.json');

// Key TPBs/GNs to search
const SEARCHES = [
  // DC Classics
  'Batman Year One',
  'Batman The Long Halloween',
  'Batman Dark Victory',
  'Batman Hush',
  'Batman The Killing Joke',
  'Superman For All Seasons',
  'The Dark Knight Returns',
  'Watchmen',
  'Kingdom Come',
  'Batman Arkham Asylum',
  'Batman Court of Owls',
  'Batman Death of the Family',
  'All Star Superman',
  'Superman Red Son',
  'Joker by Brian Azzarello',
  // Marvel Classics
  'Spider-Man Blue',
  'Daredevil Born Again',
  'Infinity Gauntlet',
  'Marvels by Kurt Busiek',
  'Civil War Marvel',
  'House of M',
  'Old Man Logan',
  'Wolverine Enemy of the State',
  'X-Men Dark Phoenix Saga',
  'Avengers Disassembled',
  // Recent DC (2024-2026)
  'Batman 2024',
  'Detective Comics 2025',
  'Superman 2025',
  'Wonder Woman 2025',
  'Green Lantern 2025',
  'Absolute Batman',
  'Absolute Superman',
  'Absolute Wonder Woman',
  // Recent Marvel (2024-2026)
  'Amazing Spider-Man 2025',
  'Uncanny X-Men 2025',
  'Avengers 2025',
  'Wolverine 2025',
  'Venom 2025',
  'Fantastic Four 2025',
];

async function searchLOCG(browser, query) {
  const page = await browser.newPage();
  const results = [];

  try {
    await page.goto('https://leagueofcomicgeeks.com/search?keyword=' + encodeURIComponent(query), {
      waitUntil: 'networkidle', timeout: 20000,
    });
    await page.waitForTimeout(3000);

    const items = await page.evaluate(() => {
      const entries = [];
      const cards = document.querySelectorAll('.comic-cell, .search-result, [class*="comic"]');
      for (const card of cards) {
        const link = card.querySelector('a[href*="/comic/"]');
        const img = card.querySelector('img');
        const title = card.querySelector('.title, h3, h4, [class*="title"]');
        if (link || title) {
          entries.push({
            title: (title?.textContent || link?.textContent || '').trim(),
            url: link?.href || '',
            image: (img?.src || img?.dataset?.src || '').split('?')[0],
          });
        }
      }
      return entries;
    });

    // Also try LD+JSON
    const ldJson = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const d = JSON.parse(s.textContent);
          if (d.itemListElement) return d.itemListElement.map(i => ({
            title: i.name,
            url: i.url,
            image: i.image || '',
          }));
        } catch {}
      }
      return [];
    });

    results.push(...items, ...ldJson);
  } catch {}

  await page.close();

  // Deduplicate by title
  const seen = new Set();
  return results.filter(r => {
    if (!r.title || seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  }).slice(0, 5);
}

async function run() {
  console.log('=== LEAGUE OF COMIC GEEKS SEARCH ===\n');
  const browser = await pw.chromium.launch({ headless: true });
  const allResults = [];

  for (let i = 0; i < SEARCHES.length; i++) {
    const query = SEARCHES[i];
    process.stdout.write('[' + (i + 1) + '/' + SEARCHES.length + '] ' + query + '... ');

    const results = await searchLOCG(browser, query);
    if (results.length > 0) {
      console.log(results.length + ' results');
      for (const r of results.slice(0, 3)) {
        allResults.push({
          title: r.title,
          publisher: query.toLowerCase().includes('marvel') || query.toLowerCase().includes('spider') || query.toLowerCase().includes('x-men') || query.toLowerCase().includes('avengers') || query.toLowerCase().includes('wolverine') || query.toLowerCase().includes('venom') || query.toLowerCase().includes('fantastic') || query.toLowerCase().includes('infinity') || query.toLowerCase().includes('civil war') || query.toLowerCase().includes('house of m') || query.toLowerCase().includes('old man') || query.toLowerCase().includes('daredevil') || query.toLowerCase().includes('marvels') ? 'Marvel Comics' : 'DC Comics',
          coverImageUrl: r.image || '',
          url: r.url,
          searchQuery: query,
        });
      }
    } else {
      console.log('0 results');
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // Deduplicate
  const seen = new Set();
  const unique = allResults.filter(r => {
    const key = r.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log('\n=== RESULTS ===');
  console.log('Total unique: ' + unique.length);
  console.log('With image: ' + unique.filter(r => r.coverImageUrl).length);

  fs.writeFileSync(OUTPUT, JSON.stringify(unique, null, 2));
  console.log('Saved to: docs/dc-marvel-locg.json');
}

run().catch(e => console.error(e));
