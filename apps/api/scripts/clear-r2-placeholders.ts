/**
 * clear-r2-placeholders.ts — Delete Rika placeholder objects from Cloudflare R2.
 *
 * Reads basenames from /tmp/rika-placeholders.txt and deletes
 * covers/{basename} from the R2 bucket. Uses the existing R2 credentials
 * exposed via the API's .env (loaded by dotenv).
 *
 * Strategy: probe each key with HeadObject; if hash matches a known
 * placeholder size, delete. If size differs (i.e. a real cover happens to
 * share the filename of a known placeholder), skip and log.
 *
 * Usage: npx tsx scripts/clear-r2-placeholders.ts [--dry-run]
 */
import 'dotenv/config';
import { S3Client, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 100; // R2/S3 DeleteObjects allows up to 1000 per call; keep modest
const KNOWN_SIZES = new Set([42169, 41189]);

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || 'comicstrunk';

async function probe(key: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const r = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { exists: true, size: r.ContentLength };
  } catch {
    return { exists: false };
  }
}

async function main() {
  const lines = fs
    .readFileSync('/tmp/rika-placeholders.txt', 'utf-8')
    .trim()
    .split('\n');
  const filenames = lines.map((l) => l.trim()).filter(Boolean);
  console.log(`Loaded ${filenames.length} candidate filenames`);

  // Probe each, classify as placeholder/real/missing
  let toDelete: string[] = [];
  let real = 0;
  let missing = 0;
  let placeholder = 0;

  for (let i = 0; i < filenames.length; i++) {
    const key = `covers/${filenames[i]}`;
    const probed = await probe(key);
    if (!probed.exists) {
      missing++;
    } else if (probed.size !== undefined && KNOWN_SIZES.has(probed.size)) {
      toDelete.push(key);
      placeholder++;
    } else {
      real++;
      console.log(`  skip ${key} — size ${probed.size} (not a known placeholder size)`);
    }
    if ((i + 1) % 500 === 0) {
      console.log(
        `  probed ${i + 1}/${filenames.length} | placeholder=${placeholder} real=${real} missing=${missing}`,
      );
    }
  }

  console.log(`\nTotals → placeholder=${placeholder}  real=${real}  missing=${missing}`);

  if (DRY_RUN) {
    console.log('DRY RUN — no R2 deletes');
    return;
  }

  // Delete in batches
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const slice = toDelete.slice(i, i + BATCH);
    const r = await r2.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    const errs = r.Errors?.length || 0;
    deleted += slice.length - errs;
    console.log(
      `  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(toDelete.length / BATCH)}: ${slice.length - errs} deleted${errs ? ` (${errs} errors)` : ''}`,
    );
  }

  console.log(`\nTotal R2 objects deleted: ${deleted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
