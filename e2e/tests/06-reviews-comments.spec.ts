import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders } from './helpers';

test.describe('Reviews & Comments', () => {
  let token: string;
  let catalogEntryId: string;

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    token = auth.token;
    const res = await request.get(`${API_URL}/catalog?limit=1`);
    const json = await res.json();
    catalogEntryId = json.data[0].id;
  });

  test('API create catalog review', async ({ request }) => {
    const res = await request.post(`${API_URL}/reviews/catalog`, {
      headers: authHeaders(token),
      data: {
        catalogEntryId,
        rating: 5,
        text: 'Great comic! E2E test review.',
      },
    });
    // 201 or 409 (already reviewed)
    expect([201, 409]).toContain(res.status());
  });

  test('API get reviews for entry', async ({ request }) => {
    const res = await request.get(`${API_URL}/reviews/catalog/${catalogEntryId}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
  });

  test('API create comment', async ({ request }) => {
    const res = await request.post(`${API_URL}/comments`, {
      headers: authHeaders(token),
      data: {
        catalogEntryId,
        content: 'E2E test comment ' + Date.now(),
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.content).toContain('E2E test comment');
  });

  test('API get comments for entry', async ({ request }) => {
    const res = await request.get(`${API_URL}/comments/catalog/${catalogEntryId}?page=1&limit=10`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
  });
});

