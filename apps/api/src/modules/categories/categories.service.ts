import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import { uniqueSlug } from '../../shared/utils/slug';
import type { CreateCategoryInput, UpdateCategoryInput } from '@comicstrunk/contracts';

// === List Categories ===

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { catalogEntries: true } },
    },
  });
}

// === Get Category by ID ===

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  return category;
}

// === Create Category ===

export async function createCategory(data: CreateCategoryInput) {
  const slug = await uniqueSlug(data.name, 'category');

  return prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
    },
  });
}

// === Update Category ===

export async function updateCategory(id: string, data: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  const updateData: Record<string, unknown> = { ...data };

  // If name is being changed, regenerate slug
  if (data.name && data.name !== existing.name) {
    updateData.slug = await uniqueSlug(data.name, 'category', id);
  }

  return prisma.category.update({ where: { id }, data: updateData });
}

// === Delete Category ===

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { catalogEntries: true } } },
  });

  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  if (existing._count.catalogEntries > 0) {
    throw new BadRequestError('Cannot delete category with existing catalog entries');
  }

  await prisma.category.delete({ where: { id } });
}
