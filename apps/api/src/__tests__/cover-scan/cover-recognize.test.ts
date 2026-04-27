import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';

// Mock do cliente Workers AI ANTES de importar qualquer coisa que dependa dele
vi.mock('../../shared/lib/cloudflare-ai', () => ({
  recognizeCoverImage: vi.fn(),
}));

import { recognizeCoverImage } from '../../shared/lib/cloudflare-ai';

const prisma = new PrismaClient();

let userToken: string;
let userId: string;
const createdLogIds: string[] = [];

const mockedRecognize = vi.mocked(recognizeCoverImage);

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;
  const u = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  if (!u) throw new Error('TEST_USER nao encontrado');
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

  it('uses VLM output to find catalog candidates', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Transmetropolitan',
        publisher: 'Panini Comics',
        editionNumber: 1,
        approvalStatus: 'APPROVED',
        createdById: userId,
      },
    });

    mockedRecognize.mockResolvedValue({
      title: 'Transmetropolitan',
      issue_number: 1,
      publisher: 'Panini',
      authors: [],
      series: 'Transmetropolitan',
      language: 'pt-BR',
      confidence: 'alta',
      ocr_text: 'TRANSMETROPOLITAN PANINI COMICS',
      raw_response: '{}',
    });

    try {
      const res = await request
        .post('/api/v1/cover-scan/recognize')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ imageBase64: TINY_DATA_URI });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.candidates).toBeInstanceOf(Array);
      const found = res.body.data.candidates.find((c: { id: string }) => c.id === entry.id);
      expect(found).toBeDefined();
      expect(typeof res.body.data.scanLogId).toBe('string');
      createdLogIds.push(res.body.data.scanLogId);
      expect(mockedRecognize).toHaveBeenCalledTimes(1);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });

  it('returns empty candidates if VLM fails to identify', async () => {
    mockedRecognize.mockResolvedValue({
      title: null,
      issue_number: null,
      publisher: null,
      authors: [],
      series: null,
      language: null,
      confidence: 'baixa',
      ocr_text: '',
      raw_response: '{}',
    });

    const res = await request
      .post('/api/v1/cover-scan/recognize')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ imageBase64: TINY_DATA_URI });

    expect(res.status).toBe(200);
    expect(res.body.data.candidates).toEqual([]);
    if (res.body.data.scanLogId) createdLogIds.push(res.body.data.scanLogId);
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
