import 'dotenv/config';

const API = 'http://localhost:3005/api/v1';

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@comicstrunk.com', password: 'Admin123!' }),
  });
  const data = await res.json();
  return data.data.accessToken;
}

async function main() {
  const token = await login();
  console.log('✅ Login OK\n');

  // Test 1: Current import-json endpoint
  console.log('=== Test 1: POST /catalog/import-json (existing) ===');
  const importRes = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      rows: [
        { id: 'test-import-001', name: 'Test Import Item 1', publisher: 'Test Publisher', price: 29.90 },
        { id: 'test-import-002', name: 'Test Import Item 2', publisher: 'Test Publisher', price: 39.90, universe: 'Marvel' },
      ],
    }),
  });
  console.log('Status:', importRes.status);
  const importData = await importRes.json();
  console.log(JSON.stringify(importData, null, 2));

  // Test 2: Try importing same items again (dedup test)
  console.log('\n=== Test 2: Same items again (dedup) ===');
  const dupRes = await fetch(`${API}/catalog/import-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      rows: [
        { id: 'test-import-001', name: 'Test Import Item 1', publisher: 'Test Publisher', price: 29.90 },
      ],
    }),
  });
  console.log('Status:', dupRes.status);
  const dupData = await dupRes.json();
  console.log(JSON.stringify(dupData, null, 2));

  // Test 3: Current sync/catalog endpoint
  console.log('\n=== Test 3: POST /sync/catalog (new) ===');
  const syncRes = await fetch(`${API}/sync/catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: [
        { sourceKey: 'rika:TEST001', title: 'Test Sync Item', publisher: 'Test', coverPrice: 19.90, categories: ['Marvel'] },
      ],
    }),
  });
  console.log('Status:', syncRes.status);
  const syncData = await syncRes.json();
  console.log(JSON.stringify(syncData, null, 2));

  // Test 4: Sync status
  console.log('\n=== Test 4: GET /sync/status ===');
  const statusRes = await fetch(`${API}/sync/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status:', statusRes.status);
  const statusData = await statusRes.json();
  console.log(JSON.stringify(statusData.data, null, 2));

  // Test 5: Cover upload by ID (existing)
  console.log('\n=== Test 5: POST /catalog/:id/cover (existing) ===');
  const searchRes = await fetch(`${API}/catalog?page=1&limit=1`);
  const searchData = await searchRes.json();
  const firstId = searchData.data?.[0]?.id;
  console.log('First entry ID:', firstId);
  console.log('Has sourceKey in response?', 'sourceKey' in (searchData.data?.[0] || {}));

  // Test 6: Check if barcode-based dedup works
  console.log('\n=== Test 6: Verify import dedup field ===');
  const entry1 = await fetch(`${API}/catalog/admin?page=1&limit=5&approvalStatus=APPROVED`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const e1data = await entry1.json();
  const testItem = e1data.data?.find((e: any) => e.barcode === 'test-import-001');
  console.log('Found test item by barcode?', !!testItem);
  if (testItem) console.log('Item:', { id: testItem.id, title: testItem.title, barcode: testItem.barcode, coverPrice: testItem.coverPrice });

  console.log('\n✅ All baseline tests done');
}

main().catch(console.error);
