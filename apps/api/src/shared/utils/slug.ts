import slugifyLib from 'slugify';
import { prisma } from '../lib/prisma';

export function generateSlug(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, locale: 'pt' });
}

type SlugModel = 'category' | 'tag' | 'character' | 'catalogEntry' | 'series';

interface SlugDelegate {
  findFirst(args: { where: { slug: string; id?: { not: string } } }): Promise<unknown>;
}

export async function uniqueSlug(
  text: string,
  model: SlugModel,
  excludeId?: string,
): Promise<string> {
  const baseSlug = generateSlug(text);
  let slug = baseSlug;
  let counter = 1;

  const delegate = prisma[model] as unknown as SlugDelegate;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const where: { slug: string; id?: { not: string } } = { slug };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existing = await delegate.findFirst({ where });

    if (!existing) {
      return slug;
    }

    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}
