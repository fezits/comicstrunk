/**
 * Update coverImageUrl to point to local files instead of external CDNs.
 * Covers are served at /uploads/covers/{source}-{id}.jpg
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_PUBLIC_URL || 'http://localhost:3005';

async function main() {
  // Update Rika entries — barcode format: rika-{productId}
  const rikaEntries = await prisma.catalogEntry.findMany({
    where: { barcode: { startsWith: 'rika-' } },
    select: { id: true, barcode: true, coverFileName: true },
  });

  console.log(`Updating ${rikaEntries.length} Rika entries...`);
  let rikaUpdated = 0;
  for (let i = 0; i < rikaEntries.length; i += 500) {
    const batch = rikaEntries.slice(i, i + 500);
    await Promise.all(
      batch.map(async (entry) => {
        if (!entry.coverFileName) return;
        const localUrl = `/uploads/covers/rika-${entry.coverFileName}`;
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverImageUrl: localUrl },
        });
        rikaUpdated++;
      })
    );
    if ((i + 500) % 2000 === 0) {
      console.log(`  Rika: ${Math.min(i + 500, rikaEntries.length)}/${rikaEntries.length}`);
    }
  }
  console.log(`  Rika: ${rikaUpdated} updated\n`);

  // Update Panini entries — barcode format: panini-{sku}
  const paniniEntries = await prisma.catalogEntry.findMany({
    where: { barcode: { startsWith: 'panini-' } },
    select: { id: true, barcode: true, coverFileName: true },
  });

  console.log(`Updating ${paniniEntries.length} Panini entries...`);
  let paniniUpdated = 0;
  for (let i = 0; i < paniniEntries.length; i += 500) {
    const batch = paniniEntries.slice(i, i + 500);
    await Promise.all(
      batch.map(async (entry) => {
        if (!entry.coverFileName) return;
        const localUrl = `/uploads/covers/panini-${entry.coverFileName}`;
        await prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { coverImageUrl: localUrl },
        });
        paniniUpdated++;
      })
    );
  }
  console.log(`  Panini: ${paniniUpdated} updated\n`);

  // Clear URLs for entries without local cover files
  const noCovers = await prisma.catalogEntry.updateMany({
    where: {
      coverFileName: null,
      coverImageUrl: { not: null },
      barcode: { startsWith: 'panini-' },
    },
    data: { coverImageUrl: null },
  });
  console.log(`Cleared ${noCovers.count} Panini entries without covers`);

  console.log(`\nTotal: ${rikaUpdated + paniniUpdated} cover URLs updated to local`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
