// Bulk fetch comics from Open Library API by publisher
// Open Library is free, public, no auth needed
// Rate limit: ~1 request per second recommended

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'openlibrary-bulk');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// All major comic publishers to search
const PUBLISHERS = [
  // Big Two (broader search to get more than just our 18 TPBs)
  { name: 'DC Comics', searchTerms: ['DC Comics'], maxPages: 50 },
  { name: 'Marvel Comics', searchTerms: ['Marvel Comics', 'Marvel'], maxPages: 50 },
  // Major Indies
  { name: 'Image Comics', searchTerms: ['Image Comics'], maxPages: 30 },
  { name: 'Dark Horse Comics', searchTerms: ['Dark Horse Comics', 'Dark Horse'], maxPages: 30 },
  { name: 'IDW Publishing', searchTerms: ['IDW Publishing', 'IDW'], maxPages: 20 },
  { name: 'BOOM! Studios', searchTerms: ['BOOM! Studios', 'Boom Studios', 'BOOM Studios'], maxPages: 15 },
  { name: 'Dynamite Entertainment', searchTerms: ['Dynamite Entertainment', 'Dynamite'], maxPages: 15 },
  { name: 'Archie Comics', searchTerms: ['Archie Comics', 'Archie Comic Publications'], maxPages: 20 },
  { name: 'Valiant Entertainment', searchTerms: ['Valiant Entertainment', 'Valiant Comics'], maxPages: 10 },
  { name: 'Oni Press', searchTerms: ['Oni Press'], maxPages: 10 },
  { name: 'Titan Comics', searchTerms: ['Titan Comics', 'Titan Books'], maxPages: 15 },
  { name: 'AfterShock Comics', searchTerms: ['AfterShock Comics'], maxPages: 5 },
  // Classic/Legacy Publishers
  { name: 'Vertigo', searchTerms: ['Vertigo', 'DC Comics/Vertigo'], maxPages: 15 },
  { name: 'WildStorm', searchTerms: ['WildStorm', 'Wildstorm Productions'], maxPages: 10 },
  { name: 'Top Cow', searchTerms: ['Top Cow', 'Top Cow Productions'], maxPages: 10 },
  { name: 'CrossGen', searchTerms: ['CrossGen', 'CrossGeneration'], maxPages: 5 },
  { name: 'Eclipse Comics', searchTerms: ['Eclipse Comics'], maxPages: 5 },
  // Art/Indie/Alternative
  { name: 'Fantagraphics', searchTerms: ['Fantagraphics', 'Fantagraphics Books'], maxPages: 15 },
  { name: 'Drawn & Quarterly', searchTerms: ['Drawn & Quarterly', 'Drawn and Quarterly'], maxPages: 10 },
  { name: 'Top Shelf Productions', searchTerms: ['Top Shelf Productions'], maxPages: 5 },
  { name: 'Scholastic', searchTerms: ['Scholastic'], maxPages: 10, filter: 'graphic novel' },
  // European
  { name: 'Rebellion', searchTerms: ['Rebellion', '2000 AD'], maxPages: 10 },
  { name: 'Cinebook', searchTerms: ['Cinebook'], maxPages: 10 },
  { name: 'Humanoids', searchTerms: ['Humanoids', 'Humanoids Publishing'], maxPages: 5 },
  { name: 'Titan Books', searchTerms: ['Titan Books'], maxPages: 10 },
  // Manga publishers (English editions)
  { name: 'VIZ Media', searchTerms: ['VIZ Media', 'Viz Media', 'Viz Communications'], maxPages: 50 },
  { name: 'Kodansha Comics', searchTerms: ['Kodansha Comics', 'Kodansha USA'], maxPages: 20 },
  { name: 'Yen Press', searchTerms: ['Yen Press'], maxPages: 20 },
  { name: 'Seven Seas', searchTerms: ['Seven Seas', 'Seven Seas Entertainment'], maxPages: 15 },
  { name: 'Dark Horse Manga', searchTerms: ['Dark Horse Manga'], maxPages: 10 },
  { name: 'Tokyopop', searchTerms: ['Tokyopop', 'TOKYOPOP'], maxPages: 15 },
  // Additional
  { name: 'Ablaze Publishing', searchTerms: ['Ablaze', 'Ablaze Publishing'], maxPages: 5 },
  { name: 'AWA Studios', searchTerms: ['AWA Studios', 'Artists Writers & Artisans'], maxPages: 5 },
  { name: 'Scout Comics', searchTerms: ['Scout Comics'], maxPages: 5 },
  { name: 'Vault Comics', searchTerms: ['Vault Comics'], maxPages: 5 },
  { name: 'Mad Cave Studios', searchTerms: ['Mad Cave Studios', 'Mad Cave'], maxPages: 5 },
  { name: 'Ahoy Comics', searchTerms: ['Ahoy Comics'], maxPages: 5 },
  { name: 'Antarctic Press', searchTerms: ['Antarctic Press'], maxPages: 5 },
  { name: 'Abstract Studio', searchTerms: ['Abstract Studio'], maxPages: 5 },
  { name: 'Action Lab', searchTerms: ['Action Lab', 'Action Lab Entertainment'], maxPages: 5 },
  { name: 'Avatar Press', searchTerms: ['Avatar Press'], maxPages: 5 },
  { name: 'Black Mask Studios', searchTerms: ['Black Mask Studios'], maxPages: 5 },
  { name: 'Zenescope', searchTerms: ['Zenescope', 'Zenescope Entertainment'], maxPages: 5 },
];

