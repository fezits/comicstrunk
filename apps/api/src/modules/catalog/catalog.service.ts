import { prisma } from '../../shared/lib/prisma';
import { uploadImage, deleteImage } from '../../shared/lib/cloudinary';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import type { CreateCatalogEntryInput, UpdateCatalogEntryInput } from '@comicstrunk/contracts';

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

    // Update scalar fields
    await tx.catalogEntry.update({
      where: { id },
      data: scalarData,
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
