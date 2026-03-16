import { test as base } from '@playwright/test';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const TEST_PREFIX = '_test_';

// Import comic-names helpers for generating names
// Use inline versions to avoid import path issues in Playwright:

const HEROES = [
  'Wolverine', 'Storm', 'Spider-Man', 'Iron Man', 'Thor',
  'Batman', 'Superman', 'Wonder Woman', 'Flash', 'Aquaman',
  'Goku', 'Naruto', 'Luffy', 'Ichigo', 'Tanjiro',
  'Monica', 'Cebolinha', 'Cascao', 'Magali', 'Chico Bento',
];

function uniqueSuffix(): string {
  return Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(-3);
}

async function getAdminToken(): Promise<string> {
  const res = await axios.post(`${API_URL}/auth/login`, {
    email: 'admin@comicstrunk.com',
    password: 'Admin123!',
  });
  return res.data.data.accessToken;
}

export type TestDataFixtures = {
  dataFactory: {
    getAdminToken: () => Promise<string>;
    getUserToken: (email: string, password: string) => Promise<string>;
    createCatalogEntry: (overrides?: Record<string, unknown>) => Promise<{ id: string; title: string }>;
    createAndApproveCatalogEntry: (overrides?: Record<string, unknown>) => Promise<{ id: string; title: string }>;
    createCollectionItem: (userToken: string, catalogEntryId: string, overrides?: Record<string, unknown>) => Promise<{ id: string }>;
    markForSale: (userToken: string, collectionItemId: string, price: number) => Promise<void>;
    addToCart: (buyerToken: string, collectionItemId: string) => Promise<void>;
  };
};

export const testDataFixture = base.extend<TestDataFixtures>({
  dataFactory: async ({}, use) => {
    let cachedAdminToken: string | null = null;
    const userTokenCache = new Map<string, string>();

    async function token(): Promise<string> {
      if (cachedAdminToken) return cachedAdminToken;
      cachedAdminToken = await getAdminToken();
      return cachedAdminToken;
    }

    async function getUserToken(email: string, password: string): Promise<string> {
      const cached = userTokenCache.get(email);
      if (cached) return cached;
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const accessToken = res.data.data.accessToken;
      userTokenCache.set(email, accessToken);
      return accessToken;
    }

    function authed(t: string) {
      return axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${t}` },
      });
    }

    await use({
      getAdminToken: token,

      getUserToken,

      async createCatalogEntry(overrides = {}) {
        const t = await token();
        const hero = HEROES[Math.floor(Math.random() * HEROES.length)];
        const title = `${TEST_PREFIX}${hero} #${Math.floor(Math.random() * 999) + 1}_${uniqueSuffix()}`;
        const res = await authed(t).post('/catalog', {
          title,
          publisher: 'Panini',
          description: `E2E test entry: ${title}`,
          ...overrides,
        });
        return { id: res.data.data.id, title: res.data.data.title };
      },

      async createAndApproveCatalogEntry(overrides = {}) {
        const t = await token();
        const hero = HEROES[Math.floor(Math.random() * HEROES.length)];
        const title = `${TEST_PREFIX}${hero} #${Math.floor(Math.random() * 999) + 1}_${uniqueSuffix()}`;
        const createRes = await authed(t).post('/catalog', {
          title,
          publisher: 'Panini',
          description: `E2E test entry: ${title}`,
          ...overrides,
        });
        const id = createRes.data.data.id;
        // Correct flow: DRAFT → PENDING (submit) → APPROVED (approve)
        await authed(t).patch(`/catalog/${id}/submit`);
        await authed(t).patch(`/catalog/${id}/approve`);
        return { id, title: createRes.data.data.title };
      },

      async createCollectionItem(userToken: string, catalogEntryId: string, overrides = {}) {
        const res = await authed(userToken).post('/collection', {
          catalogEntryId,
          quantity: 1,
          condition: 'VERY_GOOD',
          pricePaid: 29.90,
          ...overrides,
        });
        return { id: res.data.data.id };
      },

      async markForSale(userToken: string, collectionItemId: string, price: number) {
        await authed(userToken).patch(`/collection/${collectionItemId}/sale`, {
          isForSale: true,
          salePrice: price,
        });
      },

      async addToCart(buyerToken: string, collectionItemId: string) {
        await authed(buyerToken).post('/cart', {
          collectionItemId,
        });
      },
    });
  },
});