// Also search by comic-related subjects
const SUBJECT_SEARCHES = [
  { subject: 'comic books, strips, etc.', maxPages: 50 },
  { subject: 'graphic novels', maxPages: 50 },
  { subject: 'superhero comic books', maxPages: 30 },
  { subject: 'manga', maxPages: 30 },
  { subject: 'science fiction comic books', maxPages: 20 },
  { subject: 'horror comic books', maxPages: 15 },
  { subject: 'fantasy comic books', maxPages: 15 },
];

async function searchByPublisher(publisherQuery, page = 1, limit = 100) {
  const url = `https://openlibrary.org/search.json?publisher=${encodeURIComponent(publisherQuery)}&page=${page}&limit=${limit}&fields=title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,publisher,key,edition_count`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) return { numFound: 0, docs: [] };
    return await resp.json();
  } catch (e) {
    console.log('    ERROR: ' + e.message);
    return { numFound: 0, docs: [] };
  }
}

async function searchBySubject(subject, page = 1, limit = 100) {
  const url = `https://openlibrary.org/search.json?subject=${encodeURIComponent(subject)}&page=${page}&limit=${limit}&fields=title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,publisher,key,edition_count`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) return { numFound: 0, docs: [] };
    return await resp.json();
  } catch (e) {
    console.log('    ERROR: ' + e.message);
    return { numFound: 0, docs: [] };
  }
}

function processDoc(doc, publisherName) {
  if (!doc.title) return null;
  // Skip if title is too short or generic
  if (doc.title.length < 3) return null;

  const coverId = doc.cover_i || null;
  const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
  const isbn = Array.isArray(doc.isbn) ? doc.isbn[0] : null;
  const authors = Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '';
  const publishers = Array.isArray(doc.publisher) ? doc.publisher : [];

  // Determine publisher - prefer the one we're searching for
  let publisher = publisherName;
  if (!publisher && publishers.length > 0) {
    publisher = publishers[0];
  }

  const olKey = doc.key || '';

  return {
    title: doc.title.trim(),
    author: authors || null,
    publisher: publisher,
    publishYear: doc.first_publish_year || null,
    pageCount: doc.number_of_pages_median || null,
    isbn: isbn,
    coverImageUrl: coverUrl,
    sourceKey: 'openlibrary:' + (coverId || olKey.replace('/works/', 'work-')),
    editionCount: doc.edition_count || 1,
  };
}

async function fetchPublisher(pub) {
  console.log(`\n=== ${pub.name} ===`);
  const allDocs = [];
  const seenKeys = new Set();

  for (const searchTerm of pub.searchTerms) {
    console.log(`  Searching: "${searchTerm}"`);
    let page = 1;
    let totalFound = 0;

    while (page <= pub.maxPages) {
      const data = await searchByPublisher(searchTerm, page, 100);
      if (page === 1) {
        totalFound = data.numFound || 0;
        console.log(`  Total in OL: ${totalFound}`);
      }

      if (!data.docs || data.docs.length === 0) break;

      for (const doc of data.docs) {
        const entry = processDoc(doc, pub.name);
        if (entry && !seenKeys.has(entry.sourceKey)) {
          seenKeys.add(entry.sourceKey);
          allDocs.push(entry);
        }
      }

      process.stdout.write(`  Page ${page}: ${allDocs.length} unique entries\r`);
      page++;
      await sleep(1100); // Rate limit
    }
    console.log(`  After "${searchTerm}": ${allDocs.length} unique entries`);
  }

  console.log(`  TOTAL ${pub.name}: ${allDocs.length}`);
  console.log(`    With cover: ${allDocs.filter(d => d.coverImageUrl).length}`);
  return allDocs;
}

