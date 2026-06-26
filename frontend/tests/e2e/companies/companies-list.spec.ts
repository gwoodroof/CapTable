/**
 * User Stories 3.1, 0.2, 3.11, 3.13 — Companies list page, company creation, release notes, and form defaults/tips
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

test.describe('User Story 3.13 — Create Company form defaults and tips', () => {
  test('pre-fills Authorized Shares with 10000000 and Par Value with 0.0001', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    await expect(adminPage.getByPlaceholder('e.g. 10000000')).toHaveValue('10000000');
    await expect(adminPage.getByPlaceholder('e.g. 0.0001')).toHaveValue('0.0001');
  });

  test('hovering the Authorized Shares info icon shows a tooltip', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    // The info icons are SVGs; hover the container wrapping the first icon (next to Authorized Shares label)
    const sharesIcon = adminPage.locator('[data-tooltip="shares"]');
    await sharesIcon.hover();
    await expect(adminPage.getByText(/10,000,000 shares/)).toBeVisible();
  });

  test('hovering the Par Value info icon shows a tooltip', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    const parIcon = adminPage.locator('[data-tooltip="par"]');
    await parIcon.hover();
    await expect(adminPage.getByText(/Delaware franchise taxes/)).toBeVisible();
  });

  test('defaults are restored when modal is closed and reopened', async ({ adminPage }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    // Change values
    await adminPage.getByPlaceholder('e.g. 10000000').fill('999');
    await adminPage.getByPlaceholder('e.g. 0.0001').fill('0.99');

    // Close and reopen
    await adminPage.getByRole('button', { name: 'Cancel' }).click();
    await adminPage.getByRole('button', { name: '+ Create Company' }).click();

    await expect(adminPage.getByPlaceholder('e.g. 10000000')).toHaveValue('10000000');
    await expect(adminPage.getByPlaceholder('e.g. 0.0001')).toHaveValue('0.0001');
  });
});

test.describe('User Story 3.11 — Release Notes on /companies page', () => {
  test('Release Notes option appears in the user menu on /companies', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await expect(adminPage.getByTestId('release-notes-menu-item')).toBeVisible();
  });

  test('clicking Release Notes opens the modal', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('release-notes-menu-item').click();
    await expect(adminPage.getByTestId('release-notes-modal')).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Release Notes' })).toBeVisible();
  });

  test('Release Notes modal closes on × button click', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('release-notes-menu-item').click();
    await adminPage.getByTestId('release-notes-close').click();
    await expect(adminPage.getByTestId('release-notes-modal')).not.toBeVisible();
  });
});
