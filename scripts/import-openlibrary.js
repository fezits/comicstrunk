// Import Open Library data into Comics Trunk database
// Handles both the 18 DC/Marvel TPBs and bulk Open Library data
// Usage:
//   node scripts/import-openlibrary.js docs/dc-marvel-imports-clean.json
//   node scripts/import-openlibrary.js docs/openlibrary-bulk/_combined.json

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(require('path').join(__dirname, '..', 'apps', 'api', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();
const ADMIN_ID = 'cmmwujcy90000chw9c2vkwf7n';
const BATCH_SIZE = 100;

function generateSlug(text) {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

// Extract series base name from title
function extractSeriesBase(title) {
  let base = title
    .replace(/\s*:\s*/, ': ')
    .replace(/\s*(#|Vol\.?|Nº|N°|No\.?)?\s*\d{1,4}\s*(-\s*.+)?$/, '')
    .replace(/\s*-?\s*Volume\s*\d*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/, '') // Remove year in parens
    .replace(/\s*-\s*$/, '')
    .trim();
  return base;
}

// Extract edition/volume number from title
function extractEditionNumber(title) {
  const patterns = [
    /#\s*(\d+)/,
    /Vol\.?\s*(\d+)/i,
    /Volume\s*(\d+)/i,
    /Nº\s*(\d+)/i,
    /No\.?\s*(\d+)/i,
    /Book\s*(\d+)/i,
    /Part\s*(\d+)/i,
  ];
  for (const pat of patterns) {
    const m = title.match(pat);
    if (m) return parseInt(m[1]);
  }
  return null;
}

async function run() {
  const inputFile = process.argv[2];
  if (!inputFile || !fs.existsSync(inputFile)) {
    console.log('Usage: node scripts/import-openlibrary.js <input-json>');
    console.log('  input-json: Path to JSON file with entries to import');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log('=== OPEN LIBRARY IMPORT ===');
  console.log('Input: ' + inputFile);
  console.log('Entries in file: ' + data.length);
  console.log('');

  // Step 1: Check existing sourceKeys
  console.log('Checking existing entries by sourceKey...');
  const allSourceKeys = data.map(d => d.sourceKey).filter(Boolean);
  const existingSourceKeys = new Set();

  for (let i = 0; i < allSourceKeys.length; i += 500) {
    const batch = allSourceKeys.slice(i, i + 500);
    const found = await prisma.catalogEntry.findMany({
      where: { sourceKey: { in: batch } },
      select: { sourceKey: true },
    });
    found.forEach(f => existingSourceKeys.add(f.sourceKey));
  }
  console.log('Already in DB (by sourceKey): ' + existingSourceKeys.size);

  // Step 2: Also check by title similarity (case-insensitive)
  console.log('Loading existing titles for dedup...');
  const existingTitles = new Set();
  let page = 0;
  const pageSize = 5000;
  while (true) {
    const entries = await prisma.catalogEntry.findMany({
      select: { title: true },
      skip: page * pageSize,
      take: pageSize,
    });
    if (entries.length === 0) break;
    entries.forEach(e => existingTitles.add(e.title.toLowerCase().trim()));
    page++;
  }
  console.log('Existing catalog titles: ' + existingTitles.size);

  // Filter out duplicates
  const toImport = data.filter(d => {
    if (d.sourceKey && existingSourceKeys.has(d.sourceKey)) return false;
    if (existingTitles.has(d.title.toLowerCase().trim())) return false;
    return true;
  });
  console.log('After dedup: ' + toImport.length + ' new entries');
  console.log('Removed: ' + (data.length - toImport.length) + ' duplicates\n');

  if (toImport.length === 0) {
    console.log('Nothing to import!');
    await prisma.$disconnect();
    return;
  }

  // Step 3: Group into series
  console.log('Grouping into series...');
  const seriesMap = new Map();
  for (const entry of toImport) {
    const base = extractSeriesBase(entry.title);
    const pubKey = (entry.publisher || 'Unknown').trim();
    const key = base + '||' + pubKey;
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    seriesMap.get(key).push(entry);
  }

  const seriesGroups = [];
  const standalone = [];
  for (const [key, entries] of seriesMap) {
    if (entries.length >= 2) {
      const [base, publisher] = key.split('||');
      seriesGroups.push({ name: base, publisher, entries });
    } else {
      standalone.push(entries[0]);
    }
  }
  seriesGroups.sort((a, b) => b.entries.length - a.entries.length);

  const inSeries = seriesGroups.reduce((s, g) => s + g.entries.length, 0);
  console.log('Series to create: ' + seriesGroups.length);
  console.log('Entries in series: ' + inSeries);
  console.log('Standalone: ' + standalone.length);

  // Step 4: Create series
  console.log('\nCreating series...');
  const existingSlugs = new Set();
  const allSeries = await prisma.series.findMany({ select: { slug: true, title: true } });
  allSeries.forEach(s => { if (s.slug) existingSlugs.add(s.slug); });

  // Also check existing series by title to avoid creating dupes
  const existingSeriesTitles = new Map();
  const allSeriesFull = await prisma.series.findMany({ select: { id: true, title: true } });
  allSeriesFull.forEach(s => existingSeriesTitles.set(s.title.toLowerCase().trim(), s.id));

  let seriesCreated = 0;
  const seriesIdMap = new Map();

  for (const group of seriesGroups) {
    // Check if series already exists
    const existingId = existingSeriesTitles.get(group.name.toLowerCase().trim());
    if (existingId) {
      seriesIdMap.set(group.name + '||' + group.publisher, existingId);
      continue;
    }

    let slug = generateSlug(group.name);
    if (!slug) slug = 'series-' + seriesCreated;

    let finalSlug = slug;
    let counter = 1;
    while (existingSlugs.has(finalSlug)) {
      counter++;
      finalSlug = slug + '-' + counter;
    }
    existingSlugs.add(finalSlug);

    try {
      const series = await prisma.series.create({
        data: {
          title: group.name,
          slug: finalSlug,
          totalEditions: group.entries.length,
        },
      });
      seriesIdMap.set(group.name + '||' + group.publisher, series.id);
      seriesCreated++;
    } catch (e) {
      console.log('  Series create failed: ' + group.name + ' - ' + e.message.slice(0, 80));
    }

    if (seriesCreated % 50 === 0) {
      process.stdout.write('  Series: ' + seriesCreated + '/' + seriesGroups.length + '\r');
    }
  }
  console.log('Series created: ' + seriesCreated);

  // Step 5: Import entries
  console.log('\nImporting entries...');
  let imported = 0;
  let skipped = 0;
  const seenKeys = new Set();
  const existingEntrySlugs = new Set();

  // Load existing entry slugs to avoid conflicts
  let slugPage = 0;
  while (true) {
    const slugs = await prisma.catalogEntry.findMany({
      select: { slug: true },
      where: { slug: { not: null } },
      skip: slugPage * 5000,
      take: 5000,
    });
    if (slugs.length === 0) break;
    slugs.forEach(s => existingEntrySlugs.add(s.slug));
    slugPage++;
  }
  console.log('Existing entry slugs loaded: ' + existingEntrySlugs.size);

  // Build all entries list
  const allEntries = [];
  for (const group of seriesGroups) {
    const seriesId = seriesIdMap.get(group.name + '||' + group.publisher) || null;
    for (const entry of group.entries) {
      allEntries.push({ ...entry, seriesId });
    }
  }
  for (const entry of standalone) {
    allEntries.push({ ...entry, seriesId: null });
  }

  // Import in batches
  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    const batchData = [];

    for (const entry of batch) {
      if (entry.sourceKey && seenKeys.has(entry.sourceKey)) { skipped++; continue; }
      if (entry.sourceKey) seenKeys.add(entry.sourceKey);

      let slug = generateSlug(entry.title);
      if (!slug) slug = 'entry-' + (imported + skipped);
      let finalSlug = slug;
      let counter = 1;
      while (existingEntrySlugs.has(finalSlug)) {
        counter++;
        finalSlug = slug + '-' + counter;
      }
      existingEntrySlugs.add(finalSlug);

      const editionNumber = extractEditionNumber(entry.title);

      // Use coverImageUrl from Open Library or coverFileName if local
      let coverImageUrl = entry.coverImageUrl || null;
      let coverFileName = entry.coverFileName || null;

      // Skip tiny/placeholder images
      if (coverImageUrl && coverImageUrl.includes('openlibrary') && coverImageUrl.includes('/b/id/null')) {
        coverImageUrl = null;
      }

      batchData.push({
        title: entry.title,
        slug: finalSlug,
        author: entry.author || null,
        publisher: entry.publisher || null,
        isbn: entry.isbn || null,
        description: entry.description || null,
        publishYear: entry.publishYear,
        publishMonth: entry.publishMonth || null,
        pageCount: entry.pageCount,
        sourceKey: entry.sourceKey,
        coverImageUrl: coverImageUrl,
        coverFileName: coverFileName,
        approvalStatus: 'APPROVED',
        averageRating: 0,
        ratingCount: 0,
        createdById: ADMIN_ID,
        seriesId: entry.seriesId || null,
        editionNumber: editionNumber,
      });
    }

    if (batchData.length > 0) {
      try {
        await prisma.catalogEntry.createMany({
          data: batchData,
          skipDuplicates: true,
        });
        imported += batchData.length;
      } catch (err) {
        // If batch fails, try one by one
        for (const entry of batchData) {
          try {
            await prisma.catalogEntry.create({ data: entry });
            imported++;
          } catch (e) {
            skipped++;
            if (skipped <= 20) {
              console.log('  SKIP: ' + entry.title + ' (' + e.message.slice(0, 60) + ')');
            }
          }
        }
      }
    }

    if ((i + BATCH_SIZE) % 500 < BATCH_SIZE) {
      process.stdout.write(`  Progress: ${imported} imported, ${skipped} skipped (${Math.round((i / allEntries.length) * 100)}%)\r`);
    }
  }

  console.log('\n\n=== DONE ===');
  console.log('Series created: ' + seriesCreated);
  console.log('Entries imported: ' + imported);
  console.log('Skipped: ' + skipped);
  console.log('Total processed: ' + (imported + skipped));

  // Stats by publisher
  const pubStats = {};
  allEntries.forEach(e => { pubStats[e.publisher || 'Unknown'] = (pubStats[e.publisher || 'Unknown'] || 0) + 1; });
  console.log('\nBy publisher:');
  Object.entries(pubStats).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([pub, count]) => {
    console.log('  ' + pub + ': ' + count);
  });

  await prisma.$disconnect();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
