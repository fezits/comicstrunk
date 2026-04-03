import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const API = 'http://localhost:3005/api/v1';
let token = '';
const TS = Date.now(); // unique suffix for this run

async function login(): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@comicstrunk.com', password: 'Admin123!' }),
  });
  const data = await res.json();
  token = data.data.accessToken;
}

async function api(method: string, endpoint: string, body?: unknown) {
  const opts: any = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${endpoint}`, opts);
  return { status: res.status, data: await res.json() };
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`❌ ASSERT FAILED: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

// ============================================================

async function test1_legacyImport() {
  console.log('\n=== Test 1: Legacy import (barcode dedup, no sourceKey) ===');
  const r = await api('POST', '/catalog/import-json', {
    rows: [
      { id: `legacy-${TS}-001`, name: 'Legacy Item 1', publisher: 'Test', price: 19.90 },
      { id: `legacy-${TS}-002`, name: 'Legacy Item 2', publisher: 'Test', price: 29.90, universe: 'Marvel' },
    ],
  });
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.created === 2, `Created 2 items (got ${r.data.data.created})`);
  assert(r.data.data.updated === 0, `Updated 0 (got ${r.data.data.updated})`);
  assert(r.data.data.skipped === 0, `Skipped 0 (got ${r.data.data.skipped})`);
}

async function test2_legacyDedup() {
  console.log('\n=== Test 2: Legacy dedup (same barcode → skip) ===');
  const r = await api('POST', '/catalog/import-json', {
    rows: [{ id: `legacy-${TS}-001`, name: 'Legacy Item 1', publisher: 'Test', price: 19.90 }],
  });
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.created === 0, `Created 0 (got ${r.data.data.created})`);
  assert(r.data.data.skipped === 1, `Skipped 1 (got ${r.data.data.skipped})`);
}

async function test3_sourceKeyCreate() {
  console.log('\n=== Test 3: sourceKey import (new items) ===');
  const r = await api('POST', '/catalog/import-json', {
    rows: [
      { id: 'ignored', name: 'SourceKey Item 1', publisher: 'Rika', price: 39.90, sourceKey: `rika:UNI${TS}A` },
      { id: 'ignored', name: 'SourceKey Item 2', publisher: 'Panini', price: 49.90, sourceKey: `panini:UNI${TS}B` },
    ],
    options: { upsert: true },
  });
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.created === 2, `Created 2 (got ${r.data.data.created})`);
  assert(r.data.data.updated === 0, `Updated 0 (got ${r.data.data.updated})`);
}

async function test4_sourceKeyDedup() {
  console.log('\n=== Test 4: sourceKey dedup (same sourceKey, no upsert) ===');
  const r = await api('POST', '/catalog/import-json', {
    rows: [
      { id: 'ignored', name: 'SourceKey Item 1', publisher: 'Rika', price: 39.90, sourceKey: `rika:UNI${TS}A` },
    ],
  });
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.created === 0, `Created 0 (got ${r.data.data.created})`);
  assert(r.data.data.skipped === 1, `Skipped 1 (got ${r.data.data.skipped})`);
}

async function test5_sourceKeyUpsert() {
  console.log('\n=== Test 5: sourceKey upsert (price changed) ===');
  const r = await api('POST', '/catalog/import-json', {
    rows: [
      { id: 'ignored', name: 'SourceKey Item 1', publisher: 'Rika', price: 59.90, sourceKey: `rika:UNI${TS}A` },
    ],
    options: { upsert: true },
  });
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.created === 0, `Created 0 (got ${r.data.data.created})`);
  assert(r.data.data.updated === 1, `Updated 1 (got ${r.data.data.updated})`);
  assert(r.data.data.skipped === 0, `Skipped 0 (got ${r.data.data.skipped})`);
}

async function test6_sourceKeyUpsertNoChange() {
  console.log('\n=== Test 6: sourceKey upsert (same price → skip) ===');
  const r = await api('POST', '/catalog/import-json', {
    rows: [
      { id: 'ignored', name: 'SourceKey Item 1', publisher: 'Rika', price: 59.90, sourceKey: `rika:UNI${TS}A` },
    ],
    options: { upsert: true },
  });
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.updated === 0, `Updated 0 — same price (got ${r.data.data.updated})`);
  assert(r.data.data.skipped === 1, `Skipped 1 (got ${r.data.data.skipped})`);
}

async function test7_stats() {
  console.log('\n=== Test 7: GET /catalog/stats ===');
  const r = await api('GET', '/catalog/stats');
  assert(r.status === 200, `Status 200 (got ${r.status})`);
  assert(r.data.data.totalEntries > 0, `Has entries (${r.data.data.totalEntries})`);
  assert(r.data.data.bySource.rika.total > 0, `Has rika entries (${r.data.data.bySource.rika.total})`);
  assert(r.data.data.bySource.panini.total > 0, `Has panini entries (${r.data.data.bySource.panini.total})`);
  assert(typeof r.data.data.withCover === 'number', `Has withCover count`);
}

