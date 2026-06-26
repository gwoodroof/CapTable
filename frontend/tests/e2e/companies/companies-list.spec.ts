/**
 * User Stories 3.1, 0.2 — Companies list page and company creation
 */
import { test, expect } from '../fixtures';

test.describe('User Story 3.1 — Companies list', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/companies');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin sees their company card after login', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await expect(adminPage.getByText('E2E Test Corp')).toBeVisible();
  });

  test('company card navigates into the company', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    // Click the company card (it's a button)
    await adminPage.getByText('E2E Test Corp').first().click();
    await expect(adminPage).toHaveURL(new RegExp(`/company/${adminMeta.tenantId}`), { timeout: 10_000 });
  });
});

test.describe('User Story 0.2 — Company creation', () => {
  test('opens create company modal with correct fields', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    await expect(adminPage.getByText('Create a new company')).toBeVisible();
    await expect(adminPage.getByPlaceholder('e.g. Acme Corp')).toBeVisible();
    await expect(adminPage.getByPlaceholder('e.g. 10000000')).toBeVisible();
    await expect(adminPage.getByPlaceholder('e.g. 0.0001')).toBeVisible();
  });

  test('creates a new company and navigates to its cap table', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    const companyName = `E2E Test Company ${Date.now()}`;
    await adminPage.getByPlaceholder('e.g. Acme Corp').fill(companyName);
    await adminPage.getByPlaceholder('e.g. 10000000').fill('5000000');
    await adminPage.getByPlaceholder('e.g. 0.0001').fill('0.0001');
    // Use exact: true to avoid matching the "+" prefixed header button
    await adminPage.getByRole('button', { name: 'Create Company', exact: true }).click();

    // Should navigate to the new company's cap table
    await expect(adminPage).toHaveURL(/\/company\/[^/]+\/cap_table/, { timeout: 10_000 });
  });

  test('rejects zero authorized shares with a validation error', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    await adminPage.getByPlaceholder('e.g. Acme Corp').fill('Bad Co');
    await adminPage.getByPlaceholder('e.g. 10000000').fill('0');
    await adminPage.getByPlaceholder('e.g. 0.0001').fill('0.0001');
    await adminPage.getByRole('button', { name: 'Create Company', exact: true }).click();

    // The modal must still be open (form did not submit successfully)
    await expect(adminPage.getByText('Create a new company')).toBeVisible();
  });
});
