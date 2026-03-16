import { test, expect } from '../../fixtures';
import { authedApiClient } from '../../helpers/api-client';
import { TEST_PREFIX, STORAGE_STATE_WITH_CONSENT } from '../../helpers/test-constants';

test.describe('Addresses CRUD', () => {
  /**
   * Helper: create a fresh user and return their API client.
   */
  async function createUserWithApi(
    loginAsFreshUser: (suffix?: string) => Promise<{
      accessToken: string;
      id: string;
      refreshCookie: string;
      name: string;
      email: string;
      role: string;
    }>,
    suffix: string,
  ) {
    const user = await loginAsFreshUser(suffix);
    const api = authedApiClient(user.accessToken);
    return { user, api };
  }

  test('should navigate to addresses page and list addresses', async ({
    browser,
    loginAsFreshUser,
    authenticateContext,
  }) => {
    // Create a user and add an address via API
    const { user, api } = await createUserWithApi(
      loginAsFreshUser,
      `addr_list_${Date.now()}`,
    );

    await api.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Casa`,
      street: `${TEST_PREFIX}Rua das Flores`,
      number: '42',
      neighborhood: 'Jardim Botanico',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22461-000',
      isDefault: true,
    });

    const context = await browser.newContext({ storageState: STORAGE_STATE_WITH_CONSENT });
    await authenticateContext(context, user);
    const page = await context.newPage();

    // Navigate to addresses page
    await page.goto('/pt-BR/addresses');
    await page.waitForLoadState('domcontentloaded');

    // Should show the address we created
    await expect(
      page.getByText(new RegExp(`${TEST_PREFIX}Rua das Flores|${TEST_PREFIX}Casa`, 'i')).first(),
    ).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test('should add a new address', async ({
    loginAsFreshUser,
  }) => {
    const { api } = await createUserWithApi(
      loginAsFreshUser,
      `addr_add_${Date.now()}`,
    );

    // Create a new address
    const res = await api.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Trabalho`,
      street: `${TEST_PREFIX}Av Paulista`,
      number: '1578',
      complement: 'Conj 101',
      neighborhood: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01310-200',
      isDefault: false,
    });

    expect(res.status).toBe(201);
    const address = res.data.data;
    expect(address.id).toBeDefined();
    expect(address.street).toContain(`${TEST_PREFIX}Av Paulista`);
    expect(address.number).toBe('1578');
    expect(address.neighborhood).toBe('Bela Vista');
    expect(address.city).toBe('Sao Paulo');
    expect(address.state).toBe('SP');
    expect(address.zipCode).toMatch(/01310/);

    // Verify the address appears in list
    const listRes = await api.get('/shipping/addresses');
    const addresses = listRes.data.data;
    const found = addresses.find((a: { id: string }) => a.id === address.id);
    expect(found).toBeDefined();
  });

  test('should edit an existing address', async ({
    loginAsFreshUser,
  }) => {
    const { api } = await createUserWithApi(
      loginAsFreshUser,
      `addr_edit_${Date.now()}`,
    );

    // Create an address first
    const createRes = await api.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Original`,
      street: `${TEST_PREFIX}Rua Original`,
      number: '10',
      neighborhood: 'Centro',
      city: 'Curitiba',
      state: 'PR',
      zipCode: '80020-000',
      isDefault: true,
    });
    const addressId = createRes.data.data.id;

    // Update the address
    const updateRes = await api.put(`/shipping/addresses/${addressId}`, {
      label: `${TEST_PREFIX}Atualizado`,
      street: `${TEST_PREFIX}Rua Atualizada`,
      number: '20',
      neighborhood: 'Batel',
      city: 'Curitiba',
      state: 'PR',
      zipCode: '80420-000',
    });

    expect(updateRes.status).toBe(200);
    const updated = updateRes.data.data;
    expect(updated.street).toContain(`${TEST_PREFIX}Rua Atualizada`);
    expect(updated.number).toBe('20');
    expect(updated.neighborhood).toBe('Batel');
    expect(updated.zipCode).toMatch(/80420/);
  });

  test('should delete an address', async ({
    loginAsFreshUser,
  }) => {
    const { api } = await createUserWithApi(
      loginAsFreshUser,
      `addr_del_${Date.now()}`,
    );

    // Create an address
    const createRes = await api.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Para Deletar`,
      street: `${TEST_PREFIX}Rua Temporaria`,
      number: '99',
      neighborhood: 'Temp',
      city: 'Brasilia',
      state: 'DF',
      zipCode: '70070-010',
      isDefault: true,
    });
    const addressId = createRes.data.data.id;

    // Delete the address
    const deleteRes = await api.delete(`/shipping/addresses/${addressId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.data.data.deleted).toBe(true);

    // Verify the address no longer appears in list
    const listRes = await api.get('/shipping/addresses');
    const addresses = listRes.data.data;
    const found = addresses.find((a: { id: string }) => a.id === addressId);
    expect(found).toBeUndefined();
  });

  test('should set an address as default', async ({
    loginAsFreshUser,
  }) => {
    const { api } = await createUserWithApi(
      loginAsFreshUser,
      `addr_def_${Date.now()}`,
    );

    // Create two addresses — first one becomes default automatically
    const addr1Res = await api.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Casa`,
      street: `${TEST_PREFIX}Rua Um`,
      number: '1',
      neighborhood: 'Bairro A',
      city: 'Fortaleza',
      state: 'CE',
      zipCode: '60110-000',
      isDefault: true,
    });
    const addr1Id = addr1Res.data.data.id;

    const addr2Res = await api.post('/shipping/addresses', {
      label: `${TEST_PREFIX}Trabalho`,
      street: `${TEST_PREFIX}Rua Dois`,
      number: '2',
      neighborhood: 'Bairro B',
      city: 'Fortaleza',
      state: 'CE',
      zipCode: '60120-000',
      isDefault: false,
    });
    const addr2Id = addr2Res.data.data.id;

    // Verify addr1 is default
    let listRes = await api.get('/shipping/addresses');
    let addresses = listRes.data.data;
    let addr1 = addresses.find((a: { id: string }) => a.id === addr1Id);
    let addr2 = addresses.find((a: { id: string }) => a.id === addr2Id);
    expect(addr1.isDefault).toBe(true);
    expect(addr2.isDefault).toBe(false);

    // Set addr2 as default
    const setDefaultRes = await api.patch(`/shipping/addresses/${addr2Id}/default`);
    expect(setDefaultRes.status).toBe(200);
    expect(setDefaultRes.data.data.isDefault).toBe(true);

    // Verify addr2 is now default and addr1 is not
    listRes = await api.get('/shipping/addresses');
    addresses = listRes.data.data;
    addr1 = addresses.find((a: { id: string }) => a.id === addr1Id);
    addr2 = addresses.find((a: { id: string }) => a.id === addr2Id);
    expect(addr1.isDefault).toBe(false);
    expect(addr2.isDefault).toBe(true);
  });
});
