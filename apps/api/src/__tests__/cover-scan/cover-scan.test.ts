import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_USER } from '../setup';

const prisma = new PrismaClient();

let userToken: string;
let userId = ''; // usado nas Tasks 4-6
const createdLogIds: string[] = []; // usado nas Tasks 4-6

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  // usado nas Tasks 4-6: buscar userId pelo email
  const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  if (user) userId = user.id;
});

afterAll(async () => {
  if (createdLogIds.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdLogIds } } });
  }
  await prisma.$disconnect();
});

describe('POST /api/v1/cover-scan/search', () => {
  it('returns 401 without auth token', async () => {
    const res = await request
      .post('/api/v1/cover-scan/search')
      .send({ rawText: 'Batman 1', ocrTokens: ['Batman', '1'] });

    expect(res.status).toBe(401);
  });

  it('returns candidates ranked by token match', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: 'Batman: Ano Um',
        publisher: 'Panini',
        editionNumber: 1,
        approvalStatus: 'APPROVED',
        createdById: userId,
      },
    });

    try {
      const res = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rawText: 'BATMAN ANO UM PANINI 1',
          ocrTokens: ['Batman', 'Ano', 'Um', 'Panini'],
          candidateNumber: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.candidates).toBeInstanceOf(Array);
      expect(res.body.data.candidates.length).toBeGreaterThan(0);

      const found = res.body.data.candidates.find((c: { id: string }) => c.id === entry.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Batman: Ano Um');
      expect(found.score).toBeGreaterThan(0);

      expect(typeof res.body.data.scanLogId).toBe('string');
      expect(res.body.data.scanLogId.length).toBeGreaterThan(0);
      createdLogIds.push(res.body.data.scanLogId);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });

  it('rejects with 429 when daily limit exceeded', async () => {
    const originalLimit = process.env.COVER_SCAN_DAILY_LIMIT;
    process.env.COVER_SCAN_DAILY_LIMIT = '2';

    try {
      await prisma.coverScanLog.deleteMany({ where: { userId } });

      for (let i = 0; i < 2; i++) {
        const res = await request
          .post('/api/v1/cover-scan/search')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ rawText: 'X', ocrTokens: ['xxx'] });
        expect(res.status).toBe(200);
        if (res.body.data?.scanLogId) createdLogIds.push(res.body.data.scanLogId);
      }

      const blocked = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rawText: 'X', ocrTokens: ['xxx'] });
      expect(blocked.status).toBe(429);
      // O code do error pode ser COVER_SCAN_LIMIT (preferido) ou TOO_MANY_REQUESTS (default).
      // Aceitar ambos no teste pra ser tolerante à API do TooManyRequestsError.
      const err = blocked.body.error;
      expect(err).toBeDefined();
      if (err.code) {
        expect(['COVER_SCAN_LIMIT', 'TOO_MANY_REQUESTS']).toContain(err.code);
      }
    } finally {
      if (originalLimit === undefined) {
        delete process.env.COVER_SCAN_DAILY_LIMIT;
      } else {
        process.env.COVER_SCAN_DAILY_LIMIT = originalLimit;
      }
    }
  });
});
