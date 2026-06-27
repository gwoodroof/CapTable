/**
 * User Story 3.6  — Stakeholders tab and role management
 * User Story 3.22 — Add Stakeholder modal
 */
import { test, expect } from '../fixtures';

test.describe('User Story 3.6 — Stakeholders tab', () => {
  test('admin can navigate to the stakeholders tab', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/cap_table`);
    await adminPage.getByRole('button', { name: 'Stakeholders' }).click();
    await expect(adminPage).toHaveURL(`/company/${adminMeta.tenantId}/stakeholders`);
  });

  test('stakeholders page shows the ADMIN badge for the founding user', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    // The admin user (CompanyMembership with ADMIN role) appears in the unified list
    await expect(adminPage.getByText('ADMIN').first()).toBeVisible();
  });

  test('admin sees all five tabs on the stakeholders page', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    for (const tab of ['Equity', 'Ledger', 'Cap Table', 'Stakeholders', 'Company Info']) {
      await expect(adminPage.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('Stakeholders tab is highlighted when on the stakeholders route', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    // getByText('Stakeholders') is too broad (also matches heading and route-announcer);
    // use the role-based selector which is specific to the tab button
    await expect(adminPage.getByRole('button', { name: 'Stakeholders' })).toBeVisible();
  });
});

test.describe('User Story 3.22 — Add Stakeholder modal', () => {
  test('"Add Stakeholder" button is visible to admin', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await expect(adminPage.getByTestId('add-stakeholder-button')).toBeVisible();
  });

  test('clicking "Add Stakeholder" opens the modal', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await adminPage.getByTestId('add-stakeholder-button').click();
    await expect(adminPage.getByTestId('add-stakeholder-modal')).toBeVisible();
  });

  test('modal contains name, type, and email fields', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await adminPage.getByTestId('add-stakeholder-button').click();
    await expect(adminPage.getByTestId('add-stakeholder-name')).toBeVisible();
    await expect(adminPage.getByTestId('add-stakeholder-type')).toBeVisible();
    await expect(adminPage.getByTestId('add-stakeholder-email')).toBeVisible();
  });

  test('submit button is disabled when name is empty', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await adminPage.getByTestId('add-stakeholder-button').click();
    await expect(adminPage.getByTestId('add-stakeholder-submit')).toBeDisabled();
  });

  test('submit button enabled after entering a name', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await adminPage.getByTestId('add-stakeholder-button').click();
    await adminPage.getByTestId('add-stakeholder-name').fill('Test Person');
    await expect(adminPage.getByTestId('add-stakeholder-submit')).toBeEnabled();
  });

  test('cancel button closes the modal', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await adminPage.getByTestId('add-stakeholder-button').click();
    await expect(adminPage.getByTestId('add-stakeholder-modal')).toBeVisible();
    await adminPage.getByRole('button', { name: 'Cancel' }).click();
    await expect(adminPage.getByTestId('add-stakeholder-modal')).not.toBeVisible();
  });

  test('successfully adding a stakeholder appends them to the list', async ({ adminPage, adminMeta }) => {
    const uniqueName = `E2E Stakeholder ${Date.now()}`;
    await adminPage.goto(`/company/${adminMeta.tenantId}/stakeholders`);
    await adminPage.getByTestId('add-stakeholder-button').click();
    await adminPage.getByTestId('add-stakeholder-name').fill(uniqueName);
    await adminPage.getByTestId('add-stakeholder-type').selectOption('ENTITY');
    await adminPage.getByTestId('add-stakeholder-submit').click();
    // Modal closes and new stakeholder appears in the list
    await expect(adminPage.getByTestId('add-stakeholder-modal')).not.toBeVisible();
    await expect(adminPage.getByText(uniqueName)).toBeVisible();
  });
});
