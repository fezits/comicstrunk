// Fetch missing Newpop covers from Open Library API
// Open Library has a free API with cover images

const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'newpop-covers');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const tsvData = fs.readFileSync(path.join(__dirname, '..', 'docs', 'newpop-missing-covers.tsv'), 'utf8');
const entries = tsvData.trim().split('\n').map(line => {
  const [id, title] = line.split('\t');
  return { id, title };
});

// Already found by direct URL script
const alreadyFound = new Set(['cmo776ybc07leaj8jup7zt49m', 'cmo776ya107b9aj8jl22409n7']);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function searchQuery(title) {
  // Clean title for search
  return title
    .replace(/\s*#\s*\d+/, '')
    .replace(/\s*\(Novel\)/, '')
    .replace(/\s*-\s*Volume\s*\d+/, '')
    .replace(/\s*Livro\s*\d+/, '')
    .trim();
}

async function searchOpenLibrary(title) {
  const query = searchQuery(title);
  const url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(query + ' newpop') + '&limit=5';

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();

    // Find best match with cover
    for (const doc of (data.docs || [])) {
      if (doc.cover_i) {
        return {
          coverId: doc.cover_i,
          olTitle: doc.title,
          url: 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg',
        };
      }
    }

    // Try without "newpop"
    const url2 = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(query) + '&limit=5';
    const resp2 = await fetch(url2, { signal: AbortSignal.timeout(10000) });
    const data2 = await resp2.json();

    for (const doc of (data2.docs || [])) {
      if (doc.cover_i) {
        return {
          coverId: doc.cover_i,
          olTitle: doc.title,
          url: 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg',
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function downloadCover(url, filename) {
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 3000) return null;

    // Compress
    try {
      const sharpPath = path.join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp');
      const sharp = require(sharpPath);
      const outputPath = path.join(OUTPUT_DIR, filename);
      await sharp(buffer)
        .resize(600, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      return fs.statSync(outputPath).size;
    } catch {
      const outputPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outputPath, buffer);
      return buffer.length;
    }
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== OPEN LIBRARY COVER SEARCH ===\n');
  const found = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (alreadyFound.has(entry.id)) {
      console.log('[' + (i+1) + '/' + entries.length + '] ' + entry.title + ' — ALREADY FOUND');
      continue;
    }

    process.stdout.write('[' + (i+1) + '/' + entries.length + '] ' + entry.title + '... ');

    const result = await searchOpenLibrary(entry.title);
    if (result) {
      const filename = 'newpop-' + entry.id.slice(-8) + '.jpg';
      const size = await downloadCover(result.url, filename);
      if (size) {
        console.log('OK (' + Math.round(size/1024) + 'KB) — OL: "' + result.olTitle + '"');
        found.push({ ...entry, filename, olTitle: result.olTitle, coverId: result.coverId });
      } else {
        console.log('DOWNLOAD FAILED');
      }
    } else {
      console.log('NOT FOUND');
    }

    await sleep(1000); // Be nice to Open Library API
  }

  console.log('\n=== RESULTS ===');
  console.log('Found: ' + found.length + '/' + (entries.length - alreadyFound.size));

  if (found.length > 0) {
    console.log('\nCovers found:');
    found.forEach(c => console.log('  ' + c.title + ' -> "' + c.olTitle + '"'));

    const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
    let manifest = [];
    if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const f of found) {
      if (!manifest.find(m => m.id === f.id)) manifest.push(f);
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('\nManifest: ' + manifest.length + ' total');
  }
}

run().catch(e => console.error(e));
