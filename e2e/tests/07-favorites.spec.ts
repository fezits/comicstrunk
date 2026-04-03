import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders } from './helpers';

test.describe('Favorites', () => {
  let token: string;
  let catalogEntryId: string;

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    token = auth.token;
    const res = await request.get(`${API_URL}/catalog?limit=1`);
    const json = await res.json();
    catalogEntryId = json.data[0].id;
  });

  test('API toggle favorite', async ({ request }) => {
    const res = await request.post(`${API_URL}/favorites/toggle`, {
      headers: authHeaders(token),
      data: { catalogEntryId },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty('favorited');
  });

  test('API list favorites', async ({ request }) => {
    const res = await request.get(`${API_URL}/favorites?page=1&limit=10`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
  });

  test('API check favorite status', async ({ request }) => {
    const res = await request.get(`${API_URL}/favorites/check/${catalogEntryId}`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(200);
  });
});

