/**
 * clear-rika-placeholders.ts — One-shot cleanup of Rika placeholder cover_file_name references.
 *
 * Reads placeholder basenames from /tmp/rika-placeholders.txt and sets
 * cover_file_name = NULL for any catalog_entries pointing to one of them.
 *
 * Companion to fetch-missing-covers.ts v3 which prevents new placeholders.
 *
 * Usage: npx tsx /tmp/clear-rika-placeholders.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 1000;

async function main() {
  const lines = fs
    .readFileSync('/tmp/rika-placeholders.txt', 'utf-8')
    .trim()
    .split('\n');
  const filenames = lines.map((l) => l.trim()).filter(Boolean);
  console.log(`Loaded ${filenames.length} placeholder filenames`);

  const before = await prisma.catalogEntry.count({
    where: { coverFileName: { in: filenames } },
  });
  console.log(`DB rows with cover_file_name in placeholder list: ${before}`);

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made');
    await prisma.$disconnect();
    return;
  }

  let total = 0;
  for (let i = 0; i < filenames.length; i += BATCH) {
    const slice = filenames.slice(i, i + BATCH);
    const result = await prisma.catalogEntry.updateMany({
      where: { coverFileName: { in: slice } },
      data: { coverFileName: null },
    });
    total += result.count;
    console.log(
      `  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(filenames.length / BATCH)}: ${result.count} updated (running total ${total})`,
    );
  }

  const after = await prisma.catalogEntry.count({
    where: { coverFileName: { in: filenames } },
  });
  console.log(`\nDB rows still pointing to placeholders: ${after}`);
  console.log(`Total updated: ${total}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
