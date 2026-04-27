// Fetch DC/Marvel TPBs from Open Library API (public, no auth needed)
// Open Library has many TPB/HC editions with covers

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '..', 'docs', 'dc-marvel-imports.json');
const COVERS_DIR = path.join(__dirname, '..', 'docs', 'dc-marvel-covers');
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const TITLES = [
  // DC Classics
  { search: 'Batman Year One', publisher: 'DC Comics', year: 1987 },
  { search: 'Batman The Long Halloween', publisher: 'DC Comics', year: 1996 },
  { search: 'Batman Dark Victory', publisher: 'DC Comics', year: 1999 },
  { search: 'Batman Hush', publisher: 'DC Comics', year: 2002 },
  { search: 'Batman The Killing Joke', publisher: 'DC Comics', year: 1988 },
  { search: 'Superman For All Seasons', publisher: 'DC Comics', year: 1998 },
  { search: 'Dark Knight Returns', publisher: 'DC Comics', year: 1986 },
  { search: 'Watchmen', publisher: 'DC Comics', year: 1986 },
  { search: 'Kingdom Come', publisher: 'DC Comics', year: 1996 },
  { search: 'Batman Arkham Asylum', publisher: 'DC Comics', year: 1989 },
  { search: 'Batman Court of Owls', publisher: 'DC Comics', year: 2011 },
  { search: 'All Star Superman', publisher: 'DC Comics', year: 2005 },
  { search: 'Superman Red Son', publisher: 'DC Comics', year: 2003 },
  { search: 'V for Vendetta', publisher: 'DC Comics', year: 1988 },
  { search: 'Sandman Neil Gaiman', publisher: 'DC Comics', year: 1989 },
  { search: 'Batman Death in the Family', publisher: 'DC Comics', year: 1988 },
  { search: 'Crisis on Infinite Earths', publisher: 'DC Comics', year: 1985 },
  { search: 'Identity Crisis', publisher: 'DC Comics', year: 2004 },
  { search: 'Flashpoint', publisher: 'DC Comics', year: 2011 },
  { search: 'Batman No Mans Land', publisher: 'DC Comics', year: 1999 },
  // Marvel Classics
  { search: 'Spider-Man Blue', publisher: 'Marvel Comics', year: 2002 },
  { search: 'Daredevil Born Again', publisher: 'Marvel Comics', year: 1986 },
  { search: 'Infinity Gauntlet', publisher: 'Marvel Comics', year: 1991 },
  { search: 'Marvels Kurt Busiek', publisher: 'Marvel Comics', year: 1994 },
  { search: 'Civil War Marvel', publisher: 'Marvel Comics', year: 2006 },
  { search: 'House of M', publisher: 'Marvel Comics', year: 2005 },
  { search: 'Old Man Logan', publisher: 'Marvel Comics', year: 2008 },
  { search: 'X-Men Dark Phoenix Saga', publisher: 'Marvel Comics', year: 1980 },
  { search: 'Avengers Disassembled', publisher: 'Marvel Comics', year: 2004 },
  { search: 'Secret Wars Marvel', publisher: 'Marvel Comics', year: 1984 },
  { search: 'Age of Apocalypse', publisher: 'Marvel Comics', year: 1995 },
  { search: 'Spider-Verse', publisher: 'Marvel Comics', year: 2014 },
  { search: 'Planet Hulk', publisher: 'Marvel Comics', year: 2006 },
  { search: 'World War Hulk', publisher: 'Marvel Comics', year: 2007 },
  { search: 'Wolverine Enemy of State', publisher: 'Marvel Comics', year: 2004 },
];

async function searchOpenLibrary(query) {
  const url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(query) + '&limit=3';
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    for (const doc of (data.docs || [])) {
      if (!doc.cover_i) continue;
      // Verify the title matches
      const docTitle = (doc.title || '').toLowerCase();
      const searchWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
      const matchCount = searchWords.filter(w => docTitle.includes(w)).length;
      if (matchCount >= 2) {
        return {
          olTitle: doc.title,
          coverId: doc.cover_i,
          coverUrl: 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg',
          isbn: doc.isbn?.[0] || null,
          pages: doc.number_of_pages_median || null,
          firstPublish: doc.first_publish_year || null,
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
      const sharp = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp'));
      const outputPath = path.join(COVERS_DIR, filename);
      await sharp(buffer)
        .resize(600, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      return fs.statSync(outputPath).size;
    } catch {
      const outputPath = path.join(COVERS_DIR, filename);
      fs.writeFileSync(outputPath, buffer);
      return buffer.length;
    }
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== DC/MARVEL FROM OPEN LIBRARY ===\n');
  const found = [];

  for (let i = 0; i < TITLES.length; i++) {
    const t = TITLES[i];
    process.stdout.write('[' + (i + 1) + '/' + TITLES.length + '] ' + t.search + '... ');

    const result = await searchOpenLibrary(t.search);

    if (result) {
      const slug = t.search.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
      const filename = slug + '.jpg';
      const size = await downloadCover(result.coverUrl, filename);

      if (size) {
        console.log('OK (' + Math.round(size / 1024) + 'KB) — "' + result.olTitle + '"');
        found.push({
          title: result.olTitle,
          publisher: t.publisher,
          publishYear: result.firstPublish || t.year,
          pageCount: result.pages,
          isbn: result.isbn,
          coverFileName: filename,
          sourceKey: 'openlibrary:' + result.coverId,
          slug,
        });
      } else {
        console.log('DOWNLOAD FAILED');
      }
    } else {
      console.log('NOT FOUND');
    }

    await sleep(1000);
  }

  console.log('\n=== RESULTS ===');
  console.log('Found: ' + found.length + '/' + TITLES.length);

  fs.writeFileSync(OUTPUT, JSON.stringify(found, null, 2));
  console.log('Saved to: ' + OUTPUT);

  console.log('\nFound titles:');
  found.forEach(f => console.log('  ' + f.title + ' (' + f.publisher + ', ' + f.publishYear + ')'));
}

run().catch(e => console.error(e));
