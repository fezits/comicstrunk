// Fetch missing covers from Google Books API using ISBN
// For entries in _without-covers.json that have ISBNs
// Google Books API is free, no auth needed, has good comic cover coverage
// Rate limit: ~1 req/sec recommended

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'docs', 'openlibrary-bulk', '_without-covers.json');
const OUTPUT = path.join(__dirname, '..', 'docs', 'openlibrary-bulk', '_recovered-covers.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchGoogleBooksCover(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&fields=items(volumeInfo/imageLinks)`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const item = data.items?.[0];
    const links = item?.volumeInfo?.imageLinks;
    if (!links) return null;
    // Prefer thumbnail -> smallThumbnail, upgrade to larger size
    let coverUrl = links.thumbnail || links.smallThumbnail || null;
    if (coverUrl) {
      // Google Books URLs can be upgraded: replace zoom=1 with zoom=3 for larger image
      coverUrl = coverUrl.replace('zoom=1', 'zoom=3').replace('&edge=curl', '');
      // Force HTTPS
      coverUrl = coverUrl.replace('http://', 'https://');
    }
    return coverUrl;
  } catch {
    return null;
  }
}

async function run() {
  if (!fs.existsSync(INPUT)) {
    console.log('Input not found: ' + INPUT);
    console.log('Run fetch-openlibrary-bulk.js first');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const withIsbn = data.filter(d => d.isbn);
  console.log('=== FETCH MISSING COVERS VIA GOOGLE BOOKS ===');
  console.log('Total without covers: ' + data.length);
  console.log('With ISBN (searchable): ' + withIsbn.length);
  console.log('');

  // Resume support
  const recovered = [];
  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < withIsbn.length; i++) {
    const entry = withIsbn[i];
    process.stdout.write(`[${i + 1}/${withIsbn.length}] ${entry.title.slice(0, 50)}... `);

    const coverUrl = await fetchGoogleBooksCover(entry.isbn);
    if (coverUrl) {
      entry.coverImageUrl = coverUrl;
      recovered.push(entry);
      found++;
      console.log('FOUND');
    } else {
      notFound++;
      console.log('NOT FOUND');
    }

    // Save progress every 100 entries
    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(OUTPUT, JSON.stringify(recovered, null, 2));
      console.log(`  --- Progress: ${found} found, ${notFound} not found ---`);
    }

    await sleep(1000); // Rate limit
  }

  // Final save
  fs.writeFileSync(OUTPUT, JSON.stringify(recovered, null, 2));

  console.log('\n=== RESULTS ===');
  console.log('Found covers: ' + found);
  console.log('Not found: ' + notFound);
  console.log('Total searchable: ' + withIsbn.length);
  console.log('Recovery rate: ' + Math.round(found / withIsbn.length * 100) + '%');
  console.log('Saved to: ' + OUTPUT);
}

run().catch(e => console.error('FATAL:', e));
