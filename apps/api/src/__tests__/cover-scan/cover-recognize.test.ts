import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

// Mock do cliente Workers AI ANTES de importar qualquer coisa que dependa dele
vi.mock('../../shared/lib/cloudflare-ai', () => ({
  recognizeCoverImage: vi.fn(),
}));

// Mock do searchExternal para evitar chamadas reais a Metron/Rika nos testes
vi.mock('../../modules/cover-scan/external-search.service', () => ({
  searchExternal: vi.fn().mockResolvedValue([]),
}));

import { recognizeCoverImage } from '../../shared/lib/cloudflare-ai';

const prisma = new PrismaClient();

let userToken: string;
let userId: string;
const createdLogIds: string[] = [];

const mockedRecognize = vi.mocked(recognizeCoverImage);

beforeAll(async () => {
  // /recognize requires ADMIN role
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  userToken = adminLogin.accessToken;
  const u = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
  if (!u) throw new Error('TEST_ADMIN nao encontrado');
  userId = u.id;
});

beforeEach(() => {
  mockedRecognize.mockReset();
});

afterAll(async () => {
  if (createdLogIds.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdLogIds } } });
  }
  await prisma.$disconnect();
});

const TINY_DATA_URI =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8/wD9k=';

describe('POST /api/v1/cover-scan/recognize', () => {
  it('returns 401 without auth token', async () => {
    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(401);
  });

  it('returns 400 if imageBase64 is not a data URI', async () => {
    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: 'not-a-data-uri' });

    expect(res.status).toBe(400);
  });

  it('extracts VLM identified fields and creates empty scanLog (no candidates)', async () => {
    mockedRecognize.mockResolvedValue({
      title: 'Transmetropolitan',
      issue_number: 1,
      publisher: 'Panini',
      authors: ['Warren Ellis'],
      series: 'Transmetropolitan',
      language: 'pt-BR',
      confidence: 'alta',
      ocr_text: 'TRANSMETROPOLITAN\nPanini\nWarren Ellis',
      dominant_colors: ['black', 'red'],
      raw_response: '{}',
    });

    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Phase 4: /recognize só extrai, não busca
    expect(res.body.data.candidates).toBeUndefined();
    expect(typeof res.body.data.scanLogId).toBe('string');
    expect(res.body.data.identified).toMatchObject({
      title: 'Transmetropolitan',
      issueNumber: 1,
      publisher: 'Panini',
      series: 'Transmetropolitan',
      ocrText: 'TRANSMETROPOLITAN\nPanini\nWarren Ellis',
      confidence: 'alta',
    });
    createdLogIds.push(res.body.data.scanLogId);

    // Verifica scanLog vazio (searchAttempts=0, candidatesShown=[])
    const log = await prisma.coverScanLog.findUnique({
      where: { id: res.body.data.scanLogId },
    });
    expect(log).not.toBeNull();
    expect(log!.searchAttempts).toBe(0);
    expect(log!.candidatesShown).toEqual([]);
    expect(mockedRecognize).toHaveBeenCalledTimes(1);
  });

  it('persists VLM raw response in cover_scan_logs.raw_text', async () => {
    mockedRecognize.mockResolvedValue({
      title: 'Test Title',
      issue_number: null,
      publisher: 'Test Pub',
      authors: [],
      series: null,
      language: 'en',
      confidence: 'media',
      ocr_text: 'Test OCR text',
      dominant_colors: [],
      raw_response: '{"title":"Test Title"}',
    });

    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(200);
    const scanLogId = res.body.data.scanLogId;
    createdLogIds.push(scanLogId);

    const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
    expect(log?.rawText).toContain('Test Title');
  });
});
