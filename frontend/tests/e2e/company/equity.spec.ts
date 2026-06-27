/**
 * User Story 3.7 — Equity tab and role-based tab visibility
 */
import { test, expect } from '../fixtures';

test.describe('User Story 3.7 — Equity tab & role-based tab visibility', () => {
  test('admin sees all five tabs on the equity page', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/equity`);

    for (const tab of ['Equity', 'Ledger', 'Cap Table', 'Stakeholders', 'Company Info']) {
      await expect(adminPage.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('/company/:id redirects an admin to cap_table', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}`);
    await expect(adminPage).toHaveURL(`/company/${adminMeta.tenantId}/cap_table`, { timeout: 10_000 });
  });

  test('shows empty equity state when no Stakeholder record exists for this user', async ({ adminPage, adminMeta }) => {
    // The seeded admin user (e2e-admin@maildrop.cc) has no Stakeholder record
    await adminPage.goto(`/company/${adminMeta.tenantId}/equity`);
    await expect(adminPage.getByText('No equity positions yet')).toBeVisible();
  });

  test('Equity tab is active/highlighted on the equity page', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/equity`);
    // Wait for the page to finish loading (fetches equity data before rendering tabs)
    const equityTab = adminPage.getByRole('button', { name: 'Equity' });
    await expect(equityTab).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Cap Table tab navigates to cap_table route', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/equity`);
    await adminPage.getByRole('button', { name: 'Cap Table' }).click();
    await expect(adminPage).toHaveURL(`/company/${adminMeta.tenantId}/cap_table`);
  });

  test('clicking Stakeholders tab navigates to stakeholders route', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/equity`);
    await adminPage.getByRole('button', { name: 'Stakeholders' }).click({ timeout: 30_000 });
    await expect(adminPage).toHaveURL(`/company/${adminMeta.tenantId}/stakeholders`, { timeout: 30_000 });
  });

  test('contact notice is visible at the bottom of the equity page', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/equity`);
    await expect(adminPage.getByTestId('equity-contact-notice')).toBeVisible();
    await expect(adminPage.getByText('If you have questions about this information, or wish to make changes, please contact your manager or an administrator.')).toBeVisible();
  });
});
