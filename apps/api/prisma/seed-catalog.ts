import { PrismaClient, ApprovalStatus } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

// === Realistic catalog data ===

const CATEGORIES = [
  { name: 'Manga', description: 'Quadrinhos japoneses em formato tankobon' },
  { name: 'Super-heroi', description: 'Quadrinhos de super-herois americanos e brasileiros' },
  { name: 'Indie', description: 'Quadrinhos independentes e alternativos' },
  { name: 'Aventura', description: 'Quadrinhos de aventura e acao' },
  { name: 'Terror', description: 'Quadrinhos de horror e suspense' },
];

const TAGS = [
  { name: 'Shonen' },
  { name: 'Seinen' },
  { name: 'Action' },
  { name: 'Classic' },
  { name: 'Sci-Fi' },
  { name: 'Fantasy' },
  { name: 'Drama' },
  { name: 'Comedy' },
  { name: 'Supernatural' },
  { name: 'Slice of Life' },
];

const CHARACTERS = [
  { name: 'Goku', description: 'Protagonista de Dragon Ball, guerreiro Saiyajin' },
  { name: 'Batman', description: 'O Cavaleiro das Trevas, protetor de Gotham City' },
  { name: 'Luffy', description: 'Capitao dos Chapeu de Palha, futuro Rei dos Piratas' },
  { name: 'Naruto Uzumaki', description: 'Ninja de Konoha, futuro Hokage' },
  { name: 'Spider-Man', description: 'Peter Parker, o amigao da vizinhanca' },
  { name: 'Guts', description: 'O Espadachim Negro de Berserk' },
  { name: 'Tanjiro Kamado', description: 'Cacador de demonios, protagonista de Demon Slayer' },
  { name: 'Monica', description: 'A dona da rua, personagem iconica de Mauricio de Sousa' },
];

const SERIES = [
  {
    title: 'Dragon Ball',
    description:
      'A jornada de Son Goku desde crianca ate se tornar o guerreiro mais poderoso do universo. Criado por Akira Toriyama, e um dos mangas mais influentes da historia.',
    totalEditions: 42,
  },
  {
    title: 'One Piece',
    description:
      'Monkey D. Luffy e sua tripulacao navegam pelos mares em busca do tesouro lendario One Piece. A maior aventura pirata ja contada.',
    totalEditions: 109,
  },
  {
    title: 'Batman: O Cavaleiro das Trevas',
    description:
      'A obra-prima de Frank Miller que redefiniu o Batman. Bruce Wayne volta a vestir o manto apos 10 anos de aposentadoria.',
    totalEditions: 4,
  },
  {
    title: 'Naruto',
    description:
      'A historia de Naruto Uzumaki, um jovem ninja que sonha em se tornar Hokage e ser reconhecido por todos da sua aldeia.',
    totalEditions: 72,
  },
  {
    title: 'Berserk',
    description:
      'A saga sombria de Guts, o Espadachim Negro, em um mundo medieval fantastico repleto de demonios e tragedia. Obra-prima de Kentaro Miura.',
    totalEditions: 41,
  },
];

interface CatalogSeedEntry {
  title: string;
  author: string;
  publisher: string;
  imprint?: string;
  barcode: string;
  isbn: string;
  description: string;
  seriesTitle: string;
  volumeNumber: number;
  editionNumber: number;
  categoryNames: string[];
  tagNames: string[];
  characterNames: string[];
}