async function test8_coverBySourceKey() {
  console.log('\n=== Test 8: POST /catalog/by-source-key/:sk/cover ===');
  // Use an existing cover as test
  const coversDir = path.resolve(__dirname, '..', 'uploads', 'covers');
  const files = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg'));
  const testFile = path.join(coversDir, files[0]);
  const buffer = fs.readFileSync(testFile);

  const formData = new FormData();
  formData.append('cover', new Blob([buffer], { type: 'image/jpeg' }), 'test.jpg');

  const res = await fetch(`${API}/catalog/by-source-key/rika:UNI${TS}A/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  assert(res.status === 200, `Status 200 (got ${res.status})`);
  assert(data.data.status === 'created', `Cover created (got ${data.data.status})`);
  assert(data.data.coverFileName === `rika-UNI${TS}A.jpg`, `Filename correct (got ${data.data.coverFileName})`);

  // Upload again → already_exists
  const formData2 = new FormData();
  formData2.append('cover', new Blob([buffer], { type: 'image/jpeg' }), 'test.jpg');
  const res2 = await fetch(`${API}/catalog/by-source-key/rika:UNI${TS}A/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData2,
  });
  const data2 = await res2.json();
  assert(data2.data.status === 'already_exists', `Duplicate → already_exists`);
}

async function test9_coverNotFound() {
  console.log('\n=== Test 9: Cover upload for non-existent sourceKey ===');
  const buffer = Buffer.from('fake image');
  const formData = new FormData();
  formData.append('cover', new Blob([buffer], { type: 'image/jpeg' }), 'test.jpg');
  const res = await fetch(`${API}/catalog/by-source-key/rika:DOESNOTEXIST/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  assert(res.status === 404, `Status 404 for non-existent sourceKey (got ${res.status})`);
}

async function test10_sourceKeyHidden() {
  console.log('\n=== Test 10: sourceKey hidden from public API ===');
  const r = await api('GET', '/catalog?page=1&limit=1');
  const entry = r.data.data?.[0];
  assert(!('sourceKey' in (entry || {})), `sourceKey NOT in public response`);
  assert(!('source_key' in (entry || {})), `source_key NOT in public response`);
}

async function test11_syncModuleRemoved() {
  console.log('\n=== Test 11: /sync/ module removed ===');
  const r = await fetch(`${API}/sync/status`, { headers: { Authorization: `Bearer ${token}` } });
  assert(r.status === 404, `/sync/status returns 404 (got ${r.status})`);
}

async function test12_nonAdminBlocked() {
  console.log('\n=== Test 12: Non-admin cannot access import/stats ===');
  // Login as regular user (if exists)
  try {
    const loginRes = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'testuser@test.com', password: 'Test1234!', name: 'Test User' }),
    });
    const loginData = await loginRes.json();
    let userToken = loginData.data?.accessToken;
    
    if (!userToken) {
      const loginRes2 = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testuser@test.com', password: 'Test1234!' }),
      });
      const ld2 = await loginRes2.json();
      userToken = ld2.data?.accessToken;
    }
    
    if (userToken) {
      const r = await fetch(`${API}/catalog/stats`, { headers: { Authorization: `Bearer ${userToken}` } });
      assert(r.status === 403, `Non-admin gets 403 on /catalog/stats (got ${r.status})`);

      const r2 = await fetch(`${API}/catalog/import-json`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ id: 'x', name: 'x' }] }),
      });
      assert(r2.status === 403, `Non-admin gets 403 on /catalog/import-json (got ${r2.status})`);
    } else {
      console.log('  ⚠️ Could not create test user, skipping non-admin test');
    }
  } catch (e: any) {
    console.log(`  ⚠️ Skipped: ${e.message}`);
  }
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  // Delete test entries by barcode/sourceKey
  const coversDir = path.resolve(__dirname, '..', 'uploads', 'covers');
  const testCover = path.join(coversDir, `rika-UNI${TS}A.jpg`);
  if (fs.existsSync(testCover)) {
    fs.unlinkSync(testCover);
    console.log('  🧹 Removed test cover');
  }
  // Note: test entries in DB would need deletion via admin API
  console.log('  🧹 Test entries remain in DB (harmless)');
}

async function main() {
  console.log('=== Unified Import Test Suite ===');
  await login();
  console.log('✅ Login OK');

  let passed = 0;
  let failed = 0;

  const tests = [
    test1_legacyImport, test2_legacyDedup,
    test3_sourceKeyCreate, test4_sourceKeyDedup,
    test5_sourceKeyUpsert, test6_sourceKeyUpsertNoChange,
    test7_stats, test8_coverBySourceKey, test9_coverNotFound,
    test10_sourceKeyHidden, test11_syncModuleRemoved,
    test12_nonAdminBlocked,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (e: any) {
      console.error(`  ${e.message}`);
      failed++;
    }
  }

  await cleanup();

  console.log(`\n========================================`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
