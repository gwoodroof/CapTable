import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { uniqueMailbox, maildropAddress } from './helpers/maildrop';
import { getVerificationLinkFromDb } from './helpers/db-token';

const API = 'http://localhost:3001/api/v1';
const AUTH_DIR = path.join(__dirname, '.auth');

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const mailbox = uniqueMailbox();
  const email = maildropAddress(mailbox);
  const password = 'E2eTest1!';

  const registerRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'E2E Admin', companyName: 'E2E Test Corp' }),
  });
  if (!registerRes.ok) {
    const body = await registerRes.text();
    throw new Error(`Registration failed (${registerRes.status}): ${body}`);
  }

  // Read the verification token directly from the DB (Postmark sandbox cannot email maildrop.cc;
  // switch to getVerificationLink() from helpers/maildrop when the Postmark account is approved).
  const verifyUrl = await getVerificationLinkFromDb(email);

  // Navigate a headless browser through the verification flow:
  // /auth/verify-email → backend → /auth/verified → /companies
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(verifyUrl);
  await page.waitForURL('**/companies', { timeout: 20_000 });

  // Persist auth state for test fixtures
  const storageState = await page.context().storageState();
  fs.writeFileSync(path.join(AUTH_DIR, 'admin.json'), JSON.stringify(storageState));

  // Decode JWT payload to extract tenantId
  const token = await page.evaluate(() => localStorage.getItem('ct_token'));
  if (!token) throw new Error('ct_token not found in localStorage after signup');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  fs.writeFileSync(
    path.join(AUTH_DIR, 'admin-meta.json'),
    JSON.stringify({ email: payload.email, name: payload.name || payload.email, tenantId: payload.tenantId, role: payload.role }),
  );

  await browser.close();
  console.log(`[global-setup] Admin account created: ${email} (tenantId: ${payload.tenantId})`);
}
