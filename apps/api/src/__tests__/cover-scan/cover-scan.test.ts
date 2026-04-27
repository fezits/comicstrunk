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
});
