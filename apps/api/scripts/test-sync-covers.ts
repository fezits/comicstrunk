import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

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
  console.log('✅ Login OK');

  // Use an existing cover as test image
  const coversDir = path.resolve(__dirname, '..', 'uploads', 'covers');
  const files = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg'));
  if (files.length === 0) {
    console.error('No cover files found for testing');
    return;
  }
  const testFile = path.join(coversDir, files[0]);
  const fileBuffer = fs.readFileSync(testFile);
  console.log(`Using test image: ${files[0]} (${fileBuffer.length} bytes)`);

  // Upload cover for the test item we created earlier (rika:999999)
  const formData = new FormData();
  formData.append('sourceKey', 'rika:999999');
  formData.append('cover', new Blob([fileBuffer], { type: 'image/jpeg' }), 'test-cover.jpg');

  const res = await fetch(`${API}/sync/covers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  console.log('Cover upload status:', res.status);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  // Try uploading again (should return already_exists)
  const formData2 = new FormData();
  formData2.append('sourceKey', 'rika:999999');
  formData2.append('cover', new Blob([fileBuffer], { type: 'image/jpeg' }), 'test-cover.jpg');

  const res2 = await fetch(`${API}/sync/covers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData2,
  });
  console.log('\nDuplicate upload status:', res2.status);
  const data2 = await res2.json();
  console.log(JSON.stringify(data2, null, 2));

  // Test with non-existent sourceKey
  const formData3 = new FormData();
  formData3.append('sourceKey', 'rika:DOESNOTEXIST');
  formData3.append('cover', new Blob([fileBuffer], { type: 'image/jpeg' }), 'test.jpg');

  const res3 = await fetch(`${API}/sync/covers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData3,
  });
  console.log('\nNon-existent sourceKey status:', res3.status, '(expected 404)');

  // Cleanup: delete test cover file
  const testCoverPath = path.join(coversDir, 'rika-999999.jpg');
  if (fs.existsSync(testCoverPath)) {
    fs.unlinkSync(testCoverPath);
    console.log('\n🧹 Cleaned up test cover file');
  }

  console.log('\n✅ Cover upload tests done!');
}

main().catch(console.error);
