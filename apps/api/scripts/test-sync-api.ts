import 'dotenv/config';

const API = 'http://127.0.0.1:3005/api/v1';
const EMAIL = 'admin@comicstrunk.com';
const PASS = 'Admin123!';

async function main() {
  // Login
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const loginData = await loginRes.json();
  if (!loginData.data?.accessToken) {
    console.error('Login failed:', loginData);
    return;
  }
  const token = loginData.data.accessToken;
  console.log('✅ Login OK');

  // Test sync status
  const statusRes = await fetch(`${API}/sync/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status:', statusRes.status);
  if (statusRes.ok) {
    const statusData = await statusRes.json();
    console.log('Sync status:', JSON.stringify(statusData.data, null, 2));
  } else {
    console.log('Status error:', await statusRes.text());
  }

  // Test sync catalog (dry test with 2 items)
  const syncRes = await fetch(`${API}/sync/catalog`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: [
        {
          sourceKey: 'rika:999999',
          title: 'Test Sync Item - Rika',
          publisher: 'Test Publisher',
          coverPrice: 29.90,
          categories: ['Test'],
        },
        {
          sourceKey: 'panini:ZZTEST001',
          title: 'Test Sync Item - Panini',
          publisher: 'Panini',
          coverPrice: 34.90,
          categories: ['Test'],
        },
      ],
    }),
  });
  console.log('\nSync catalog:', syncRes.status);
  const syncData = await syncRes.json();
  console.log(JSON.stringify(syncData, null, 2));

  // Check that sourceKey is NOT in catalog response
  const catalogRes = await fetch(`${API}/catalog?page=1&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catalogData = await catalogRes.json();
  const entry = catalogData.data?.[0];
  console.log('\nCatalog entry has sourceKey?', 'sourceKey' in (entry || {}));
  console.log('Catalog entry keys:', Object.keys(entry || {}));

  // Cleanup: delete test items
  // (we'd need to find their IDs first, skip for now)
  console.log('\n✅ All tests done!');
}

main().catch(console.error);
