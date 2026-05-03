import { test, expect } from '../../fixtures';

const LOCALE = 'pt-BR';

// Retries absorb known flakiness in the cached admin auth fixture.
test.describe.configure({ retries: 2 });

test.describe('Filtro "Duplicados na coleção" — regression', () => {
  test('checkbox toggles, persists in URL, and request includes duplicates=true', async ({
    adminPage,
  }) => {
    const collectionRequests: string[] = [];

    adminPage.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/v1/collection?') || url.endsWith('/api/v1/collection')) {
        if (!url.includes('/stats')) collectionRequests.push(url);
      }
    });

    await adminPage.goto(`/${LOCALE}/collection`);
    await adminPage.waitForLoadState('networkidle');

    // Capture baseline request count
    const baselineRequests = collectionRequests.length;

    // Find and check the checkbox
    const dupCheckbox = adminPage.getByLabel(/duplicados na cole[cç][aã]o/i);
    await expect(dupCheckbox).toBeVisible({ timeout: 15000 });
    await expect(dupCheckbox).not.toBeChecked();

    await dupCheckbox.click();
    await adminPage.waitForTimeout(1500);

    // Now: URL should contain duplicates=true
    expect(adminPage.url()).toContain('duplicates=true');

    // Checkbox should be checked
    await expect(dupCheckbox).toBeChecked();

    // A new request should have fired with duplicates=true
    const newRequests = collectionRequests.slice(baselineRequests);
    const matchingRequest = newRequests.find((u) => u.includes('duplicates=true'));
    expect(matchingRequest).toBeTruthy();

    // Toggle off — checkbox unchecks, URL clears, new request without duplicates
    await dupCheckbox.click();
    await adminPage.waitForTimeout(1500);

    expect(adminPage.url()).not.toContain('duplicates=true');
    await expect(dupCheckbox).not.toBeChecked();
  });

  test('navigating with ?duplicates=true keeps checkbox checked on initial render', async ({
    adminPage,
  }) => {
    await adminPage.goto(`/${LOCALE}/collection?duplicates=true`);
    await adminPage.waitForLoadState('networkidle');

    const dupCheckbox = adminPage.getByLabel(/duplicados na cole[cç][aã]o/i);
    await expect(dupCheckbox).toBeChecked({ timeout: 15000 });
  });
});
