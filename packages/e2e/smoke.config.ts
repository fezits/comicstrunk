import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['smoke-tests.spec.ts', 'deep-flow-tests.spec.ts'],
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://comicstrunk.com',
    locale: 'pt-BR',
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', headless: true } },
  ],
});
