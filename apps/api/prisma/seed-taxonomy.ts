import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

function toSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, locale: 'pt' });
}

// === Seed Data ===

const CATEGORIES = [
  { name: 'Super-herois', slug: 'super-herois', description: 'Historias de super-herois e vigilantes' },
  { name: 'Manga', slug: 'manga', description: 'Quadrinhos japoneses traduzidos para o portugues' },
  { name: 'HQ Nacional', slug: 'hq-nacional', description: 'Quadrinhos produzidos por autores brasileiros' },
  { name: 'Horror', slug: 'horror', description: 'Historias de terror e suspense' },
  { name: 'Ficcao Cientifica', slug: 'ficcao-cientifica', description: 'Quadrinhos de ficcao cientifica' },
  { name: 'Fantasia', slug: 'fantasia', description: 'Historias de fantasia e mundos imaginarios' },
  { name: 'Aventura', slug: 'aventura', description: 'Historias de aventura e acao' },
  { name: 'Romance', slug: 'romance', description: 'Historias romanticas e dramas' },
  { name: 'Comedia', slug: 'comedia', description: 'Quadrinhos de humor e comedia' },
  { name: 'Infantil', slug: 'infantil', description: 'Quadrinhos para o publico infantil' },
  { name: 'Graphic Novel', slug: 'graphic-novel', description: 'Narrativas graficas longas e autorais' },
  { name: 'Underground/Independente', slug: 'underground-independente', description: 'Quadrinhos independentes e alternativos' },
];

const TAGS = [
  'Panini',
  'Abril',
  'Mythos',
  'Devir',
  'JBC',
  'Darkside',
  'NewPOP',
  'Conrad',
  'Pipoca & Nanquim',
  'Veneta',
  'Zarabatana',
  'Nemo',
  'Mauricio de Sousa',
];

const CHARACTERS = [
  { name: 'Homem-Aranha', slug: 'homem-aranha', description: null },
  { name: 'Batman', slug: 'batman', description: null },
  { name: 'Superman', slug: 'superman', description: null },
  { name: 'Wolverine', slug: 'wolverine', description: null },
  { name: 'Monica', slug: 'monica', description: 'Turma da Monica' },
  { name: 'Cebolinha', slug: 'cebolinha', description: 'Turma da Monica' },
  { name: 'Goku', slug: 'goku', description: 'Dragon Ball' },
  { name: 'Naruto', slug: 'naruto', description: 'Naruto Shippuden' },
  { name: 'Luffy', slug: 'luffy', description: 'One Piece' },
];

// === Seed Functions ===

async function seedCategories() {
  console.log('Seeding categories...');
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
    });
  }
  const count = await prisma.category.count();
  console.log(`  Categories seeded: ${count}`);
}

async function seedTags() {
  console.log('Seeding tags...');
  for (const tagName of TAGS) {
    const slug = toSlug(tagName);
    await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: {
        name: tagName,
        slug,
      },
    });
  }
  const count = await prisma.tag.count();
  console.log(`  Tags seeded: ${count}`);
}

async function seedCharacters() {
  console.log('Seeding characters...');
  for (const char of CHARACTERS) {
    await prisma.character.upsert({
      where: { slug: char.slug },
      update: {},
      create: {
        name: char.name,
        slug: char.slug,
        description: char.description,
      },
    });
  }
  const count = await prisma.character.count();
  console.log(`  Characters seeded: ${count}`);
}

// === Main ===

export async function seedTaxonomy() {
  await seedCategories();
  await seedTags();
  await seedCharacters();
  console.log('Taxonomy seed complete.');
}

// Run directly if called as script
seedTaxonomy()
  .catch((e) => {
    console.error('Taxonomy seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
