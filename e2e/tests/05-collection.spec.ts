import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders } from './helpers';

test.describe('Collection — Add, Read, Series Progress', () => {
  let token: string;
  let catalogEntryId: string;

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    token = auth.token;
    
    // Get a catalog entry to add to collection
    const res = await request.get(`${API_URL}/catalog?limit=1`);
    const json = await res.json();
    catalogEntryId = json.data[0].id;
  });

  test('API add to collection', async ({ request }) => {
    const res = await request.post(`${API_URL}/collection`, {
      headers: authHeaders(token),
      data: {
        catalogEntryId,
        quantity: 1,
        condition: 'GOOD',
        pricePaid: 25.90,
        notes: 'E2E test item',
      },
    });
    // Could be 201 (created) or 409 (already exists)
    expect([201, 409]).toContain(res.status());
  });

  test('API list collection', async ({ request }) => {
    const res = await request.get(`${API_URL}/collection?limit=10`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThanOrEqual(0);
  });

  test('API collection requires auth', async ({ request }) => {
    const res = await request.get(`${API_URL}/collection`);
    expect(res.status()).toBe(401);
  });

  test('API series progress', async ({ request }) => {
    const res = await request.get(`${API_URL}/collection/series-progress`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
  });
});

