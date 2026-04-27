const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'rika-mangas-raw.json'), 'utf8'));

// Known duplicates
const existingKeys = new Set(['rika:115383', 'rika:115384', 'rika:115385', 'rika:256046']);
const existingTitles = new Set([
  'Enigma # 2', 'Enigma # 1', 'Frankenstein',
  'Demon Slayer - Kimetsu No Yaiba - Gaiden',
  'One-Punch Man - Catálogo De Heróis',
  // Test entries we created earlier
  'My Hero Academia (Reimpressão) # 16',
  'Turma da Mônica Jovem - 1ª Série # 064',
  'Tex - 2ª Edição # 048',
]);

// Filter
const toImport = data.filter(d =>
  !existingKeys.has(d.sourceKey) && !existingTitles.has(d.title)
);

console.log('After all filters: ' + toImport.length + ' entries to import');
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

const seriesMap = new Map(); // base -> [entries]
const standalone = []; // entries that don't form series

for (const entry of toImport) {
  const base = extractSeriesBase(entry.title);
  const key = base + '||' + entry.publisher;

  if (!seriesMap.has(key)) seriesMap.set(key, []);
  seriesMap.get(key).push(entry);
}

// Separate: groups with 2+ entries become series, singles stay standalone
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

// Stats
const inSeries = seriesGroups.reduce((s, g) => s + g.count, 0);
console.log('Series to create: ' + seriesGroups.length);
console.log('Entries in series: ' + inSeries);
console.log('Standalone entries: ' + standalone.length);
console.log('Total: ' + (inSeries + standalone.length));

// Publisher breakdown
const pubStats = {};
toImport.forEach(e => { pubStats[e.publisher] = (pubStats[e.publisher] || 0) + 1; });
console.log('\nBy publisher:');
Object.entries(pubStats).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([pub, count]) => {
  console.log('  ' + pub + ': ' + count);
});

// Save
const output = {
  totalToImport: toImport.length,
  seriesCount: seriesGroups.length,
  standaloneCount: standalone.length,
  series: seriesGroups,
  standalone,
};

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'manga-import-plan.json'), JSON.stringify(output, null, 2));

// Also a readable report
const report = [];
report.push('MANGA IMPORT PLAN');
report.push('=================');
report.push('Total: ' + toImport.length + ' gibis');
report.push('Series: ' + seriesGroups.length + ' (' + inSeries + ' gibis)');
report.push('Standalone: ' + standalone.length + ' gibis');
report.push('');
report.push('=== TOP 50 SERIES ===');
report.push('');
for (const g of seriesGroups.slice(0, 50)) {
  report.push(g.name + ' — ' + g.count + ' gibis');
  g.entries.slice(0, 5).forEach(e => report.push('  - ' + e.title));
  if (g.entries.length > 5) report.push('  ... +' + (g.entries.length - 5) + ' mais');
  report.push('');
}

report.push('=== CONRAD (' + (pubStats['Conrad'] || 0) + ' gibis) ===');
report.push('');
const conradSeries = seriesGroups.filter(g => g.publisher === 'Conrad');
for (const g of conradSeries) {
  report.push(g.name + ' — ' + g.count + ' gibis');
  g.entries.forEach(e => report.push('  - ' + e.title + (e.coverImageUrl ? '' : ' [SEM CAPA]')));
  report.push('');
}

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'manga-import-plan.txt'), report.join('\n'));
console.log('\nReport: docs/manga-import-plan.txt');
console.log('Data: docs/manga-import-plan.json');
