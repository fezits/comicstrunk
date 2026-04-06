import request from 'supertest';
import { createApp } from '../../create-app';

describe('Cache-Control headers on taxonomy list endpoints', () => {
  const app = createApp();

  const endpoints = [
    '/api/v1/categories',
    '/api/v1/tags',
    '/api/v1/characters',
    '/api/v1/series',
  ];

  for (const endpoint of endpoints) {
    it(`${endpoint} returns Cache-Control: public, max-age=300`, async () => {
      const res = await request(app).get(endpoint);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=300');
    });
  }
});
