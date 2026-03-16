#!/usr/bin/env tsx
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { jsonImportRowSchema } from '@comicstrunk/contracts';
import {
  importFromJSON,
  type ImportProgressCallback,
} from '../src/modules/catalog/catalog-import.service';

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: tsx scripts/import-json.ts <file.json> [options]

Options:
  --admin-email <email>   Admin email to use as createdBy (default: admin@comicstrunk.com)
  --status <status>       Approval status: APPROVED | DRAFT (default: APPROVED)
  --batch-size <n>        Rows per transaction batch (default: 50)
  --no-skip-duplicates    Import even if barcode already exists
  --dry-run               Validate only, do not import
  --help                  Show this help
`);
    process.exit(0);
  }

  const filePath = resolve(args[0]);
  const adminEmail = getArg(args, '--admin-email') || 'admin@comicstrunk.com';
  const status = getArg(args, '--status') || 'APPROVED';
  const batchSize = parseInt(getArg(args, '--batch-size') || '50', 10);
  const skipDuplicates = !args.includes('--no-skip-duplicates');
  const dryRun = args.includes('--dry-run');

  console.log(`\nJSON Catalog Import`);
  console.log(`  File: ${filePath}`);
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Status: ${status}`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Skip duplicates: ${skipDuplicates}`);
  console.log(`  Dry run: ${dryRun}\n`);

  // Read and parse file
  let rows: unknown[];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    rows = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`Failed to read/parse ${filePath}:`, err);
    process.exit(1);
  }

  console.log(`Loaded ${rows.length} rows from file.\n`);

  // Find admin user
  const prisma = new PrismaClient();
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`Admin user not found: ${adminEmail}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  await prisma.$disconnect();

  // Dry run — validate only
  if (dryRun) {
    console.log('DRY RUN: Validating rows only...\n');
    let valid = 0;
    let invalid = 0;
    for (let i = 0; i < rows.length; i++) {
      const result = jsonImportRowSchema.safeParse(rows[i]);
      if (result.success) {
        valid++;
      } else {
        invalid++;
        console.log(
          `  Row ${i + 1}: ${result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        );
      }
    }
    console.log(`\nValidation complete: ${valid} valid, ${invalid} invalid`);
    process.exit(invalid > 0 ? 1 : 0);
  }

  // Progress reporter
  const onProgress: ImportProgressCallback = (p) => {
    const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    process.stdout.write(`\r  [${p.phase.toUpperCase()}] ${pct}% — ${p.message}          `);
    if (p.phase === 'complete') console.log('');
  };

  // Run import
  const result = await importFromJSON(
    rows,
    admin.id,
    {
      defaultApprovalStatus: status as 'APPROVED' | 'DRAFT',
      skipDuplicates,
      batchSize,
    },
    onProgress,
  );

  // Print summary
  console.log(`\n--- Import Summary ---`);
  console.log(`  Total rows:         ${result.total}`);
  console.log(`  Created:            ${result.created}`);
  console.log(`  Skipped (dupes):    ${result.skipped}`);
  console.log(`  Errors:             ${result.errors.length}`);
  console.log(
    `  Series created:     ${result.seriesCreated.length} (${result.seriesCreated.join(', ') || 'none'})`,
  );
  console.log(
    `  Categories created: ${result.categoriesCreated.length} (${result.categoriesCreated.join(', ') || 'none'})`,
  );
  console.log(`  Duration:           ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    console.log(`\n--- Errors ---`);
    for (const err of result.errors.slice(0, 50)) {
      console.log(`  Row ${err.row} (ID: ${err.externalId}): ${err.message}`);
    }
    if (result.errors.length > 50) {
      console.log(`  ... and ${result.errors.length - 50} more errors`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
