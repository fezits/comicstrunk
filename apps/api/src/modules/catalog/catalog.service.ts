import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { uploadImage, deleteImage } from '../../shared/lib/cloudinary';
import { parseCSV, generateCSV } from '../../shared/lib/csv';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import { catalogImportRowSchema } from '@comicstrunk/contracts';
import type {
  CreateCatalogEntryInput,
  UpdateCatalogEntryInput,
  CatalogSearchInput,
} from '@comicstrunk/contracts';

// === Valid approval state transitions ===

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PENDING'], // Can send back for re-review
  REJECTED: ['DRAFT'], // Author can revise and resubmit
};

// Map action names to target statuses
const ACTION_TO_STATUS: Record<string, string> = {
  submit: 'PENDING',
  approve: 'APPROVED',
  reject: 'REJECTED',
};

// === Standard includes for catalog entry queries ===

function catalogIncludes() {
  return {
    series: true,
    categories: { include: { category: true } },
    tags: { include: { tag: true } },
    characters: { include: { character: true } },
    createdBy: { select: { id: true, name: true, email: true } },
  };
}

// === CRUD Operations ===

export async function createCatalogEntry(
  data: CreateCatalogEntryInput & { createdById: string },
) {
  const { categoryIds, tagIds, characterIds, ...scalarData } = data;

  const entry = await prisma.catalogEntry.create({
    data: {
      ...scalarData,
      categories: categoryIds?.length
        ? { create: categoryIds.map((id) => ({ categoryId: id })) }
        : undefined,
      tags: tagIds?.length
        ? { create: tagIds.map((id) => ({ tagId: id })) }
        : undefined,
      characters: characterIds?.length
        ? { create: characterIds.map((id) => ({ characterId: id })) }
        : undefined,
    },
    include: catalogIncludes(),
  });

  return entry;
}

export async function getCatalogEntryById(id: string, publicOnly = true) {
  const entry = await prisma.catalogEntry.findUnique({
    where: { id },
    include: catalogIncludes(),
  });

  if (!entry) {
    throw new NotFoundError('Catalog entry not found');
  }

  if (publicOnly && entry.approvalStatus !== 'APPROVED') {
    throw new NotFoundError('Catalog entry not found');
  }

  return entry;
}

export async function updateCatalogEntry(id: string, data: UpdateCatalogEntryInput) {
  const existing = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Catalog entry not found');
  }

  const { categoryIds, tagIds, characterIds, ...scalarData } = data;

  // Use interactive transaction to handle junction table updates atomically
  await prisma.$transaction(async (tx) => {
    // Junction table updates: delete existing then create new (only if array is provided)
    if (categoryIds !== undefined) {
      await tx.catalogCategory.deleteMany({ where: { catalogEntryId: id } });
      if (categoryIds.length > 0) {
        await tx.catalogCategory.createMany({
          data: categoryIds.map((cid) => ({ catalogEntryId: id, categoryId: cid })),
        });
      }
    }

    if (tagIds !== undefined) {
      await tx.catalogTag.deleteMany({ where: { catalogEntryId: id } });
      if (tagIds.length > 0) {
        await tx.catalogTag.createMany({
          data: tagIds.map((tid) => ({ catalogEntryId: id, tagId: tid })),
        });
      }
    }

    if (characterIds !== undefined) {
      await tx.catalogCharacter.deleteMany({ where: { catalogEntryId: id } });
      if (characterIds.length > 0) {
        await tx.catalogCharacter.createMany({
          data: characterIds.map((chid) => ({ catalogEntryId: id, characterId: chid })),
        });
      }
    }

    // Update scalar fields; auto-reset REJECTED → DRAFT when entry is edited
    const statusReset =
      existing.approvalStatus === 'REJECTED'
        ? { approvalStatus: 'DRAFT' as const, rejectionReason: null }
        : {};

    await tx.catalogEntry.update({
      where: { id },
      data: { ...scalarData, ...statusReset },
    });
  });

  // Fetch and return updated entry with full includes
  return prisma.catalogEntry.findUnique({
    where: { id },
    include: catalogIncludes(),
  });
}

export async function deleteCatalogEntry(id: string) {
  const existing = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Catalog entry not found');
  }

  await prisma.catalogEntry.delete({ where: { id } });
}

// === Approval State Machine ===

export async function updateApprovalStatus(
  id: string,
  action: 'submit' | 'approve' | 'reject',
  rejectionReason?: string,
) {
  const targetStatus = ACTION_TO_STATUS[action];

  const entry = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!entry) {
    throw new NotFoundError('Catalog entry not found');
  }

  const allowedTransitions = VALID_TRANSITIONS[entry.approvalStatus];
  if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
    throw new BadRequestError(
      `Cannot transition from ${entry.approvalStatus} to ${targetStatus}`,
    );
  }

  if (action === 'reject' && !rejectionReason) {
    throw new BadRequestError('Rejection reason is required');
  }

  const updated = await prisma.catalogEntry.update({
    where: { id },
    data: {
      approvalStatus: targetStatus as 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED',
      rejectionReason: action === 'reject' ? rejectionReason : null,
    },
    include: catalogIncludes(),
  });

  return updated;
}

// === Cover Image Upload ===

