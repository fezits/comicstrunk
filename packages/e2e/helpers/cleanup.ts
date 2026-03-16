/**
 * E2E test data cleanup.
 *
 * All test data created by e2e tests uses the `_test_` prefix in names, titles,
 * and emails. The existing Vitest global-setup in the API package handles cleanup
 * of `_test_` prefixed rows from the database.
 *
 * This function serves as a coordination point so that global-teardown has
 * a clear place to call if additional e2e-specific cleanup is ever needed.
 */
export async function cleanupE2ETestData(): Promise<void> {
  console.log(
    '[e2e teardown] Cleanup delegates to the _test_ prefix convention. ' +
      'API test global-setup removes _test_ prefixed data on next run.',
  );
}
