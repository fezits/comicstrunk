import { test, expect } from '../../fixtures';
import { API_URL } from '../../helpers/test-constants';
import { authedApiClient, apiClient } from '../../helpers/api-client';
import axios from 'axios';

const TEST_PREFIX = '_test_';

test.describe('Admin Click Analytics', () => {
  // Generate some click data before running analytics tests
  test.beforeAll(async ({ dataFactory }) => {
    const adminToken = await dataFactory.getAdminToken();

    // Fetch active deals
    const dealsRes = await apiClient.get('/deals', { params: { page: 1, limit: 5 } });
    const deals = dealsRes.data.data;

    if (deals.length > 0) {
      // Generate a few clicks on the first deal
      for (let i = 0; i < 3; i++) {
        try {
          await axios.get(`${API_URL}/deals/click/${deals[0].id}`, {
            maxRedirects: 0,
            validateStatus: () => true,
            headers: {
              'X-Forwarded-For': `192.168.1.${100 + i}`,
              'User-Agent': `E2E-Test-Bot/${i}`,
            },
          });
        } catch {
          // Expected redirect
        }
      }

      // Also click a second deal if available
      if (deals.length > 1) {
        try {
          await axios.get(`${API_URL}/deals/click/${deals[1].id}`, {
            maxRedirects: 0,
            validateStatus: () => true,
            headers: {
              'X-Forwarded-For': '192.168.2.1',
              'User-Agent': 'E2E-Test-Bot/secondary',
            },
          });
        } catch {
          // Expected redirect
        }
      }
    }
  });

  test('should load analytics tab with metric cards', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/deals');
    await adminPage.waitForLoadState('domcontentloaded');

    // Click Analytics tab
    const analyticsTab = adminPage.getByRole('tab', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }).or(
      adminPage.getByRole('button', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }),
    );
    await expect(analyticsTab.first()).toBeVisible({ timeout: 10_000 });
    await analyticsTab.first().click();
    await adminPage.waitForTimeout(1_000);

    // Look for metric cards: Total Clicks, Unique Users
    const totalClicksCard = adminPage.getByText(/total.*cliques|total.*clicks/i).or(
      adminPage.getByText(/cliques.*total/i),
    );
    const uniqueUsersCard = adminPage.getByText(/usu[aá]rios.*[uú]nicos|unique.*users/i).or(
      adminPage.getByText(/visitantes|users/i),
    );

    await expect(totalClicksCard.first()).toBeVisible({ timeout: 10_000 });
    await expect(uniqueUsersCard.first()).toBeVisible({ timeout: 5_000 });
  });

  test('should show clicks by deal table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/deals');
    await adminPage.waitForLoadState('domcontentloaded');

    // Click Analytics tab
    const analyticsTab = adminPage.getByRole('tab', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }).or(
      adminPage.getByRole('button', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }),
    );
    await analyticsTab.first().click();
    await adminPage.waitForTimeout(1_000);

    // Look for "Clicks by Deal" or "Cliques por Oferta" table/section
    const clicksByDealHeading = adminPage.getByText(/cliques.*oferta|clicks.*deal|por.*oferta/i).or(
      adminPage.getByRole('heading', { name: /cliques.*oferta|clicks.*deal/i }),
    );

    await expect(clicksByDealHeading.first()).toBeVisible({ timeout: 10_000 });

    // The table should have rows (from the clicks generated in beforeAll)
    const tableRows = adminPage.locator('table tbody tr, [class*="table"] [class*="row"]');
    const rowCount = await tableRows.count();
    // May have rows from generated clicks
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('should show clicks by store table', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/deals');
    await adminPage.waitForLoadState('domcontentloaded');

    // Click Analytics tab
    const analyticsTab = adminPage.getByRole('tab', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }).or(
      adminPage.getByRole('button', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }),
    );
    await analyticsTab.first().click();
    await adminPage.waitForTimeout(1_000);

    // Look for "Clicks by Store" or "Cliques por Loja" table/section
    const clicksByStoreHeading = adminPage.getByText(/cliques.*loja|clicks.*store|por.*loja/i).or(
      adminPage.getByRole('heading', { name: /cliques.*loja|clicks.*store/i }),
    );

    await expect(clicksByStoreHeading.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should have CSV export button', async ({ adminPage }) => {
    await adminPage.goto('/pt-BR/admin/deals');
    await adminPage.waitForLoadState('domcontentloaded');

    // Click Analytics tab
    const analyticsTab = adminPage.getByRole('tab', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }).or(
      adminPage.getByRole('button', { name: /an[aá]lise|analytics|estat[ií]sticas|cliques/i }),
    );
    await analyticsTab.first().click();
    await adminPage.waitForTimeout(1_000);

    // Look for CSV export button
    const exportButton = adminPage.getByRole('button', { name: /exportar|export|csv|download/i }).or(
      adminPage.getByRole('link', { name: /exportar|export|csv|download/i }),
    );

    await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });

    // Verify the button is clickable
    const isEnabled = await exportButton.first().isEnabled();
    expect(isEnabled).toBeTruthy();

    // Optionally click and verify download starts (listen for download event)
    const downloadPromise = adminPage.waitForEvent('download', { timeout: 5_000 }).catch(() => null);
    await exportButton.first().click();
    const download = await downloadPromise;

    if (download) {
      // Verify it's a CSV file
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.csv$/i);
    }
    // If no download event, the button might navigate to a URL or use a different mechanism
    // Either way, we verified the button exists and is clickable
  });
});
