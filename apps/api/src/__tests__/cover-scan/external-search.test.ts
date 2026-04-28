import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../shared/lib/metron', () => ({
  searchMetronIssues: vi.fn(),
  getMetronIssue: vi.fn(),
  getMetronRateStatus: vi.fn(() => ({ burst: 20, sustained: 5000 })),
}));
vi.mock('../../shared/lib/rika', () => ({
  searchRika: vi.fn(),
}));

import { searchMetronIssues } from '../../shared/lib/metron';
import { searchRika } from '../../shared/lib/rika';
import { searchExternal } from '../../modules/cover-scan/external-search.service';

const prisma = new PrismaClient();
const createdIds: string[] = [];

const mockedMetron = vi.mocked(searchMetronIssues);
const mockedRika = vi.mocked(searchRika);

let createdById = '';

beforeAll(async () => {
  const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (user) createdById = user.id;
});

beforeEach(() => {
  mockedMetron.mockReset();
  mockedRika.mockReset();
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await prisma.catalogEntry.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe('searchExternal', () => {
  it('retorna candidatos de Metron com isExternal=true', async () => {
    mockedMetron.mockResolvedValue([
      {
        id: 999,
        series: { name: 'Absolute Batman', volume: 1, year_began: 2024 },
        number: '2',
        issue: 'Absolute Batman (2024) #2',
        cover_date: '2025-01-01',
        store_date: '2024-11-13',
        image: 'https://static.metron.cloud/test.jpg',
      },
    ]);
    mockedRika.mockResolvedValue([]);

    const result = await searchExternal({
      title: 'Absolute Batman',
      issue_number: 2,
      publisher: 'DC Comics',
      authors: [],
      series: null,
      language: 'en',
      confidence: 'alta',
      ocr_text: '',
      raw_response: '{}',
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].isExternal).toBe(true);
    expect(result[0].externalSource).toBe('metron');
    expect(result[0].externalRef).toBe('999');
  });

  it('SUBSTITUI externo por local quando dedup encontra match', async () => {
    const localEntry = await prisma.catalogEntry.create({
      data: {
        title: 'Dedup Test Comic',
        publisher: 'Panini',
        editionNumber: 5,
        approvalStatus: 'APPROVED',
        createdById,
      },
    });
    createdIds.push(localEntry.id);

    mockedMetron.mockResolvedValue([
      {
        id: 888,
        series: { name: 'Dedup Test Comic', volume: 1, year_began: 2024 },
        number: '5',
        issue: 'Dedup Test Comic #5',
        cover_date: null,
        store_date: null,
        image: 'https://example.com/x.jpg',
      },
    ]);
    mockedRika.mockResolvedValue([]);

    const result = await searchExternal({
      title: 'Dedup Test Comic',
      issue_number: 5,
      publisher: 'Panini',
      authors: [],
      series: null,
      language: null,
      confidence: 'alta',
      ocr_text: '',
      raw_response: '{}',
    });

    const localFound = result.find((c) => c.id === localEntry.id);
    expect(localFound).toBeDefined();
    expect(localFound?.isExternal).toBe(false);
  });

  it('continua se Metron falhar (Promise.allSettled)', async () => {
    mockedMetron.mockRejectedValue(new Error('Metron offline'));
    mockedRika.mockResolvedValue([]);

    const result = await searchExternal({
      title: 'Anything',
      issue_number: null,
      publisher: null,
      authors: [],
      series: null,
      language: null,
      confidence: 'baixa',
      ocr_text: '',
      raw_response: '{}',
    });

    expect(result).toEqual([]);
  });
});