async function fetchSubject(subj) {
  console.log(`\n=== Subject: ${subj.subject} ===`);
  const allDocs = [];
  const seenKeys = new Set();
  let page = 1;

  const firstData = await searchBySubject(subj.subject, 1, 100);
  console.log(`  Total in OL: ${firstData.numFound || 0}`);

  if (firstData.docs) {
    for (const doc of firstData.docs) {
      const entry = processDoc(doc, null);
      if (entry && !seenKeys.has(entry.sourceKey)) {
        seenKeys.add(entry.sourceKey);
        allDocs.push(entry);
      }
    }
  }
  page = 2;
  await sleep(1100);

  while (page <= subj.maxPages) {
    const data = await searchBySubject(subj.subject, page, 100);
    if (!data.docs || data.docs.length === 0) break;

    for (const doc of data.docs) {
      const entry = processDoc(doc, null);
      if (entry && !seenKeys.has(entry.sourceKey)) {
        seenKeys.add(entry.sourceKey);
        allDocs.push(entry);
      }
    }

    process.stdout.write(`  Page ${page}: ${allDocs.length} unique entries\r`);
    page++;
    await sleep(1100);
  }

  console.log(`  TOTAL subject "${subj.subject}": ${allDocs.length}`);
  return allDocs;
}

async function run() {
  const startTime = Date.now();
  console.log('=== OPEN LIBRARY BULK FETCH ===');
  console.log('Publishers: ' + PUBLISHERS.length);
  console.log('Subject searches: ' + SUBJECT_SEARCHES.length);
  console.log('Started at: ' + new Date().toISOString());
  console.log('');

  const allEntries = [];
  const globalSeen = new Set();
  const stats = {};

  // Check which publishers we already fetched (resume support)
  const progressFile = path.join(OUTPUT_DIR, '_progress.json');
  let completed = [];
  if (fs.existsSync(progressFile)) {
    completed = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    console.log('Resuming from previous run. Completed: ' + completed.length);

    // Load previously saved data
    for (const name of completed) {
      const file = path.join(OUTPUT_DIR, sanitizeFilename(name) + '.json');
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const entry of data) {
          if (!globalSeen.has(entry.sourceKey)) {
            globalSeen.add(entry.sourceKey);
            allEntries.push(entry);
          }
        }
        stats[name] = data.length;
      }
    }
    console.log('Loaded ' + allEntries.length + ' entries from previous run\n');
  }

  // Fetch by publisher
  for (const pub of PUBLISHERS) {
    if (completed.includes(pub.name)) {
      console.log(`\nSkipping ${pub.name} (already done)`);
      continue;
    }

    try {
      const docs = await fetchPublisher(pub);

      // Save per-publisher file
      const filename = sanitizeFilename(pub.name) + '.json';
      fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify(docs, null, 2));

      // Add to global list (dedup)
      let newCount = 0;
      for (const entry of docs) {
        if (!globalSeen.has(entry.sourceKey)) {
          globalSeen.add(entry.sourceKey);
          allEntries.push(entry);
          newCount++;
        }
      }
      stats[pub.name] = docs.length;
      console.log(`  New unique: ${newCount} (global total: ${allEntries.length})`);

      // Save progress
      completed.push(pub.name);
      fs.writeFileSync(progressFile, JSON.stringify(completed, null, 2));
    } catch (e) {
      console.log(`  FATAL ERROR for ${pub.name}: ${e.message}`);
    }
  }

  // Fetch by subject
  for (const subj of SUBJECT_SEARCHES) {
    const key = 'subject:' + subj.subject;
    if (completed.includes(key)) {
      console.log(`\nSkipping subject "${subj.subject}" (already done)`);
      continue;
    }

    try {
      const docs = await fetchSubject(subj);

      const filename = 'subject-' + sanitizeFilename(subj.subject) + '.json';
      fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify(docs, null, 2));

      let newCount = 0;
      for (const entry of docs) {
        if (!globalSeen.has(entry.sourceKey)) {
          globalSeen.add(entry.sourceKey);
          allEntries.push(entry);
          newCount++;
        }
      }
      stats[key] = docs.length;
      console.log(`  New unique: ${newCount} (global total: ${allEntries.length})`);

      completed.push(key);
      fs.writeFileSync(progressFile, JSON.stringify(completed, null, 2));
    } catch (e) {
      console.log(`  FATAL ERROR for subject "${subj.subject}": ${e.message}`);
    }
  }

  // Save combined file
  const combinedPath = path.join(OUTPUT_DIR, '_combined.json');
  fs.writeFileSync(combinedPath, JSON.stringify(allEntries, null, 2));

  // Print stats
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n\n========================================');
  console.log('=== FINAL RESULTS ===');
  console.log('========================================');
  console.log('Total unique entries: ' + allEntries.length);
  console.log('With cover: ' + allEntries.filter(e => e.coverImageUrl).length);
  console.log('Without cover: ' + allEntries.filter(e => !e.coverImageUrl).length);
  console.log('Time elapsed: ' + Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's');
  console.log('\nPer publisher/subject:');
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => console.log(`  ${name}: ${count}`));

  console.log('\nSaved to: ' + combinedPath);
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

run().catch(e => console.error('FATAL:', e));
