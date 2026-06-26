import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// Load backend test env so DATABASE_URL is available in global-setup/teardown
dotenv.config({ path: path.join(__dirname, '../backend/.env.test') });

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  use: {
    baseURL: 'http://localhost:3000',
    storageState: { cookies: [], origins: [] },
    trace: 'on-first-retry',
    screenshot: 'on',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // workers: 1 keeps test data isolated until tests use unique emails per run
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',

  webServer: [
    {
      command: 'npm run dev',
      cwd: path.join(__dirname),
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'NODE_ENV=test npm run dev',
      cwd: path.join(__dirname, '../backend'),
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
