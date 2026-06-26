/**
 * User Story 0.1 — Email Verification on Signup
 *
 * Tests the email/password signup flow. Verification tokens are read from the
 * PendingRegistration DB table rather than via Maildrop, because the Postmark account
 * is currently in sandbox mode and can only send to @getcaptable.com recipients.
 * Once the Postmark account is approved, the getVerificationLink() helper from
 * helpers/maildrop.ts can be used instead to test actual email delivery.
 */
import { test, expect } from '@playwright/test';
import { uniqueMailbox, maildropAddress } from '../helpers/maildrop';
import { getVerificationLinkFromDb } from '../helpers/db-token';

const API = 'http://localhost:3001/api/v1';

test.describe('User Story 0.1 — Email verification signup', () => {
  test('POST /register returns 202', async ({ request }) => {
    const email = maildropAddress(uniqueMailbox());
    const res = await request.post(`${API}/auth/register`, {
      data: { email, password: 'TestPass1!', companyName: 'Register Test Co' },
    });
    expect(res.status()).toBe(202);
    const body = await res.json();
    expect(body.message).toMatch(/verification email sent/i);
  });

  test('duplicate email returns 409', async ({ request }) => {
    const email = maildropAddress(uniqueMailbox());

    // First registration creates a PendingRegistration record
    await request.post(`${API}/auth/register`, {
      data: { email, password: 'TestPass1!', companyName: 'Dup Co' },
    });

    // Complete verification by calling the BACKEND endpoint directly.
    // getVerificationLinkFromDb returns the frontend URL (JS redirect, no HTTP 302),
    // so we extract the pending token and call the backend directly.
    const verifyUrl = await getVerificationLinkFromDb(email);
    const pendingToken = new URL(verifyUrl).searchParams.get('token');
    await request.get(`${API}/auth/verify-email?token=${pendingToken}`, { maxRedirects: 0 });

    // Second attempt with the same email must return 409
    const res = await request.post(`${API}/auth/register`, {
      data: { email, password: 'TestPass1!', companyName: 'Dup Co Again' },
    });
    expect(res.status()).toBe(409);
  });

  test('invalid verification token returns 400', async ({ request }) => {
    const res = await request.get(`${API}/auth/verify-email?token=this-token-does-not-exist`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test('full flow: register → verify → lands on /companies with token', async ({ page }) => {
    test.setTimeout(90_000);
    const email = maildropAddress(uniqueMailbox());

    // Submit the signup form on the frontend.
    // force: true on every interaction because the Google GSI iframe is positioned
    // over the form, blocking normal actionability checks.
    // 60s navigation timeout: Next.js compiles /signup lazily on first access in dev mode.
    await page.goto('/signup', { timeout: 60_000 });
    await page.getByPlaceholder('Jane').fill('E2E', { force: true });
    await page.getByPlaceholder('Smith').fill('User', { force: true });
    await page.getByPlaceholder('Acme Corp').fill('E2E Full Flow Co', { force: true });
    await page.getByPlaceholder('you@company.com').fill(email, { force: true });
    await page.getByPlaceholder('At least 8 characters').fill('TestPass1!', { force: true });
    await page.getByPlaceholder('Repeat password').fill('TestPass1!', { force: true });
    await page.getByRole('button', { name: 'Create account' }).click({ force: true });

    // Frontend should show "check your inbox" confirmation panel
    await expect(page.getByText('Check your inbox')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Get the verification URL from the DB and navigate through the full browser flow
    const verifyUrl = await getVerificationLinkFromDb(email);
    await page.goto(verifyUrl);
    await page.waitForURL('**/companies', { timeout: 20_000 });

    // JWT must be stored
    const token = await page.evaluate(() => localStorage.getItem('ct_token'));
    expect(token).toBeTruthy();
    expect(token).not.toBe('undefined');
  });
});
