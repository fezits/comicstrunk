import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';
import { TEST_PREFIX } from '../global-setup';
import {
  extractEditionNumber,
  parsePubDate,
  parsePageCount,
  parseStringOrArray,
  normalizeTitle,
  titleSimilarity,
} from '../../modules/catalog/catalog-import.service';

const prisma = new PrismaClient();

let adminToken: string;
const PREFIX = `${TEST_PREFIX}ENH_`;

beforeAll(async () => {
  const { accessToken } = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = accessToken;
});

afterAll(async () => {
  // Clean up test entries
  const testEntries = await prisma.catalogEntry.findMany({
    where: {
      OR: [
        { barcode: { startsWith: PREFIX } },
        { isbn: { startsWith: PREFIX } },
        { sourceKey: { startsWith: PREFIX } },
        { title: { startsWith: TEST_PREFIX + 'ENH' } },
      ],
    },
    select: { id: true },
  });
  const ids = testEntries.map((e) => e.id);
  if (ids.length > 0) {
    await prisma.catalogCategory.deleteMany({ where: { catalogEntryId: { in: ids } } });
    await prisma.catalogTag.deleteMany({ where: { catalogEntryId: { in: ids } } });
    await prisma.catalogCharacter.deleteMany({ where: { catalogEntryId: { in: ids } } });
    await prisma.catalogEntry.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.series.deleteMany({ where: { title: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.tag.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.character.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

// === Pure function tests ===

describe('extractEditionNumber', () => {
  it('extracts from # pattern', () => {
    expect(extractEditionNumber('Batman #42')).toBe(42);
    expect(extractEditionNumber('Batman # 42')).toBe(42);
  });

  it('extracts from Vol. pattern', () => {
    expect(extractEditionNumber('Dragon Ball Vol. 1')).toBe(1);
    expect(extractEditionNumber('Dragon Ball Vol 12')).toBe(12);
  });

  it('extracts from Volume pattern', () => {
    expect(extractEditionNumber('Sandman Volume 3')).toBe(3);
  });

  it('extracts from Edicao pattern', () => {
    expect(extractEditionNumber('Turma da Monica Edicao 100')).toBe(100);
  });

  it('returns null for no match', () => {
    expect(extractEditionNumber('Batman Returns')).toBeNull();
  });
});

describe('parsePubDate', () => {
  it('parses M/YYYY format', () => {
    expect(parsePubDate('6/2024')).toEqual({ year: 2024, month: 6 });
    expect(parsePubDate('12/1999')).toEqual({ year: 1999, month: 12 });
  });

  it('parses YYYY format', () => {
    expect(parsePubDate('2001')).toEqual({ year: 2001, month: null });
  });

  it('parses DD/MM/YYYY format', () => {
    expect(parsePubDate('15/06/1991')).toEqual({ year: 1991, month: 6 });
  });

  it('returns nulls for invalid', () => {
    expect(parsePubDate('invalid')).toEqual({ year: null, month: null });
    expect(parsePubDate('13/2024')).toEqual({ year: 2024, month: null });
  });
});

describe('parsePageCount', () => {
  it('parses string numbers', () => {
    expect(parsePageCount('192')).toBe(192);
  });

  it('parses actual numbers', () => {
    expect(parsePageCount(48)).toBe(48);
  });

  it('returns null for invalid', () => {
    expect(parsePageCount('abc')).toBeNull();
    expect(parsePageCount(-1)).toBeNull();
  });
});

describe('parseStringOrArray', () => {
  it('parses comma-separated string', () => {
    expect(parseStringOrArray('acao, aventura, shonen')).toEqual(['acao', 'aventura', 'shonen']);
  });

  it('passes through array', () => {
    expect(parseStringOrArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns empty for undefined', () => {
    expect(parseStringOrArray(undefined)).toEqual([]);
  });
});

describe('normalizeTitle', () => {
  it('removes accents and lowercases', () => {
    expect(normalizeTitle('Edição Definitiva')).toBe('edicao definitiva');
  });

  it('collapses spaces and removes punctuation', () => {
    expect(normalizeTitle('Batman:  O Cavaleiro   das Trevas')).toBe('batman o cavaleiro das trevas');
  });
});

describe('titleSimilarity', () => {
  it('returns 100 for identical titles', () => {
    expect(titleSimilarity('Batman #1', 'Batman #1')).toBe(100);
  });

  it('returns 100 for same title with different accents', () => {
    expect(titleSimilarity('Edição Definitiva', 'Edicao Definitiva')).toBe(100);
  });

  it('returns high score for similar titles', () => {
    const score = titleSimilarity('Batman Vol. 1', 'Batman Vol 1');
    expect(score).toBeGreaterThan(90);
  });

  it('returns low score for different titles', () => {
    const score = titleSimilarity('Batman', 'Spider-Man');
    expect(score).toBeLessThan(50);
  });
});

// === Integration tests: new fields ===

describe('Enhanced JSON Import - New Fields', () => {
  it('imports with author, isbn, imprint, description', async () => {
    const rows = [
      {
        id: `${PREFIX}NF001`,
        isbn: `${PREFIX}ISBN001`,
        name: `${TEST_PREFIX}ENH Batman Cavaleiro das Trevas`,
        author: 'Frank Miller',
        publisher: 'Panini Comics',
        imprint: 'DC Comics',
        description: 'Bruce Wayne retorna como Batman.',
        price: 39.90,
        pubDate: '2/1997',
        pages: '48',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}NF001` },
    });
    expect(entry?.author).toBe('Frank Miller');
    expect(entry?.isbn).toBe(`${PREFIX}ISBN001`);
    expect(entry?.imprint).toBe('DC Comics');
    expect(entry?.description).toBe('Bruce Wayne retorna como Batman.');
  });

  it('imports with tags (array)', async () => {
    const rows = [
      {
        id: `${PREFIX}TAG001`,
        name: `${TEST_PREFIX}ENH One Piece Vol. 1`,
        publisher: 'Panini',
        tags: [`${PREFIX}aventura`, `${PREFIX}piratas`],
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);
    expect(res.body.data.tagsCreated).toContain(`${PREFIX}aventura`);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}TAG001` },
      include: { tags: { include: { tag: true } } },
    });
    expect(entry?.tags).toHaveLength(2);
  });

  it('imports with tags (comma-separated string)', async () => {
    const rows = [
      {
        id: `${PREFIX}TAG002`,
        name: `${TEST_PREFIX}ENH Naruto Vol. 1`,
        publisher: 'Panini',
        tags: `${PREFIX}ninja, ${PREFIX}shonen`,
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}TAG002` },
      include: { tags: { include: { tag: true } } },
    });
    expect(entry?.tags).toHaveLength(2);
  });

  it('imports with characters', async () => {
    const rows = [
      {
        id: `${PREFIX}CHAR001`,
        name: `${TEST_PREFIX}ENH Batman Origins`,
        publisher: 'Panini',
        characters: [`${PREFIX}Batman`, `${PREFIX}Alfred`],
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);
    expect(res.body.data.charactersCreated).toContain(`${PREFIX}Batman`);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}CHAR001` },
      include: { characters: { include: { character: true } } },
    });
    expect(entry?.characters).toHaveLength(2);
  });

  it('imports with multiple categories', async () => {
    const rows = [
      {
        id: `${PREFIX}CAT001`,
        name: `${TEST_PREFIX}ENH Sandman Vol. 1`,
        publisher: 'Panini',
        categories: [`${PREFIX}GraphicNovel`, `${PREFIX}Fantasia`],
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}CAT001` },
      include: { categories: { include: { category: true } } },
    });
    expect(entry?.categories).toHaveLength(2);
  });

  it('imports with volumeNumber', async () => {
    const rows = [
      {
        id: `${PREFIX}VOL001`,
        name: `${TEST_PREFIX}ENH Berserk`,
        publisher: 'Panini',
        volumeNumber: 5,
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}VOL001` },
    });
    expect(entry?.volumeNumber).toBe(5);
  });

  it('imports with coverUrl', async () => {
    const rows = [
      {
        id: `${PREFIX}URL001`,
        name: `${TEST_PREFIX}ENH Gibi com Cover URL`,
        coverUrl: 'https://example.com/cover.jpg',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { barcode: `${PREFIX}URL001` },
    });
    expect(entry?.coverImageUrl).toBe('https://example.com/cover.jpg');
  });

  it('allows import without id (barcode)', async () => {
    const rows = [
      {
        name: `${TEST_PREFIX}ENH Gibi Sem Barcode`,
        sourceKey: `${PREFIX}SK001`,
        publisher: 'Editora Nacional',
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows })
      .expect(200);

    expect(res.body.data.created).toBe(1);

    const entry = await prisma.catalogEntry.findFirst({
      where: { sourceKey: `${PREFIX}SK001` },
    });
    expect(entry).not.toBeNull();
    expect(entry?.barcode).toBeNull();
  });
});

// === Deduplication tests ===

describe('Enhanced JSON Import - Deduplication', () => {
  it('deduplicates by ISBN', async () => {
    // First import
    const rows1 = [
      {
        id: `${PREFIX}DEDUP_ISBN1`,
        isbn: `${PREFIX}978-DEDUP`,
        name: `${TEST_PREFIX}ENH Dedup ISBN Original`,
      },
    ];
    await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: rows1 });

    // Second import with same ISBN, different barcode
    const rows2 = [
      {
        id: `${PREFIX}DEDUP_ISBN2`,
        isbn: `${PREFIX}978-DEDUP`,
        name: `${TEST_PREFIX}ENH Dedup ISBN Duplicate`,
      },
    ];
    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: rows2, options: { deduplication: 'any_identifier' } })
      .expect(200);

    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.duplicates).toHaveLength(1);
    expect(res.body.data.duplicates[0].matchedBy).toBe('isbn');
    expect(res.body.data.duplicates[0].confidence).toBe(100);
  });

  it('deduplicates by sourceKey', async () => {
    // First import
    const rows1 = [
      {
        sourceKey: `${PREFIX}SK_DEDUP1`,
        name: `${TEST_PREFIX}ENH Dedup SourceKey Original`,
      },
    ];
    await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: rows1 });

    // Second import with same sourceKey
    const rows2 = [
      {
        sourceKey: `${PREFIX}SK_DEDUP1`,
        name: `${TEST_PREFIX}ENH Dedup SourceKey Duplicate`,
      },
    ];
    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: rows2, options: { deduplication: 'any_identifier' } })
      .expect(200);

    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.duplicates).toHaveLength(1);
    expect(res.body.data.duplicates[0].matchedBy).toBe('source_key');
  });

  it('reports duplicate matches in response', async () => {
    const rows = [
      {
        id: `${PREFIX}NF001`, // Already exists from earlier test
        name: `${TEST_PREFIX}ENH Already Exists`,
      },
    ];

    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows, options: { deduplication: 'any_identifier' } })
      .expect(200);

    expect(res.body.data.duplicates).toHaveLength(1);
    expect(res.body.data.duplicates[0].existingTitle).toContain('Batman');
  });

  it('does not skip when skipDuplicates is false', async () => {
    const rows = [
      {
        sourceKey: `${PREFIX}NODUP_SK1`,
        name: `${TEST_PREFIX}ENH No Dedup Entry`,
      },
    ];
    // First import
    await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows });

    // Second import with skipDuplicates false — no dedup check, unique constraint will cause error
    const rows2 = [
      {
        sourceKey: `${PREFIX}NODUP_SK1`,
        name: `${TEST_PREFIX}ENH No Dedup Entry 2`,
      },
    ];
    const res = await request
      .post('/api/v1/catalog/import-json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rows: rows2, options: { skipDuplicates: false } })
      .expect(200);

    // skipped should be 0 (dedup was disabled), but error from unique constraint on sourceKey
    expect(res.body.data.skipped).toBe(0);
    expect(res.body.data.errors.length).toBeGreaterThanOrEqual(1);
  });
});
