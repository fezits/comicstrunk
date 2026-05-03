import { defineConfig, devices } from '@playwright/test';

const PROD = 'https://comicstrunk.com';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['list']],
  use: {
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  timeout: 60_000,
  expect: { timeout: 15_000 },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        contextOptions: {
          storageState: {
            cookies: [],
            origins: [
              {
                origin: PROD,
                localStorage: [{ name: 'cookieConsent', value: 'true' }],
              },
            ],
          },
        },
      },
    },
  ],
});
