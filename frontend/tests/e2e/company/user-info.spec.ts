/**
 * User Story 3.14 — User Info modal in user dropdown
 */
import { test, expect } from '../fixtures';

test.describe('User Story 3.14 — User Info modal (company nav)', () => {
  test('User Info option appears in the user menu', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await expect(adminPage.getByTestId('user-info-menu-item')).toBeVisible();
  });

  test('clicking User Info opens the modal with email and name fields', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('user-info-menu-item').click();

    await expect(adminPage.getByTestId('user-info-modal')).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'User Info' })).toBeVisible();
    await expect(adminPage.getByTestId('user-info-email')).toHaveValue(adminMeta.email);
    await expect(adminPage.getByTestId('user-info-name')).toBeVisible();
  });

  test('email field is read-only', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('user-info-menu-item').click();

    const emailInput = adminPage.getByTestId('user-info-email');
    await expect(emailInput).toHaveAttribute('readonly', '');
  });

  test('modal closes on × button click', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('user-info-menu-item').click();
    await adminPage.getByTestId('user-info-close').click();
    await expect(adminPage.getByTestId('user-info-modal')).not.toBeVisible();
  });

  test('User Info option appears in the user menu on a company page', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await expect(adminPage.getByTestId('user-info-menu-item')).toBeVisible();
  });

  test('can update display name', async ({ adminPage, adminMeta }) => {
    await adminPage.goto('/companies');
    await adminPage.getByRole('button', { name: adminMeta.name }).hover();
    await adminPage.getByTestId('user-info-menu-item').click();

    const nameInput = adminPage.getByTestId('user-info-name');
    await nameInput.fill(adminMeta.name);
    await adminPage.getByTestId('user-info-save').click();

    await expect(adminPage.getByTestId('user-info-modal')).not.toBeVisible();
  });
});
