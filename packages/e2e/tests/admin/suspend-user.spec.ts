import { test, expect } from '../../fixtures';
import axios from 'axios';

const LOCALE = 'pt-BR';
const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

test.describe.configure({ retries: 2 });

test.describe('Admin: suspender usuário (full feature)', () => {
  test('admin suspends a user, suspended user cannot login, then unsuspend restores access', async ({
    adminPage,
    loginAsFreshUser,
    page: anonPage,
  }) => {
    // 1) Provision a fresh user (creates account, returns tokens)
    const target = await loginAsFreshUser(`suspendvictim${Date.now()}`);
    expect(target.suspended ?? false).toBeFalsy();

    // 2) Confirm victim can login at the start
    const loginRes1 = await axios.post(
      `${API_URL}/auth/login`,
      { email: target.email, password: 'Test1234!Aa' },
      { validateStatus: () => true },
    );
    expect(loginRes1.status).toBe(200);

    // 3) Admin goes directly to victim's detail page
    await adminPage.goto(`/${LOCALE}/admin/users/${target.id}`);
    await adminPage.waitForLoadState('networkidle');
    // Confirm we landed on detail (heading "Detalhes do Usuario")
    await expect(adminPage.getByRole('heading', { name: /detalhes do usu/i })).toBeVisible({
      timeout: 15000,
    });

    // Click "Suspender" — opens dialog. The detail page button is unique here.
    await adminPage.getByRole('button', { name: /^suspender$/i }).click();

    // Wait for dialog (radix dialog has role="dialog")
    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill the textarea inside the dialog
    const reasonField = dialog.locator('textarea').first();
    await expect(reasonField).toBeVisible({ timeout: 5000 });
    await reasonField.fill('Conta suspensa por testes automatizados e2e (>=10 chars)');

    // Confirm in the dialog (the second "Suspender" button — inside the dialog)
    await dialog.getByRole('button', { name: /^suspender$/i }).click();

    // Wait for success toast
    await expect(adminPage.locator('[data-sonner-toast]').first()).toContainText(
      /suspenso/i,
      { timeout: 8000 },
    );

    // 4) Verify badge "Suspenso" rendered on detail page
    await expect(adminPage.getByText('Suspenso').first()).toBeVisible({ timeout: 5000 });

    // 5) Suspended user cannot login (gets 403)
    const loginRes2 = await axios.post(
      `${API_URL}/auth/login`,
      { email: target.email, password: 'Test1234!Aa' },
      { validateStatus: () => true },
    );
    expect(loginRes2.status).toBe(403);
    expect(loginRes2.data?.error?.message).toMatch(/suspensa|suspens/i);

    // 6) Login UI shows the suspension message (not generic invalid credentials)
    await anonPage.goto(`/${LOCALE}/login`);
    await anonPage.waitForLoadState('networkidle');
    await anonPage.getByLabel(/e-?mail/i).fill(target.email);
    await anonPage.getByLabel(/senha/i).fill('Test1234!Aa');
    await anonPage.getByRole('button', { name: /entrar/i }).click();

    await expect(anonPage.locator('[data-sonner-toast]').first()).toContainText(
      /suspensa|suspens/i,
      { timeout: 8000 },
    );

    // 7) Admin clicks "Remover suspensao" on detail page (still on it)
    await adminPage.getByRole('button', { name: /remover suspens/i }).click();
    await expect(adminPage.locator('[data-sonner-toast]').first()).toContainText(
      /suspens/i,
      { timeout: 8000 },
    );

    // Badge "Suspenso" should be gone
    await expect(adminPage.getByText('Suspenso').first()).toBeHidden({ timeout: 5000 });

    // 8) Victim can login again
    const loginRes3 = await axios.post(
      `${API_URL}/auth/login`,
      { email: target.email, password: 'Test1234!Aa' },
      { validateStatus: () => true },
    );
    expect(loginRes3.status).toBe(200);
  });

  test('cannot suspend admin role', async ({ adminPage, loginAsAdmin }) => {
    const admin = await loginAsAdmin();

    // Try suspending admin via direct API — backend should refuse
    const accessToken = admin.accessToken;
    const res = await axios.post(
      `${API_URL}/admin/users/${admin.id}/suspend`,
      { reason: 'attempting suspension on admin role for testing' },
      { headers: { Authorization: `Bearer ${accessToken}` }, validateStatus: () => true },
    );
    // Expect 400 — either "voce nao pode suspender a si mesmo" OR "Nao e possivel suspender um administrador"
    expect(res.status).toBe(400);
  });

  test('suspended access token still valid for at most a few seconds before middleware catches it', async ({
    loginAsFreshUser,
    loginAsAdmin,
  }) => {
    const target = await loginAsFreshUser(`suspendmid${Date.now()}`);
    const admin = await loginAsAdmin();

    // Verify token works (any authenticated endpoint)
    const before = await axios.get(`${API_URL}/collection?limit=1`, {
      headers: { Authorization: `Bearer ${target.accessToken}` },
      validateStatus: () => true,
    });
    expect(before.status).toBe(200);

    // Admin suspends
    await axios.post(
      `${API_URL}/admin/users/${target.id}/suspend`,
      { reason: 'middleware test, must catch suspended on next request' },
      { headers: { Authorization: `Bearer ${admin.accessToken}` } },
    );

    // Same access token should now be rejected by middleware (403)
    const after = await axios.get(`${API_URL}/collection?limit=1`, {
      headers: { Authorization: `Bearer ${target.accessToken}` },
      validateStatus: () => true,
    });
    expect(after.status).toBe(403);

    // Cleanup: unsuspend
    await axios.post(
      `${API_URL}/admin/users/${target.id}/unsuspend`,
      {},
      { headers: { Authorization: `Bearer ${admin.accessToken}` } },
    );
  });
});
