import { prisma } from '../../shared/lib/prisma';
import { uploadImage } from '../../shared/lib/cloudinary';
import { BadRequestError, NotFoundError, ConflictError } from '../../shared/utils/api-error';
import crypto from 'crypto';

const RATE_LIMIT_PER_DAY = 10;

export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface CoverSubmissionRow {
  id: string;
  catalog_entry_id: string;
  user_id: string;
  image_url: string;
  image_filename: string;
  status: SubmissionStatus;
  rejection_reason: string | null;
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
}

function genId(): string {
  return 'csub' + Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

export async function submit(userId: string, catalogEntryId: string, fileBuffer: Buffer): Promise<{ id: string }> {
  // 1. Catalog entry must exist
  const entry = await prisma.catalogEntry.findUnique({ where: { id: catalogEntryId }, select: { id: true } });
  if (!entry) throw new NotFoundError('Gibi não encontrado');

  // 2. No PENDING for this user+entry
  const existing = await prisma.$queryRaw<CoverSubmissionRow[]>`
    SELECT id FROM cover_submissions
    WHERE user_id = ${userId} AND catalog_entry_id = ${catalogEntryId} AND status = 'PENDING'
    LIMIT 1
  `;
  if (existing.length > 0) {
    throw new ConflictError('Você já tem uma submissão pendente para este gibi');
  }

  // 3. Rate limit: max 10 submissions / 24h
  const recentCount = await prisma.$queryRaw<[{ cnt: bigint }]>`
    SELECT COUNT(*) as cnt FROM cover_submissions
    WHERE user_id = ${userId} AND submitted_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `;
  if (Number(recentCount[0].cnt) >= RATE_LIMIT_PER_DAY) {
    throw new BadRequestError(`Limite diário atingido (${RATE_LIMIT_PER_DAY} submissões por dia)`);
  }

  // 4. Basic size validation (multer enforces max 5MB)
  if (fileBuffer.length < 5000) {
    throw new BadRequestError('Imagem muito pequena');
  }

  // 5. Upload to R2 in cover-submissions/ folder (separate from official covers)
  const { url, publicId } = await uploadImage(fileBuffer, 'cover-submissions');
  const filename = publicId.split('/').pop() || publicId;

  // 7. Insert submission
  const id = genId();
  await prisma.$executeRaw`
    INSERT INTO cover_submissions
      (id, catalog_entry_id, user_id, image_url, image_filename, status, submitted_at)
    VALUES
      (${id}, ${catalogEntryId}, ${userId}, ${url}, ${filename}, 'PENDING', NOW())
  `;

  return { id };
}

export async function getMine(userId: string, catalogEntryId: string) {
  const rows = await prisma.$queryRaw<CoverSubmissionRow[]>`
    SELECT id, status, image_url, submitted_at, reviewed_at, rejection_reason
    FROM cover_submissions
    WHERE user_id = ${userId} AND catalog_entry_id = ${catalogEntryId}
    ORDER BY submitted_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    imageUrl: r.image_url,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    rejectionReason: r.rejection_reason,
  }));
}

export async function listPending(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    catalog_entry_id: string;
    user_id: string;
    user_name: string | null;
    user_email: string;
    image_url: string;
    submitted_at: Date;
    entry_title: string;
    entry_publisher: string | null;
    entry_cover_url: string | null;
    entry_cover_filename: string | null;
    entry_source_key: string | null;
  }>>`
    SELECT
      cs.id, cs.catalog_entry_id, cs.user_id, cs.image_url, cs.submitted_at,
      u.name as user_name, u.email as user_email,
      ce.title as entry_title, ce.publisher as entry_publisher,
      ce.cover_image_url as entry_cover_url, ce.cover_file_name as entry_cover_filename,
      ce.source_key as entry_source_key
    FROM cover_submissions cs
    JOIN users u ON u.id = cs.user_id
    JOIN catalog_entries ce ON ce.id = cs.catalog_entry_id
    WHERE cs.status = 'PENDING'
    ORDER BY cs.submitted_at ASC
    LIMIT ${limit} OFFSET ${skip}
  `;
  const totalRow = await prisma.$queryRaw<[{ cnt: bigint }]>`
    SELECT COUNT(*) as cnt FROM cover_submissions WHERE status = 'PENDING'
  `;
  return {
    items: rows.map((r) => ({
      id: r.id,
      catalogEntryId: r.catalog_entry_id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      imageUrl: r.image_url,
      submittedAt: r.submitted_at,
      entry: {
        title: r.entry_title,
        publisher: r.entry_publisher,
        coverImageUrl: r.entry_cover_url,
        coverFileName: r.entry_cover_filename,
        sourceKey: r.entry_source_key,
      },
    })),
    total: Number(totalRow[0].cnt),
  };
}

export async function approve(submissionId: string, reviewerId: string) {
  const sub = await prisma.$queryRaw<CoverSubmissionRow[]>`
    SELECT * FROM cover_submissions WHERE id = ${submissionId} AND status = 'PENDING' LIMIT 1
  `;
  if (sub.length === 0) throw new NotFoundError('Submissão não encontrada ou já revisada');
  const s = sub[0];

  // Update catalog entry to use this image
  await prisma.catalogEntry.update({
    where: { id: s.catalog_entry_id },
    data: {
      coverImageUrl: s.image_url,
      coverFileName: s.image_filename,
    },
  });

  await prisma.$executeRaw`
    UPDATE cover_submissions
    SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = ${reviewerId}
    WHERE id = ${submissionId}
  `;
}

export async function reject(submissionId: string, reviewerId: string, reason?: string) {
  const sub = await prisma.$queryRaw<CoverSubmissionRow[]>`
    SELECT id FROM cover_submissions WHERE id = ${submissionId} AND status = 'PENDING' LIMIT 1
  `;
  if (sub.length === 0) throw new NotFoundError('Submissão não encontrada ou já revisada');

  await prisma.$executeRaw`
    UPDATE cover_submissions
    SET status = 'REJECTED', reviewed_at = NOW(), reviewed_by = ${reviewerId},
        rejection_reason = ${reason || null}
    WHERE id = ${submissionId}
  `;
}
