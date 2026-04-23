// Prepare import plan for remaining Rika categories
// Same logic as prepare-manga-import.js

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || path.join(__dirname, '..', 'docs', 'rika-remaining-raw.json');

if (!fs.existsSync(inputFile)) {
  console.log('Input file not found: ' + inputFile);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
console.log('Loaded: ' + data.length + ' products\n');

// Check existing sourceKeys in production
async function checkExisting() {
  const API = 'https://api.comicstrunk.com/api/v1';

  // Check by sourceKey via DB (we'll check a sample)
  const allKeys = data.map(d => d.sourceKey);
  console.log('Checking ' + allKeys.length + ' source keys against production...');

  // We can't check all via API, but we know rika entries from before
  // Simple approach: check by title similarity
  let existingTitles = new Set();
  let page = 1;
  while (true) {
    try {
      const resp = await fetch(API + '/catalog?limit=100&page=' + page);
      const json = await resp.json();
      if (!json.data || json.data.length === 0) break;
      json.data.forEach(e => existingTitles.add(e.title.toLowerCase().trim()));
      if (page >= json.pagination.totalPages) break;
      page++;
      if (page % 50 === 0) process.stdout.write('  page ' + page + '/' + json.pagination.totalPages + '\r');
    } catch {
      break;
    }
  }
  console.log('Existing catalog: ' + existingTitles.size + ' entries\n');

  // Filter duplicates
  const toImport = data.filter(d => {
    const titleKey = d.title.toLowerCase().trim();
    return !existingTitles.has(titleKey);
  });

  console.log('After title dedup: ' + toImport.length + ' new entries');
  console.log('Removed: ' + (data.length - toImport.length) + ' duplicates\n');

  // Group into series
  function extractSeriesBase(title) {
    let base = title
      .replace(/\s*(#|Vol\.?|Nº|N°)?\s*\d{1,4}\s*(-\s*.+)?$/, '')
      .replace(/\s*-?\s*Volume\s*$/i, '')
      .replace(/\s*-\s*$/, '')
      .trim();
    return base;
  }

  const seriesMap = new Map();
  const standalone = [];

  for (const entry of toImport) {
    const base = extractSeriesBase(entry.title);
    const key = base + '||' + entry.publisher;
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    seriesMap.get(key).push(entry);
  }

  const seriesGroups = [];
  for (const [key, entries] of seriesMap) {
    if (entries.length >= 2) {
      const [base, publisher] = key.split('||');
      seriesGroups.push({
        name: publisher ? base + ' (' + publisher + ')' : base,
        publisher,
        count: entries.length,
        entries: entries.sort((a, b) => a.title.localeCompare(b.title)),
      });
    } else {
      standalone.push(entries[0]);
    }
  }

  seriesGroups.sort((a, b) => b.count - a.count);

  const inSeries = seriesGroups.reduce((s, g) => s + g.count, 0);
  console.log('Series to create: ' + seriesGroups.length);
  console.log('Entries in series: ' + inSeries);
  console.log('Standalone: ' + standalone.length);
  console.log('Total: ' + (inSeries + standalone.length));

  const pubStats = {};
  toImport.forEach(e => { pubStats[e.publisher] = (pubStats[e.publisher] || 0) + 1; });
  console.log('\nBy publisher:');
  Object.entries(pubStats).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([pub, count]) => {
    console.log('  ' + pub + ': ' + count);
  });

  const output = {
    totalToImport: toImport.length,
    seriesCount: seriesGroups.length,
    standaloneCount: standalone.length,
    series: seriesGroups,
    standalone,
  };

  const outputPath = path.join(__dirname, '..', 'docs', 'remaining-import-plan.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log('\nPlan saved to: docs/remaining-import-plan.json');
}

checkExisting().catch(e => console.error(e));
