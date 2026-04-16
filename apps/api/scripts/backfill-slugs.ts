import { prisma } from '../src/shared/lib/prisma';
import { generateSlug } from '../src/shared/utils/slug';

async function backfillSlugs() {
  console.log('=== Backfilling CatalogEntry slugs ===');

  const entries = await prisma.catalogEntry.findMany({
    where: { slug: null },
    select: { id: true, title: true },
  });

  console.log(`Found ${entries.length} entries without slug`);

  const seenSlugs = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let baseSlug = generateSlug(entry.title);
    if (!baseSlug) baseSlug = entry.id;

    let slug = baseSlug;
    let counter = 1;

    // Check in-memory set and DB for uniqueness
    while (seenSlugs.has(slug) || (await prisma.catalogEntry.findFirst({ where: { slug } }))) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    seenSlugs.add(slug);

    await prisma.catalogEntry.update({
      where: { id: entry.id },
      data: { slug },
    });

    if ((i + 1) % 500 === 0 || i === entries.length - 1) {
      console.log(`  Processed ${i + 1}/${entries.length}`);
    }
  }

  console.log('\n=== Backfilling Series slugs ===');

  const seriesList = await prisma.series.findMany({
    where: { slug: null },
    select: { id: true, title: true },
  });

  console.log(`Found ${seriesList.length} series without slug`);

  const seenSeriesSlugs = new Set<string>();

  for (let i = 0; i < seriesList.length; i++) {
    const s = seriesList[i];
    let baseSlug = generateSlug(s.title);
    if (!baseSlug) baseSlug = s.id;

    let slug = baseSlug;
    let counter = 1;

    while (seenSeriesSlugs.has(slug) || (await prisma.series.findFirst({ where: { slug } }))) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    seenSeriesSlugs.add(slug);

    await prisma.series.update({
      where: { id: s.id },
      data: { slug },
    });

    if ((i + 1) % 100 === 0 || i === seriesList.length - 1) {
      console.log(`  Processed ${i + 1}/${seriesList.length}`);
    }
  }

  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

backfillSlugs().catch((err) => {
  console.error(err);
  process.exit(1);
});
