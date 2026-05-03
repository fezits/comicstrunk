import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { request, loginAs, TEST_ADMIN } from '../setup';

const prisma = new PrismaClient();

// cover-scan endpoints require ADMIN role (consume Workers AI quota etc.)
let userToken: string;
let userId = '';
const createdLogIds: string[] = [];

beforeAll(async () => {
  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  userToken = adminLogin.accessToken;

  const user = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
  if (user) userId = user.id;
});

afterAll(async () => {
  if (createdLogIds.length > 0) {
    await prisma.coverScanLog.deleteMany({ where: { id: { in: createdLogIds } } });
  }
  await prisma.$disconnect();
});

// Helper: cria scanLog vazio (simula resultado de /recognize) para testes
// que exercitam apenas o /search.
async function createEmptyScanLog(forUserId: string): Promise<string> {
  const log = await prisma.coverScanLog.create({
    data: {
      userId: forUserId,
      rawText: '{}',
      ocrTokens: '',
      candidatesShown: [],
      searchAttempts: 0,
    },
  });
  createdLogIds.push(log.id);
  return log.id;
}

describe('POST /api/v1/cover-scan/search', () => {
  it('returns 401 without auth token', async () => {
    const res = await request
      .post('/api/v1/cover-scan/search')
      .send({ scanLogId: 'irrelevant', title: 'Batman' });

    expect(res.status).toBe(401);
  });

  it('returns 404 if scanLog does not belong to user', async () => {
    // Create a scanLog under a different user (subscriber)
    const otherUser = await prisma.user.findUnique({ where: { email: 'subscriber@test.com' } });
    if (!otherUser) throw new Error('subscriber user not found');
    const log = await prisma.coverScanLog.create({
      data: { userId: otherUser.id, rawText: '{}', ocrTokens: '', candidatesShown: [], searchAttempts: 0 },
    });
    createdLogIds.push(log.id);

    const res = await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ scanLogId: log.id, title: 'Anything' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when no textual fields are provided', async () => {
    const scanLogId = await createEmptyScanLog(userId);
    const res = await request
      .post('/api/v1/cover-scan/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ scanLogId });
    expect(res.status).toBe(400);
  });

  it('returns candidates ranked by token match and increments searchAttempts', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: '_test_search_Batman: Ano Um',
        publisher: 'Panini',
        editionNumber: 1,
        approvalStatus: 'APPROVED',
        createdById: userId,
      },
    });

    const scanLogId = await createEmptyScanLog(userId);

    try {
      const res = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          scanLogId,
          title: 'Batman Ano Um',
          publisher: 'Panini',
          issueNumber: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.candidates).toBeInstanceOf(Array);
      expect(res.body.data.candidates.length).toBeGreaterThan(0);

      const found = res.body.data.candidates.find((c: { id: string }) => c.id === entry.id);
      expect(found).toBeDefined();
      expect(found.score).toBeGreaterThan(0);
      expect(res.body.data.scanLogId).toBe(scanLogId);

      // searchAttempts incrementa
      const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
      expect(log!.searchAttempts).toBe(1);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });

  it('iterative search increments searchAttempts each time', async () => {
    const scanLogId = await createEmptyScanLog(userId);
    for (let i = 1; i <= 3; i++) {
      const res = await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ scanLogId, title: 'Anything' });
      expect(res.status).toBe(200);
    }
    const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
    expect(log!.searchAttempts).toBe(3);
  });

  it('records user choice and updates chosen_entry_id', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        title: '_test_choice_Test Entry',
        publisher: 'Test',
        approvalStatus: 'APPROVED',
        createdById: userId,
      },
    });

    try {
      const scanLogId = await createEmptyScanLog(userId);
      // simula uma busca pra popular candidatesShown
      await request
        .post('/api/v1/cover-scan/search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ scanLogId, title: 'Test' });

      const choose = await request
        .post('/api/v1/cover-scan/choose')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ scanLogId, chosenEntryId: entry.id });

      expect(choose.status).toBe(200);

      const log = await prisma.coverScanLog.findUnique({ where: { id: scanLogId } });
      expect(log?.chosenEntryId).toBe(entry.id);
    } finally {
      await prisma.catalogEntry.delete({ where: { id: entry.id } });
    }
  });

  it('rejects choose if scanLog belongs to another user', async () => {
    const otherUser = await prisma.user.findUnique({ where: { email: 'subscriber@test.com' } });
    if (!otherUser) throw new Error('subscriber user not found');

    const log = await prisma.coverScanLog.create({
      data: {
        userId: otherUser.id,
        rawText: '{}',
        ocrTokens: '',
        candidatesShown: [],
        searchAttempts: 0,
      },
    });
    createdLogIds.push(log.id);

    const res = await request
      .post('/api/v1/cover-scan/choose')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ scanLogId: log.id, chosenEntryId: null });

    expect(res.status).toBe(404);
  });

  // Phase 4 (2026-05-03): rate limit é só no /recognize. /search não consome
  // neuron quota. Logo, esse teste antigo não se aplica mais — removido.
});
