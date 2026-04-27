// Import mangas to production database
// Creates series first, then entries with series_id
// Generates slugs, checks duplicates

const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');

const prisma = new PrismaClient();

function generateSlug(text) {
  return slugify(text, { lower: true, strict: true, locale: 'pt' });
}

const ADMIN_ID = 'cmmwujcy90000chw9c2vkwf7n';
const BATCH_SIZE = 100;

async function run() {
  // Load plan
  const fs = require('fs');
  const plan = JSON.parse(fs.readFileSync('/home/ferna5257/remaining-import-plan.json', 'utf8'));

  console.log('=== MANGA IMPORT ===');
  console.log('Series to create: ' + plan.seriesCount);
  console.log('Entries to import: ' + plan.totalToImport);
  console.log('');

  // Step 1: Check for duplicates one more time
  console.log('Checking duplicates...');
  const allSourceKeys = [];
  plan.series.forEach(s => s.entries.forEach(e => allSourceKeys.push(e.sourceKey)));
  plan.standalone.forEach(e => allSourceKeys.push(e.sourceKey));

  // Check in batches
  let existingCount = 0;
  const existingSet = new Set();
  for (let i = 0; i < allSourceKeys.length; i += 500) {
    const batch = allSourceKeys.slice(i, i + 500);
    const found = await prisma.catalogEntry.findMany({
      where: { sourceKey: { in: batch } },
      select: { sourceKey: true },
    });
    found.forEach(f => { existingSet.add(f.sourceKey); existingCount++; });
  }
  console.log('Existing in DB: ' + existingCount);

  // Also check for duplicate source keys within the import itself
  const seenKeys = new Set();
  let selfDupes = 0;

  // Step 2: Create series
  console.log('\nCreating series...');
  let seriesCreated = 0;
  const seriesIdMap = new Map(); // series name -> id

  // Check existing series slugs to avoid conflicts
  const existingSlugs = new Set();
  const allSeries = await prisma.series.findMany({ select: { slug: true } });
  allSeries.forEach(s => { if (s.slug) existingSlugs.add(s.slug); });

  for (const group of plan.series) {
    let slug = generateSlug(group.name);
    if (!slug) slug = 'series-' + seriesCreated;

    // Ensure unique slug
    let finalSlug = slug;
    let counter = 1;
    while (existingSlugs.has(finalSlug)) {
      counter++;
      finalSlug = slug + '-' + counter;
    }
    existingSlugs.add(finalSlug);

    const series = await prisma.series.create({
      data: {
        title: group.name,
        slug: finalSlug,
        totalEditions: group.count,
      },
    });

    seriesIdMap.set(group.name, series.id);
    seriesCreated++;
    if (seriesCreated % 100 === 0) {
      process.stdout.write('  Series: ' + seriesCreated + '/' + plan.seriesCount + '\r');
    }
  }
  console.log('  Series created: ' + seriesCreated);

  // Step 3: Import entries with series
  console.log('\nImporting entries...');
  let imported = 0;
  let skipped = 0;

  // Collect all entries with their series_id
  const allEntries = [];
  for (const group of plan.series) {
    const seriesId = seriesIdMap.get(group.name);
    for (const entry of group.entries) {
      allEntries.push({ ...entry, seriesId });
    }
  }
  for (const entry of plan.standalone) {
    allEntries.push({ ...entry, seriesId: null });
  }

  // Check existing slugs for entries
  const existingEntrySlugs = new Set();
  // Don't load all 25k slugs - we'll check per batch

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    const batchData = [];

    for (const entry of batch) {
      // Skip duplicates
      if (existingSet.has(entry.sourceKey)) { skipped++; continue; }
      if (seenKeys.has(entry.sourceKey)) { selfDupes++; continue; }
      seenKeys.add(entry.sourceKey);

      // Generate unique slug
      let slug = generateSlug(entry.title);
      if (!slug) slug = 'entry-' + imported;
      let finalSlug = slug;
      let counter = 1;
      while (existingEntrySlugs.has(finalSlug)) {
        counter++;
        finalSlug = slug + '-' + counter;
      }
      existingEntrySlugs.add(finalSlug);

      // Parse edition number from title
      const edMatch = entry.title.match(/#\s*(\d+)/);
      const volMatch = entry.title.match(/Vol\.?\s*(\d+)/i);
      const editionNumber = edMatch ? parseInt(edMatch[1]) : (volMatch ? parseInt(volMatch[1]) : null);

      // Filter bad image URLs
      let coverUrl = entry.coverImageUrl || null;
      if (coverUrl && (coverUrl.includes('indisponivel') || coverUrl.length < 20)) {
        coverUrl = null;
      }

      batchData.push({
        title: entry.title,
        slug: finalSlug,
        publisher: entry.publisher || null,
        description: entry.description || null,
        publishYear: entry.publishYear,
        publishMonth: entry.publishMonth,
        pageCount: entry.pageCount,
        sourceKey: entry.sourceKey,
        coverImageUrl: coverUrl,
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
            console.log('  SKIP: ' + entry.title + ' (' + e.message.slice(0, 50) + ')');
            skipped++;
          }
        }
      }
    }

    if ((i + BATCH_SIZE) % 1000 < BATCH_SIZE) {
      process.stdout.write('  Entries: ' + imported + ' imported, ' + skipped + ' skipped\r');
    }
  }

  console.log('\n\n=== DONE ===');
  console.log('Series created: ' + seriesCreated);
  console.log('Entries imported: ' + imported);
  console.log('Skipped (existing): ' + skipped);
  console.log('Skipped (self-dupes): ' + selfDupes);
  console.log('Total: ' + (imported + skipped + selfDupes));

  await prisma.$disconnect();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
