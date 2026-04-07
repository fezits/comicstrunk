import { test, expect } from '@playwright/test';
import { API_URL, apiLogin, authHeaders } from './helpers';

test.describe('Taxonomy — Categories, Tags, Characters', () => {
  test('API returns categories', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.get(`${API_URL}/categories`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  test('API returns tags', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.get(`${API_URL}/tags`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  test('API returns characters', async ({ request }) => {
    const { token } = await apiLogin(request);
    const res = await request.get(`${API_URL}/characters`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
  });

  test('API admin CRUD category', async ({ request }) => {
    const { token } = await apiLogin(request);
    
    // Create
    const createRes = await request.post(`${API_URL}/categories`, {
      headers: authHeaders(token),
      data: { name: `E2E Cat ${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const cat = (await createRes.json()).data;
    
    // Update
    const updateRes = await request.put(`${API_URL}/categories/${cat.id}`, {
      headers: authHeaders(token),
      data: { name: `E2E Cat Updated ${Date.now()}` },
    });
    expect(updateRes.status()).toBe(200);
    
    // Delete
    const deleteRes = await request.delete(`${API_URL}/categories/${cat.id}`, {
      headers: authHeaders(token),
    });
    expect(deleteRes.status()).toBe(200);
  });

  test('API admin CRUD tag', async ({ request }) => {
    const { token } = await apiLogin(request);
    
    const createRes = await request.post(`${API_URL}/tags`, {
      headers: authHeaders(token),
      data: { name: `E2E Tag ${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const tag = (await createRes.json()).data;
    
    await request.delete(`${API_URL}/tags/${tag.id}`, { headers: authHeaders(token) });
  });

  test('API admin CRUD character', async ({ request }) => {
    const { token } = await apiLogin(request);
    
    const createRes = await request.post(`${API_URL}/characters`, {
      headers: authHeaders(token),
      data: { name: `E2E Hero ${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const char = (await createRes.json()).data;
    
    await request.delete(`${API_URL}/characters/${char.id}`, { headers: authHeaders(token) });
  });
});

