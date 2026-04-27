import { apiClient, loginViaApi } from './helpers/api-client';
import { API_URL, BASE_URL, TEST_CREDENTIALS } from './helpers/test-constants';
import axios from 'axios';

async function globalSetup(): Promise<void> {
  console.log('\n[e2e global-setup] Verifying prerequisites...\n');

  // 1. Verify API is running (health endpoint is at root, not under /api/v1)
  const apiRoot = API_URL.replace(/\/api\/v1$/, '');
  try {
    const healthRes = await axios.get(`${apiRoot}/health`, { timeout: 5_000 });
    console.log(`  [OK] API is running (${apiRoot}/health → ${healthRes.status})`);
  } catch (error) {
    throw new Error(
      `[e2e global-setup] API is not running at ${apiRoot}/health.\n` +
        '  Start it with: pnpm --filter api dev\n' +
        `  Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 2. Verify Web is running
  try {
    const webRes = await axios.get(`${BASE_URL}/pt-BR/catalog`, {
      timeout: 10_000,
      validateStatus: (status) => status < 500,
    });
    console.log(`  [OK] Web is running (${BASE_URL}/pt-BR/catalog → ${webRes.status})`);
  } catch (error) {
    throw new Error(
      `[e2e global-setup] Web app is not running at ${BASE_URL}/pt-BR/catalog.\n` +
        '  Start it with: pnpm --filter web dev\n' +
        `  Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 3. Verify seed data exists
  try {
    const catalogRes = await apiClient.get('/catalog', { params: { limit: 1 } });
    const total = catalogRes.data?.pagination?.total ?? 0;
    if (total === 0) {
      throw new Error(
        `[e2e global-setup] Seed data is missing! Catalog returned 0 entries.\n` +
          '  Run: pnpm --filter api db:seed',
      );
    }
    console.log(`  [OK] Seed data present (${total} catalog entries)`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Seed data is missing')) {
      throw error;
    }
    throw new Error(
      `[e2e global-setup] Failed to verify seed data via GET /catalog.\n` +
        `  Error: ${error instanceof Error ? error.message : String(error)}\n` +
        '  Make sure the API is running and seed data is loaded: pnpm --filter api db:seed',
    );
  }

  // 4. Verify test user can login (non-fatal — rate limiting may temporarily block this)
  // Skip in production runs to avoid consuming a slot in the 5-login/15min rate limit.
  if (process.env.E2E_PROD === 'true') {
    console.log('  [SKIP] Test user login probe (E2E_PROD=true, save rate-limit slot)');
  } else {
    try {
      const { user } = await loginViaApi(
        TEST_CREDENTIALS.user.email,
        TEST_CREDENTIALS.user.password,
      );
      console.log(`  [OK] Test user login successful (${user.email}, role: ${user.role})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429')) {
        console.warn(
          `  [WARN] Login rate-limited (429). Tests requiring auth may fail until the 15-min window resets.`,
        );
      } else {
        throw new Error(
          `[e2e global-setup] Cannot login as test user (${TEST_CREDENTIALS.user.email}).\n` +
            '  Make sure the seed script creates this user: pnpm --filter api db:seed\n' +
            `  Error: ${msg}`,
        );
      }
    }
  }

  console.log('\n[e2e global-setup] All prerequisites verified. Running tests...\n');
}

export default globalSetup;