export async function uploadCoverImage(id: string, buffer: Buffer) {
  const entry = await prisma.catalogEntry.findUnique({ where: { id } });
  if (!entry) {
    throw new NotFoundError('Catalog entry not found');
  }

  // If entry already has a cover image, attempt to delete the old one
  if (entry.coverImageUrl) {
    // Extract publicId from Cloudinary URL if possible
    // Cloudinary URLs follow pattern: .../v{version}/{folder}/{publicId}.{ext}
    const match = entry.coverImageUrl.match(/\/comicstrunk\/covers\/([^.]+)/);
    if (match) {
      await deleteImage(`comicstrunk/covers/${match[1]}`);
    }
  }

  const { url } = await uploadImage(buffer, 'comicstrunk/covers');

  const updated = await prisma.catalogEntry.update({
    where: { id },
    data: { coverImageUrl: url },
    include: catalogIncludes(),
  });

  return updated;
}

// === Combined-filter Search ===

export async function searchCatalog(filters: CatalogSearchInput) {
  const where: Prisma.CatalogEntryWhereInput = {
    approvalStatus: 'APPROVED',
  };

  if (filters.title) {
    where.title = { contains: filters.title };
  }
  if (filters.publisher) {
    where.publisher = { contains: filters.publisher };
  }
  if (filters.seriesId) {
    where.seriesId = filters.seriesId;
  }
  if (filters.categoryIds?.length) {
    where.categories = { some: { categoryId: { in: filters.categoryIds } } };
  }
  if (filters.characterIds?.length) {
    where.characters = { some: { characterId: { in: filters.characterIds } } };
  }
  if (filters.tagIds?.length) {
    where.tags = { some: { tagId: { in: filters.tagIds } } };
  }
  if (filters.yearFrom || filters.yearTo) {
    const yearFilter: Prisma.IntNullableFilter = {};
    if (filters.yearFrom) {
      yearFilter.gte = filters.yearFrom;
    }
    if (filters.yearTo) {
      yearFilter.lte = filters.yearTo;
    }
    where.publishYear = yearFilter;
  }

  const sortFieldMap: Record<string, string> = {
    title: 'title',
    createdAt: 'createdAt',
    averageRating: 'averageRating',
  };
  const sortField = sortFieldMap[filters.sortBy] || 'createdAt';
  const orderBy = { [sortField]: filters.sortOrder };

  const skip = (filters.page - 1) * filters.limit;

  const [entries, total] = await Promise.all([
    prisma.catalogEntry.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy,
      include: catalogIncludes(),
    }),
    prisma.catalogEntry.count({ where }),
  ]);

  return { entries, total, page: filters.page, limit: filters.limit };
}

// === Admin List ===

export async function listCatalogEntries(params: {
  page: number;
  limit: number;
  approvalStatus?: string;
}) {
  const { page, limit, approvalStatus } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (approvalStatus) {
    where.approvalStatus = approvalStatus;
  }

  const [data, total] = await Promise.all([
    prisma.catalogEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: catalogIncludes(),
    }),
    prisma.catalogEntry.count({ where }),
  ]);

  return { data, total, page, limit };
}

// === CSV Import / Export ===

const MAX_IMPORT_ROWS = 1000;

export async function importFromCSV(buffer: Buffer, adminId: string) {
  const { data: rows } = parseCSV<Record<string, string>>(buffer);

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestError(`CSV exceeds maximum of ${MAX_IMPORT_ROWS} rows`);
  }

  const errors: Array<{ row: number; message: string }> = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +2 accounts for header row + 0-index
    const raw = rows[i];

    // Validate row with Zod schema
    const result = catalogImportRowSchema.safeParse(raw);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join('; ');
      errors.push({ row: rowNumber, message: messages });
      continue;
    }

    const validated = result.data;

    try {
      // Look up series by title if seriesTitle column is provided
      let seriesId: string | undefined;
      const seriesTitle = raw.seriesTitle?.trim();
      if (seriesTitle) {
        const series = await prisma.series.findFirst({
          where: { title: { contains: seriesTitle } },
        });
        if (!series) {
          errors.push({
            row: rowNumber,
            message: `Series "${seriesTitle}" not found — entry created without series`,
          });
        } else {
          seriesId = series.id;
        }
      }

      await prisma.catalogEntry.create({
        data: {
          title: validated.title,
          author: validated.author || null,
          publisher: validated.publisher || null,
          imprint: validated.imprint || null,
          barcode: validated.barcode || null,
          isbn: validated.isbn || null,
          description: validated.description || null,
          seriesId: seriesId || null,
          createdById: adminId,
          approvalStatus: 'DRAFT',
        },
      });
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: rowNumber, message });
    }
  }

  return { created, errors, total: rows.length };
}

export async function exportToCSV() {
  const entries = await prisma.catalogEntry.findMany({
    where: { approvalStatus: 'APPROVED' },
    orderBy: { title: 'asc' },
    include: {
      series: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      characters: { include: { character: true } },
    },
  });

  const rows = entries.map((entry) => ({
    title: entry.title,
    author: entry.author || '',
    publisher: entry.publisher || '',
    imprint: entry.imprint || '',
    barcode: entry.barcode || '',
    isbn: entry.isbn || '',
    description: entry.description || '',
    seriesTitle: entry.series?.title || '',
    volumeNumber: entry.volumeNumber ?? '',
    editionNumber: entry.editionNumber ?? '',
    categories: entry.categories.map((c) => c.category.name).join('; '),
    tags: entry.tags.map((t) => t.tag.name).join('; '),
    characters: entry.characters.map((ch) => ch.character.name).join('; '),
    averageRating: entry.averageRating.toString(),
    ratingCount: entry.ratingCount.toString(),
  }));

  return generateCSV(rows);
}