const CATALOG_ENTRIES: CatalogSeedEntry[] = [
  {
    title: 'Dragon Ball Vol. 1 - O Inicio da Jornada',
    author: 'Akira Toriyama',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500001',
    isbn: '978-85-7657-001-1',
    description:
      'Goku, um garoto com rabo de macaco, encontra Bulma e juntos partem em busca das Esferas do Dragao.',
    seriesTitle: 'Dragon Ball',
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Action', 'Classic'],
    characterNames: ['Goku'],
  },
  {
    title: 'Dragon Ball Vol. 2 - O Torneio de Artes Marciais',
    author: 'Akira Toriyama',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500002',
    isbn: '978-85-7657-001-2',
    description:
      'Goku treina com o Mestre Kame e participa do primeiro Torneio de Artes Marciais.',
    seriesTitle: 'Dragon Ball',
    volumeNumber: 2,
    editionNumber: 1,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Action'],
    characterNames: ['Goku'],
  },
  {
    title: 'One Piece Vol. 1 - Romance Dawn',
    author: 'Eiichiro Oda',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500003',
    isbn: '978-85-7657-002-1',
    description:
      'Luffy parte para o mar em busca do One Piece, o tesouro lendario do Rei dos Piratas.',
    seriesTitle: 'One Piece',
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Action', 'Fantasy', 'Comedy'],
    characterNames: ['Luffy'],
  },
  {
    title: 'Batman: O Cavaleiro das Trevas #1',
    author: 'Frank Miller',
    publisher: 'Panini Comics',
    imprint: 'DC Comics',
    barcode: '7891234500004',
    isbn: '978-85-7657-003-1',
    description:
      'Bruce Wayne, aos 55 anos, volta a vestir o manto do Batman para enfrentar a criminalidade crescente de Gotham.',
    seriesTitle: 'Batman: O Cavaleiro das Trevas',
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Super-heroi'],
    tagNames: ['Action', 'Classic', 'Drama'],
    characterNames: ['Batman'],
  },
  {
    title: 'Naruto Vol. 1 - Uzumaki Naruto',
    author: 'Masashi Kishimoto',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500005',
    isbn: '978-85-7657-004-1',
    description:
      'Naruto Uzumaki e um jovem ninja rejeitado por carregar a Raposa de Nove Caudas selada dentro de si.',
    seriesTitle: 'Naruto',
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Action', 'Fantasy'],
    characterNames: ['Naruto Uzumaki'],
  },
  {
    title: 'Berserk Vol. 1 - O Espadachim Negro',
    author: 'Kentaro Miura',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500006',
    isbn: '978-85-7657-005-1',
    description:
      'Guts, o Espadachim Negro, vaga por um mundo sombrio e medieval repleto de demonios e monstros.',
    seriesTitle: 'Berserk',
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Manga', 'Terror'],
    tagNames: ['Seinen', 'Action', 'Fantasy', 'Drama'],
    characterNames: ['Guts'],
  },
  {
    title: 'One Piece Vol. 2 - Buggy, o Palhaco',
    author: 'Eiichiro Oda',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500007',
    isbn: '978-85-7657-002-2',
    description: 'Luffy enfrenta o pirata Buggy e recruta Zoro para sua tripulacao.',
    seriesTitle: 'One Piece',
    volumeNumber: 2,
    editionNumber: 1,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Action', 'Comedy'],
    characterNames: ['Luffy'],
  },
  {
    title: 'Spider-Man: A Ultima Cacada de Kraven',
    author: 'J.M. DeMatteis',
    publisher: 'Panini Comics',
    imprint: 'Marvel',
    barcode: '7891234500008',
    isbn: '978-85-7657-006-1',
    description:
      'Kraven, o Cacador, enterra Spider-Man vivo e assume sua identidade nesta historia classica e sombria.',
    seriesTitle: 'Batman: O Cavaleiro das Trevas', // reuse series just for seeding
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Super-heroi'],
    tagNames: ['Action', 'Classic', 'Drama'],
    characterNames: ['Spider-Man'],
  },
  {
    title: 'Demon Slayer Vol. 1 - Crueldade',
    author: 'Koyoharu Gotouge',
    publisher: 'Panini Comics',
    imprint: 'Panini Manga',
    barcode: '7891234500009',
    isbn: '978-85-7657-007-1',
    description:
      'Tanjiro Kamado embarca em uma jornada para curar sua irma Nezuko, transformada em demonio.',
    seriesTitle: 'Naruto', // reuse series just for seeding
    volumeNumber: 1,
    editionNumber: 2,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Action', 'Supernatural'],
    characterNames: ['Tanjiro Kamado'],
  },
  {
    title: 'Turma da Monica Jovem Vol. 1',
    author: 'Mauricio de Sousa',
    publisher: 'Panini Comics',
    imprint: 'MSP',
    barcode: '7891234500010',
    isbn: '978-85-7657-008-1',
    description:
      'Monica e seus amigos agora sao adolescentes nesta releitura em estilo manga dos classicos personagens brasileiros.',
    seriesTitle: 'One Piece', // reuse series just for seeding
    volumeNumber: 1,
    editionNumber: 1,
    categoryNames: ['Manga', 'Aventura'],
    tagNames: ['Shonen', 'Comedy', 'Slice of Life'],
    characterNames: ['Monica'],
  },
];

