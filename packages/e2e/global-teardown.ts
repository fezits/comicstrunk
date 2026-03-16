import { cleanupE2ETestData } from './helpers/cleanup';

async function globalTeardown(): Promise<void> {
  console.log('\n[e2e global-teardown] Running cleanup...');
  await cleanupE2ETestData();
  console.log('[e2e global-teardown] Done.\n');
}

export default globalTeardown;
