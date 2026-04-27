// Compare fetched Rika data with existing catalog to find new entries
// Generates a report for Fernando to approve before importing

const fs = require('fs');
const path = require('path');

async function api(endpoint) {
  const resp = await fetch('https://api.comicstrunk.com/api/v1' + endpoint);
  return resp.json();
}

async function run() {
  const inputFile = process.argv[2] || path.join(__dirname, '..', 'docs', 'rika-mangas-raw.json');

  if (!fs.existsSync(inputFile)) {
    console.log('Input file not found: ' + inputFile);
    console.log('Run fetch-rika-mangas.js first.');
    process.exit(1);
  }

  const rikaData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log('Loaded ' + rikaData.length + ' products from Rika\n');

  // Get all existing source keys from our DB
  console.log('Fetching existing catalog...');
  let existingKeys = new Set();
  let existingTitles = new Map(); // title_lower -> { id, title, publisher }

  // Fetch in pages
  let page = 1;
  while (true) {
    const resp = await api('/catalog?limit=100&page=' + page);
    if (!resp.data || resp.data.length === 0) break;
    for (const entry of resp.data) {
      // We can't get sourceKey from public API, so compare by title + publisher
      const key = (entry.title || '').toLowerCase().trim();
      existingTitles.set(key, { id: entry.id, title: entry.title, publisher: entry.publisher });
    }
    if (page >= resp.pagination.totalPages) break;
    page++;
    if (page % 10 === 0) process.stdout.write('  page ' + page + '/' + resp.pagination.totalPages + '\r');
  }
  console.log('Existing catalog: ' + existingTitles.size + ' entries\n');

  // Compare
  const newEntries = [];
  const duplicates = [];
  const noImage = [];

  for (const entry of rikaData) {
    const titleKey = entry.title.toLowerCase().trim();

    // Check exact title match
    if (existingTitles.has(titleKey)) {
      duplicates.push({ rika: entry, existing: existingTitles.get(titleKey) });
      continue;
    }

    // Check fuzzy match (title without special chars)
    const normalized = titleKey.replace(/[#\-–—:,.'\"!?()]/g, '').replace(/\s+/g, ' ').trim();
    let fuzzyMatch = false;
    for (const [key, val] of existingTitles) {
      const existNorm = key.replace(/[#\-–—:,.'\"!?()]/g, '').replace(/\s+/g, ' ').trim();
      if (existNorm === normalized) {
        duplicates.push({ rika: entry, existing: val, fuzzy: true });
        fuzzyMatch = true;
        break;
      }
    }
    if (fuzzyMatch) continue;

    newEntries.push(entry);
    if (!entry.coverImageUrl) noImage.push(entry);
  }

  // Generate report
  console.log('=== COMPARISON REPORT ===');
  console.log('Rika products: ' + rikaData.length);
  console.log('Already in catalog (exact): ' + duplicates.filter(d => !d.fuzzy).length);
  console.log('Already in catalog (fuzzy): ' + duplicates.filter(d => d.fuzzy).length);
  console.log('NEW (to import): ' + newEntries.length);
  console.log('  With image: ' + newEntries.filter(e => e.coverImageUrl).length);
  console.log('  Without image: ' + noImage.length);

  // Group new entries by publisher
  const byPublisher = {};
  newEntries.forEach(e => {
    const pub = e.publisher || 'Unknown';
    if (!byPublisher[pub]) byPublisher[pub] = [];
    byPublisher[pub].push(e);
  });

  console.log('\nNew entries by publisher:');
  Object.entries(byPublisher).sort((a, b) => b[1].length - a[1].length).forEach(([pub, items]) => {
    console.log('  ' + pub + ': ' + items.length);
  });

  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'docs', 'import-comparison-report.txt');
  const reportLines = [];
  reportLines.push('RIKA MANGA IMPORT — COMPARISON REPORT');
  reportLines.push('Generated: ' + new Date().toISOString());
  reportLines.push('');
  reportLines.push('Total from Rika: ' + rikaData.length);
  reportLines.push('Duplicates: ' + duplicates.length);
  reportLines.push('NEW to import: ' + newEntries.length);
  reportLines.push('');
  reportLines.push('=== NEW ENTRIES (to import) ===');
  reportLines.push('');

  for (const pub of Object.keys(byPublisher).sort()) {
    const items = byPublisher[pub];
    reportLines.push('--- ' + pub + ' (' + items.length + ' gibis) ---');
    items.sort((a, b) => a.title.localeCompare(b.title));
    for (const e of items) {
      reportLines.push('  ' + e.title + ' | ' + (e.publishYear || '?') + ' | img:' + (e.coverImageUrl ? 'YES' : 'NO'));
    }
    reportLines.push('');
  }

  // Also save as JSON for importing later
  const importPath = path.join(__dirname, '..', 'docs', 'rika-mangas-to-import.json');
  fs.writeFileSync(importPath, JSON.stringify(newEntries, null, 2));

  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log('\nReport saved to: docs/import-comparison-report.txt');
  console.log('Import data saved to: docs/rika-mangas-to-import.json');
}

run().catch(e => console.error('FATAL:', e));
