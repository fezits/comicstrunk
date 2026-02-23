import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import { uniqueSlug } from '../../shared/utils/slug';
import type { CreateCharacterInput, UpdateCharacterInput } from '@comicstrunk/contracts';

// === List Characters ===

export async function listCharacters(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.character.findMany({
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { catalogEntries: true } },
      },
    }),
    prisma.character.count(),
  ]);

  return { data, total, page, limit };
}

// === Get Character by ID ===

export async function getCharacterById(id: string) {
  const character = await prisma.character.findUnique({ where: { id } });

  if (!character) {
    throw new NotFoundError('Character not found');
  }

  return character;
}

// === Create Character ===

export async function createCharacter(data: CreateCharacterInput) {
  const slug = await uniqueSlug(data.name, 'character');

  return prisma.character.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
    },
  });
}

// === Update Character ===

export async function updateCharacter(id: string, data: UpdateCharacterInput) {
  const existing = await prisma.character.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Character not found');
  }

  const updateData: Record<string, unknown> = { ...data };

  // If name is being changed, regenerate slug
  if (data.name && data.name !== existing.name) {
    updateData.slug = await uniqueSlug(data.name, 'character', id);
  }

  return prisma.character.update({ where: { id }, data: updateData });
}

// === Delete Character ===

export async function deleteCharacter(id: string) {
  const existing = await prisma.character.findUnique({
    where: { id },
    include: { _count: { select: { catalogEntries: true } } },
  });

  if (!existing) {
    throw new NotFoundError('Character not found');
  }

  if (existing._count.catalogEntries > 0) {
    throw new BadRequestError('Cannot delete character with existing catalog entries');
  }

  await prisma.character.delete({ where: { id } });
}
