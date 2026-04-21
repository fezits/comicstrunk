import { mergeTests } from '@playwright/test';
import { test as authTest, type AuthFixtures, type AuthUser } from './auth.fixture';
import { testDataFixture, type TestDataFixtures } from './test-data.fixture';

export const test = mergeTests(authTest, testDataFixture);
export { expect } from '@playwright/test';
export type { AuthFixtures, AuthUser, TestDataFixtures };
