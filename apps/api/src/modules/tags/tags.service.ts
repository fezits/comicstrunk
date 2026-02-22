import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import { uniqueSlug } from '../../shared/utils/slug';
import type { CreateTagInput, UpdateTagInput } from '@comicstrunk/contracts';

// === List Tags ===

export async function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { catalogEntries: true } },
    },
  });
}

// === Get Tag by ID ===

export async function getTagById(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } });

  if (!tag) {
    throw new NotFoundError('Tag not found');
  }

  return tag;
}

// === Create Tag ===

export async function createTag(data: CreateTagInput) {
  const slug = await uniqueSlug(data.name, 'tag');

  return prisma.tag.create({
    data: {
      name: data.name,
      slug,
    },
  });
}

// === Update Tag ===

export async function updateTag(id: string, data: UpdateTagInput) {
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Tag not found');
  }

  const updateData: Record<string, unknown> = { ...data };

  // If name is being changed, regenerate slug
  if (data.name && data.name !== existing.name) {
    updateData.slug = await uniqueSlug(data.name, 'tag', id);
  }

  return prisma.tag.update({ where: { id }, data: updateData });
}

// === Delete Tag ===

export async function deleteTag(id: string) {
  const existing = await prisma.tag.findUnique({
    where: { id },
    include: { _count: { select: { catalogEntries: true } } },
  });

  if (!existing) {
    throw new NotFoundError('Tag not found');
  }

  if (existing._count.catalogEntries > 0) {
    throw new BadRequestError('Cannot delete tag with existing catalog entries');
  }

  await prisma.tag.delete({ where: { id } });
}
