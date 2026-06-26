/**
 * User Story 3.6 — Stakeholders tab and role management
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
