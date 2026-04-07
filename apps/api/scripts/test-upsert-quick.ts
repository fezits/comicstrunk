import 'dotenv/config';
const API = 'http://localhost:3005/api/v1';

async function main() {
  const l = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@comicstrunk.com', password: 'Admin123!' }) });
  const { data: { accessToken: token } } = await l.json();

  // Create fresh
  const r1 = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rows: [{ id: 'x', name: 'UpsertTest', publisher: 'T', price: 10, sourceKey: 'rika:UTEST99' }], options: { upsert: true } }),
  });
  const d1 = await r1.json();
  console.log('Create:', JSON.stringify(d1.data));

  // Upsert price change
  const r2 = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rows: [{ id: 'x', name: 'UpsertTest', publisher: 'T', price: 99.90, sourceKey: 'rika:UTEST99' }], options: { upsert: true } }),
  });
  const d2 = await r2.json();
  console.log('Upsert:', JSON.stringify(d2.data));

  // Cover by sourceKey
  const r3 = await fetch(`${API}/catalog/by-source-key/rika:UTEST99/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Cover (no file):', r3.status);

  // Test stats
  const r4 = await fetch(`${API}/catalog/stats`, { headers: { Authorization: `Bearer ${token}` } });
  const d4 = await r4.json();
  console.log('Stats:', r4.status, JSON.stringify(d4.data).substring(0, 100));
}
main().catch(console.error);
