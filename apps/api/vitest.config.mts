import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
    globalSetup: './src/__tests__/global-setup.ts',
    include: ['src/__tests__/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
  },
});
