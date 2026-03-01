import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError, ConflictError } from '../../shared/utils/api-error';
import type { CreatePartnerStoreInput, UpdatePartnerStoreInput } from '@comicstrunk/contracts';

// === CRUD Operations ===

export async function create(data: CreatePartnerStoreInput) {
  // Validate unique name
  const existingName = await prisma.partnerStore.findFirst({
    where: { name: data.name },
  });
  if (existingName) {
    throw new ConflictError('Já existe uma loja parceira com este nome');
  }

  // Validate unique slug
  const existingSlug = await prisma.partnerStore.findUnique({
    where: { slug: data.slug },
  });
  if (existingSlug) {
    throw new ConflictError('Já existe uma loja parceira com este slug');
  }

  const store = await prisma.partnerStore.create({
    data: {
      name: data.name,
      slug: data.slug,
      affiliateTag: data.affiliateTag,
      baseUrl: data.baseUrl,
      logoUrl: data.logoUrl,
    },
  });

  return store;
}

export async function getById(id: string) {
  const store = await prisma.partnerStore.findUnique({
    where: { id },
  });

  if (!store) {
    throw new NotFoundError('Loja parceira não encontrada');
  }

  return store;
}

export async function update(id: string, data: UpdatePartnerStoreInput) {
  const existing = await prisma.partnerStore.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Loja parceira não encontrada');
  }

  // Validate unique name if changed
  if (data.name && data.name !== existing.name) {
    const conflict = await prisma.partnerStore.findFirst({
      where: { name: data.name, id: { not: id } },
    });
    if (conflict) {
      throw new ConflictError('Já existe uma loja parceira com este nome');
    }
  }

  // Validate unique slug if changed
  if (data.slug && data.slug !== existing.slug) {
    const conflict = await prisma.partnerStore.findFirst({
      where: { slug: data.slug, id: { not: id } },
    });
    if (conflict) {
      throw new ConflictError('Já existe uma loja parceira com este slug');
    }
  }

  const store = await prisma.partnerStore.update({
    where: { id },
    data,
  });

  return store;
}

export async function softDelete(id: string) {
  const existing = await prisma.partnerStore.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Loja parceira não encontrada');
  }

  const store = await prisma.partnerStore.update({
    where: { id },
    data: { isActive: false },
  });

  return store;
}

export async function listAll(filters: { page: number; limit: number; isActive?: boolean }) {
  const { page, limit, isActive } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [stores, total] = await Promise.all([
    prisma.partnerStore.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.partnerStore.count({ where }),
  ]);

  return { stores, total, page, limit };
}

export async function listActive() {
  const stores = await prisma.partnerStore.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return stores;
}