async function uniqueSlug(base: string, model: 'category' | 'tag' | 'character'): Promise<string> {
  let slug = slugify(base, { lower: true, strict: true });
  let counter = 0;

  const exists = async (s: string) => {
    if (model === 'category') return prisma.category.findUnique({ where: { slug: s } });
    if (model === 'tag') return prisma.tag.findUnique({ where: { slug: s } });
    return prisma.character.findUnique({ where: { slug: s } });
  };

  while (await exists(slug)) {
    counter++;
    slug = `${slugify(base, { lower: true, strict: true })}-${counter}`;
  }
  return slug;
}

export async function seedCatalog(adminId: string) {
  console.log('\n  Seeding catalog data...');

  // --- Categories ---
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const slug = await uniqueSlug(cat.name, 'category');
    const record = await prisma.category.upsert({
      where: { slug },
      update: { name: cat.name, description: cat.description },
      create: { name: cat.name, slug, description: cat.description },
    });
    categoryMap.set(cat.name, record.id);
  }
  console.log(`    Categories: ${categoryMap.size} created`);

  // --- Tags ---
  const tagMap = new Map<string, string>();
  for (const tag of TAGS) {
    const slug = await uniqueSlug(tag.name, 'tag');
    const record = await prisma.tag.upsert({
      where: { slug },
      update: { name: tag.name },
      create: { name: tag.name, slug },
    });
    tagMap.set(tag.name, record.id);
  }
  console.log(`    Tags: ${tagMap.size} created`);

  // --- Characters ---
  const characterMap = new Map<string, string>();
  for (const char of CHARACTERS) {
    const slug = await uniqueSlug(char.name, 'character');
    const record = await prisma.character.upsert({
      where: { slug },
      update: { name: char.name, description: char.description },
      create: { name: char.name, slug, description: char.description },
    });
    characterMap.set(char.name, record.id);
  }
  console.log(`    Characters: ${characterMap.size} created`);

  // --- Series ---
  const seriesMap = new Map<string, string>();
  for (const s of SERIES) {
    const existing = await prisma.series.findFirst({ where: { title: s.title } });
    if (existing) {
      seriesMap.set(s.title, existing.id);
    } else {
      const record = await prisma.series.create({
        data: { title: s.title, description: s.description, totalEditions: s.totalEditions },
      });
      seriesMap.set(s.title, record.id);
    }
  }
  console.log(`    Series: ${seriesMap.size} created`);

  // --- Catalog Entries (all APPROVED) ---
  let entryCount = 0;
  for (const entry of CATALOG_ENTRIES) {
    const sId = seriesMap.get(entry.seriesTitle);

    // Check if entry already exists (by barcode)
    const existing = await prisma.catalogEntry.findFirst({
      where: { barcode: entry.barcode },
    });
    if (existing) continue;

    const catalogEntry = await prisma.catalogEntry.create({
      data: {
        title: entry.title,
        author: entry.author,
        publisher: entry.publisher,
        imprint: entry.imprint,
        barcode: entry.barcode,
        isbn: entry.isbn,
        description: entry.description,
        seriesId: sId,
        volumeNumber: entry.volumeNumber,
        editionNumber: entry.editionNumber,
        approvalStatus: ApprovalStatus.APPROVED,
        createdById: adminId,
      },
    });

    // Link categories
    const catIds = entry.categoryNames
      .map((n) => categoryMap.get(n))
      .filter(Boolean) as string[];
    if (catIds.length > 0) {
      await prisma.catalogCategory.createMany({
        data: catIds.map((cid) => ({ catalogEntryId: catalogEntry.id, categoryId: cid })),
      });
    }

    // Link tags
    const tIds = entry.tagNames.map((n) => tagMap.get(n)).filter(Boolean) as string[];
    if (tIds.length > 0) {
      await prisma.catalogTag.createMany({
        data: tIds.map((tid) => ({ catalogEntryId: catalogEntry.id, tagId: tid })),
      });
    }

    // Link characters
    const chIds = entry.characterNames
      .map((n) => characterMap.get(n))
      .filter(Boolean) as string[];
    if (chIds.length > 0) {
      await prisma.catalogCharacter.createMany({
        data: chIds.map((chid) => ({ catalogEntryId: catalogEntry.id, characterId: chid })),
      });
    }

    entryCount++;
  }
  console.log(`    Catalog entries: ${entryCount} created (APPROVED)`);
  console.log('  Catalog seed complete.');
}
