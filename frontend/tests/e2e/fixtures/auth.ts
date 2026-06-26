import { test as base } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(__dirname, '../.auth');

type AdminMeta = { email: string; name: string; tenantId: string; role: string };

type AuthFixtures = {
  adminPage: import('@playwright/test').Page;
  adminMeta: AdminMeta;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'admin.json'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  adminMeta: async ({}, use) => {
    const raw = fs.readFileSync(path.join(AUTH_DIR, 'admin-meta.json'), 'utf-8');
    await use(JSON.parse(raw) as AdminMeta);
  },
});

export { expect } from '@playwright/test';
