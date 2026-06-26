/**
 * User Stories 3.5, 3.8, 3.11 — Company switcher dropdown, user menu, and release notes
 */
import { test, expect } from '../fixtures';

test.describe('User Story 3.8 — User menu dropdown', () => {
  test('hovering the user name opens a dropdown with Log Out and Contact Support', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);

    // The user menu opens on hover (onMouseEnter); clicking toggles which can close it on mouseenter+click
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();

    await expect(adminPage.getByRole('button', { name: 'Log Out' })).toBeVisible();
    await expect(adminPage.getByText('Contact Support')).toBeVisible();
  });

  test('Log Out clears the token and redirects to /login', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);

    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByRole('button', { name: 'Log Out' }).click();

    await expect(adminPage).toHaveURL(/\/login/);
    const token = await adminPage.evaluate(() => localStorage.getItem('ct_token'));
    expect(token).toBeNull();
  });

  test('dropdown closes when clicking outside', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);

    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await expect(adminPage.getByRole('button', { name: 'Log Out' })).toBeVisible();

    // Move mouse far away to trigger the close timer (onMouseLeave + 150ms delay)
    await adminPage.mouse.move(200, 400);
    await expect(adminPage.getByRole('button', { name: 'Log Out' })).not.toBeVisible();
  });
});

test.describe('User Story 3.11 — Release Notes modal', () => {
  test('Release Notes option appears in the user menu', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await expect(adminPage.getByTestId('release-notes-menu-item')).toBeVisible();
  });

  test('clicking Release Notes opens a modal with the heading', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('release-notes-menu-item').click();
    await expect(adminPage.getByTestId('release-notes-modal')).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Release Notes' })).toBeVisible();
  });

  test('Release Notes modal closes on × button click', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('release-notes-menu-item').click();
    await expect(adminPage.getByTestId('release-notes-modal')).toBeVisible();
    await adminPage.getByTestId('release-notes-close').click();
    await expect(adminPage.getByTestId('release-notes-modal')).not.toBeVisible();
  });

  test('Release Notes modal closes on backdrop click', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('release-notes-menu-item').click();
    await expect(adminPage.getByTestId('release-notes-modal')).toBeVisible();
    // Click the backdrop (outside the modal panel)
    await adminPage.getByTestId('release-notes-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(adminPage.getByTestId('release-notes-modal')).not.toBeVisible();
  });
});

test.describe('User Story 3.9 — Company monogram fallback', () => {
  test('shows a monogram with the capitalized first letter when no icon is set', async ({ adminPage, adminMeta }) => {
    // E2E Test Corp has no icon set — nav must render the "E" monogram
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    // Wait for the page to finish loading (CompanyNav only mounts after loading is false)
    await expect(adminPage.getByRole('heading', { name: 'Cap Table Dashboard' })).toBeVisible({ timeout: 20_000 });
    const monogram = adminPage.getByTestId('company-monogram');
    await expect(monogram).toBeVisible();
    await expect(monogram).toHaveText('E');
  });
});

test.describe('User Story 3.5 — Company switcher dropdown', () => {
  test('clicking the company name opens the switcher with a checkmark on the current company', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await expect(adminPage.getByRole('heading', { name: 'Cap Table Dashboard' })).toBeVisible({ timeout: 30_000 });

    // Click the company switcher button (contains company name + ▾ arrow)
    await adminPage.getByRole('button', { name: /E2E Test Corp/ }).first().click();

    // The current company appears with a ✓ checkmark
    await expect(adminPage.getByText('✓')).toBeVisible();
    await expect(adminPage.getByText('E2E Test Corp').first()).toBeVisible();
  });

  test('switcher shows "+ All companies" link', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await expect(adminPage.getByRole('heading', { name: 'Cap Table Dashboard' })).toBeVisible({ timeout: 30_000 });

    await adminPage.getByRole('button', { name: /E2E Test Corp/ }).first().click();
    await expect(adminPage.getByText('+ All companies')).toBeVisible();
  });

  test('"+ All companies" link navigates to /companies', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await expect(adminPage.getByRole('heading', { name: 'Cap Table Dashboard' })).toBeVisible({ timeout: 30_000 });

    await adminPage.getByRole('button', { name: /E2E Test Corp/ }).first().click();
    await adminPage.getByRole('button', { name: '+ All companies' }).click();

    await expect(adminPage).toHaveURL(/\/companies/);
  });
});
