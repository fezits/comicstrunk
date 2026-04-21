import 'dotenv/config';
const API = 'http://localhost:3005/api/v1';

async function main() {
  const l = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@comicstrunk.com', password: 'Admin123!' }) });
  const { data: { accessToken: token } } = await l.json();

  const sk = `rika:DEBUGTEST${Date.now()}`;

  // Create
  const r1 = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rows: [{ id: 'x', name: 'Debug Test', publisher: 'T', price: 10, sourceKey: sk }], options: { upsert: true } }),
  });
  console.log('Create:', JSON.stringify(await r1.json()));

  // Upsert with different price
  const r2 = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rows: [{ id: 'x', name: 'Debug Test', publisher: 'T', price: 99.90, sourceKey: sk }], options: { upsert: true } }),
  });
  console.log('Upsert:', JSON.stringify(await r2.json()));

  // Same price upsert
  const r3 = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rows: [{ id: 'x', name: 'Debug Test', publisher: 'T', price: 99.90, sourceKey: sk }], options: { upsert: true } }),
  });
  console.log('Same price:', JSON.stringify(await r3.json()));
}
main().catch(console.error);
