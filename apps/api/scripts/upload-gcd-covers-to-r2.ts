#!/usr/bin/env tsx
/**
 * upload-gcd-covers-to-r2.ts — Download GCD external cover URLs, compress, and
 * upload to Cloudflare R2.
 *
 * Today, ~4900 GCD entries have `coverImageUrl` pointing to external CDN
 * (comicvine/comics.org/imgix) but `coverFileName` is null. This makes the
 * platform dependent on those URLs forever — they may rot, change, or
 * rate-limit. This script:
 *
 *   1. Picks GCD entries with `coverImageUrl != null AND coverFileName = null`
 *   2. Downloads the image
 *   3. Compresses with sharp (max 600px width, JPEG quality 80)
 *   4. Uploads to R2 via uploadImage()
 *   5. Updates entry: sets coverFileName, leaves coverImageUrl as-is (resolveCover
 *      prioritizes coverFileName when present)
 *
 * Idempotent: re-runs skip entries that already have coverFileName.
 *
 * Usage:
 *   corepack pnpm --filter api exec tsx scripts/upload-gcd-covers-to-r2.ts [options]
 *
 * Options:
 *   --limit N         Max entries to process this run (default: 50)
 *   --concurrency N   Parallel downloads (default: 4)
 *   --dry-run         Download/compress but don't upload or update DB
 *   --status          Just show counts and exit
 *   --continuous      Run until all done (no batch limit)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { uploadImage } from '../src/shared/lib/cloudinary';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
};

const DRY_RUN = args.includes('--dry-run');
const STATUS_ONLY = args.includes('--status');
const CONTINUOUS = args.includes('--continuous');
const LIMIT = CONTINUOUS ? 999_999 : parseInt(getArg('--limit') || '50', 10);
const CONCURRENCY = parseInt(getArg('--concurrency') || '4', 10);
const FETCH_TIMEOUT_MS = 15_000;

interface CoverEntry {
  id: string;
  title: string;
  sourceKey: string | null;
  coverImageUrl: string | null;
}

async function downloadAndCompress(url: string): Promise<Buffer | null> {
  let raw: Buffer;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ComicsTrunk/1.0 (cover-mirror; +https://comicstrunk.com)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    raw = Buffer.from(ab);
    if (raw.length < 1000) return null;
  } catch {
    return null;
  }

  // Compress with sharp if available; fall back to raw bytes.
  try {
    const sharpMod = (await import('sharp')) as unknown as {
      default: (input: Buffer) => {
        resize: (w: number, h: null, opts: Record<string, unknown>) => {
          jpeg: (opts: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> };
        };
      };
    };
    const sharp = sharpMod.default;
    return await sharp(raw)
      .resize(600, null, { withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    return raw;
  }
}

async function processOne(entry: CoverEntry): Promise<'ok' | 'fail' | 'skip'> {
  if (!entry.coverImageUrl) return 'skip';

  const buffer = await downloadAndCompress(entry.coverImageUrl);
  if (!buffer) {
    if (process.env.DEBUG_GCD) console.error(`  DOWNLOAD failed: ${entry.id} (${entry.coverImageUrl})`);
    return 'fail';
  }

  if (DRY_RUN) return 'ok';

  let upload: { url: string; publicId: string };
  try {
    upload = await uploadImage(buffer, 'covers');
  } catch (err) {
    console.error(`  UPLOAD failed for ${entry.id}:`, err instanceof Error ? err.message : err);
    return 'fail';
  }

  const filename = upload.publicId.split('/').pop() ?? null;
  if (!filename) {
    console.error(`  publicId without filename: ${upload.publicId}`);
    return 'fail';
  }

  try {
    await prisma.catalogEntry.update({
      where: { id: entry.id },
      data: { coverFileName: filename },
    });
  } catch (err) {
    console.error(`  DB UPDATE failed for ${entry.id}:`, err instanceof Error ? err.message : err);
    return 'fail';
  }
  return 'ok';
}

async function processBatch(entries: CoverEntry[]): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  // Pool simples: roda CONCURRENCY em paralelo.
  const queue = [...entries];
  const inFlight: Promise<void>[] = [];

  const drain = async (): Promise<void> => {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) return;
      const result = await processOne(entry);
      if (result === 'ok') ok++;
      else if (result === 'fail') fail++;
      const total = ok + fail;
      if (total % 10 === 0) {
        console.log(`  [${total}] ok=${ok} fail=${fail}`);
      }
    }
  };

  for (let i = 0; i < CONCURRENCY; i++) {
    inFlight.push(drain());
  }
  await Promise.all(inFlight);
  return { ok, fail };
}

async function main(): Promise<void> {
  const totalNeed = await prisma.catalogEntry.count({
    where: {
      sourceKey: { startsWith: 'gcd:' },
      coverImageUrl: { not: null },
      coverFileName: null,
    },
  });

  const totalDone = await prisma.catalogEntry.count({
    where: {
      sourceKey: { startsWith: 'gcd:' },
      coverFileName: { not: null },
    },
  });

  console.log(`GCD Cover -> R2 Mirror`);
  console.log(`  Need to mirror: ${totalNeed.toLocaleString()}`);
  console.log(`  Already mirrored: ${totalDone.toLocaleString()}`);

  if (STATUS_ONLY || totalNeed === 0) {
    await prisma.$disconnect();
    return;
  }

  console.log(`  Limit this run: ${LIMIT}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('');

  let processedTotal = 0;
  let okTotal = 0;
  let failTotal = 0;

  while (processedTotal < LIMIT) {
    const remaining = LIMIT - processedTotal;
    // 4815 das 4903 URLs sao wikia/fandom (acessiveis); 88 sao files1.comics.org
    // que retorna 403 com Cloudflare challenge. Excluir comics.org no WHERE
    // pra nao desperdicar tentativas.
    const batch = (await prisma.catalogEntry.findMany({
      where: {
        sourceKey: { startsWith: 'gcd:' },
        coverImageUrl: { not: null },
        coverFileName: null,
        NOT: { coverImageUrl: { contains: 'files1.comics.org' } },
      },
      select: { id: true, title: true, sourceKey: true, coverImageUrl: true },
      orderBy: { createdAt: 'asc' },
      take: Math.min(remaining, 50),
    })) as CoverEntry[];

    if (batch.length === 0) {
      console.log('  No more entries to process.');
      break;
    }

    const { ok, fail } = await processBatch(batch);
    okTotal += ok;
    failTotal += fail;
    processedTotal += batch.length;

    console.log(`  Batch done: ok=${ok} fail=${fail} (running total ok=${okTotal} fail=${failTotal})`);
  }

  console.log('');
  console.log(`Final: processed=${processedTotal} ok=${okTotal} fail=${failTotal}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
