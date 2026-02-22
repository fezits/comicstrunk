import { describe, it, expect } from 'vitest';
import { request } from './setup';

describe('GET /health', () => {
  it('returns 200 with status, uptime, database, and contractVersion', async () => {
    const res = await request.get('/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      database: 'ok',
    });
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('contractVersion');
    expect(typeof res.body.contractVersion).toBe('string');
  });
});
