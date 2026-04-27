/**
 * One-off script to remove the 10 seed catalog entries (no cover images).
 * Identified by their barcode pattern: 789123450000X
 *
 * Usage: npx tsx scripts/remove-seed-entries.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_BARCODES = [
  '7891234500001',
  '7891234500002',
  '7891234500003',
  '7891234500004',
  '7891234500005',
  '7891234500006',
  '7891234500007',
  '7891234500008',
  '7891234500009',
  '7891234500010',
];

async function main() {
  const entries = await prisma.catalogEntry.findMany({
    where: { barcode: { in: SEED_BARCODES } },
    select: { id: true, title: true, barcode: true },
  });

  if (entries.length === 0) {
    console.log('No seed entries found — already removed.');
    return;
  }

  console.log(`Found ${entries.length} seed entries to remove:`);
  for (const e of entries) {
    console.log(`  - ${e.title} (${e.barcode})`);
  }

  const ids = entries.map((e) => e.id);

  // Delete non-cascade relations first
  const [listings, comments] = await Promise.all([
    prisma.marketplaceListing.deleteMany({ where: { catalogEntryId: { in: ids } } }),
    prisma.comment.deleteMany({ where: { catalogEntryId: { in: ids } } }),
  ]);
  if (listings.count) console.log(`  Removed ${listings.count} marketplace listings`);
  if (comments.count) console.log(`  Removed ${comments.count} comments`);

  // Delete catalog entries (cascades: categories, tags, characters, collection, favorites, reviews)
  const result = await prisma.catalogEntry.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`\nRemoved ${result.count} seed catalog entries.`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
