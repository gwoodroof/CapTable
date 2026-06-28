/**
 * User Story 3.18 — Actions menu on the Ledger tab
 * User Story 3.19 — Options Holder Offboarding Wizard
 * User Story 3.21 — Investor Buyout Wizard
 * User Story 3.23 — Stakeholder Picker on Register New Investment
 */
import { test, expect } from '../fixtures';

test.describe('User Story 3.18 — Actions menu on Ledger tab', () => {
  test('Actions button is visible on the Ledger page', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await expect(adminPage.getByTestId('actions-menu-button')).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Actions opens a dropdown with all items', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();

    await expect(adminPage.getByTestId('actions-menu-dropdown')).toBeVisible();
    await expect(adminPage.getByTestId('actions-add-investment')).toBeVisible();
    await expect(adminPage.getByTestId('actions-grant-options')).toBeVisible();
    await expect(adminPage.getByTestId('actions-offboard-options-holder')).toBeVisible();
  });

  test('standalone "+ Add Investment" and "+ Grant Options" buttons are gone', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await expect(adminPage.getByRole('button', { name: '+ Add Investment' })).not.toBeVisible();
    await expect(adminPage.getByRole('button', { name: '+ Grant Options' })).not.toBeVisible();
  });

  test('clicking outside the dropdown closes it', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await expect(adminPage.getByTestId('actions-menu-dropdown')).toBeVisible();

    await adminPage.mouse.click(100, 100);
    await expect(adminPage.getByTestId('actions-menu-dropdown')).not.toBeVisible();
  });

  test('Add Investment navigates to investments/new', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-add-investment').click();

    await expect(adminPage).toHaveURL(new RegExp(`/company/${adminMeta.tenantId}/investments/new`), { timeout: 10_000 });
  });

  test('Grant Options navigates to grants/new', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-grant-options').click();

    await expect(adminPage).toHaveURL(new RegExp(`/company/${adminMeta.tenantId}/grants/new`), { timeout: 10_000 });
  });
});

test.describe('User Story 3.19 — Options Holder Offboarding Wizard', () => {
  test('Offboard Options Holder option opens the wizard', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-offboard-options-holder').click();

    await expect(adminPage.getByTestId('offboard-wizard')).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId('offboard-step-1')).toBeVisible();
  });

  test('Step 1 shows options holder selector, termination date, and type', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-offboard-options-holder').click();

    await expect(adminPage.getByTestId('offboard-options-holder-select')).toBeVisible();
    await expect(adminPage.getByTestId('offboard-termination-date')).toBeVisible();
    await expect(adminPage.getByTestId('offboard-termination-type')).toBeVisible();
  });

  test('Next button on Step 1 is disabled when fields are empty', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-offboard-options-holder').click();

    const nextBtn = adminPage.getByTestId('offboard-next-step-1');
    await expect(nextBtn).toBeDisabled();
  });

  test('wizard can be closed with the × button', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-offboard-options-holder').click();
    await expect(adminPage.getByTestId('offboard-wizard')).toBeVisible();

    await adminPage.getByRole('button', { name: '×' }).click();
    await expect(adminPage.getByTestId('offboard-wizard')).not.toBeVisible();
  });

  test('Step 3 shows PTEP override toggle', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-offboard-options-holder').click();

    // Fill step 1
    const today = new Date().toISOString().split('T')[0];
    await adminPage.getByTestId('offboard-termination-date').fill(today);
    // Pick first available stakeholder if any; otherwise the next button stays disabled — that's fine for this test
    const select = adminPage.getByTestId('offboard-options-holder-select');
    const options = await select.locator('option').all();
    // Skip the placeholder option (index 0)
    if (options.length > 1) {
      const firstValue = await options[1].getAttribute('value');
      if (firstValue) await select.selectOption(firstValue);
      // Navigate to step 3 via step 2
      await adminPage.getByTestId('offboard-next-step-1').click();
      await adminPage.getByTestId('offboard-next-step-2').click({ timeout: 15_000 });
      await expect(adminPage.getByTestId('offboard-step-3')).toBeVisible({ timeout: 10_000 });
      await expect(adminPage.getByTestId('offboard-ptep-override-toggle')).toBeVisible();
    }
  });

  test('Step 4 shows acceleration toggle', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-offboard-options-holder').click();

    const today = new Date().toISOString().split('T')[0];
    await adminPage.getByTestId('offboard-termination-date').fill(today);
    const select = adminPage.getByTestId('offboard-options-holder-select');
    const options = await select.locator('option').all();
    if (options.length > 1) {
      const firstValue = await options[1].getAttribute('value');
      if (firstValue) await select.selectOption(firstValue);
      await adminPage.getByTestId('offboard-next-step-1').click();
      await adminPage.getByTestId('offboard-next-step-2').click({ timeout: 15_000 });
      await adminPage.getByTestId('offboard-next-step-3').click();
      await expect(adminPage.getByTestId('offboard-step-4')).toBeVisible({ timeout: 10_000 });
      await expect(adminPage.getByTestId('offboard-acceleration-toggle')).toBeVisible();
    }
  });
});

test.describe('User Story 3.21 — Investor Buyout Wizard', () => {
  test('"Investor Buyout" option appears in the Actions dropdown', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await expect(adminPage.getByTestId('actions-investor-buyout')).toBeVisible();
  });

  test('clicking Investor Buyout opens the buyout wizard modal', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-investor-buyout').click();

    await expect(adminPage.getByTestId('buyout-wizard')).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId('buyout-step-1')).toBeVisible();
  });

  test('Step 1 shows the seller dropdown', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-investor-buyout').click();

    await expect(adminPage.getByTestId('buyout-seller-select')).toBeVisible();
  });

  test('Step 1 Next button is disabled when no seller is selected', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-investor-buyout').click();

    await expect(adminPage.getByTestId('buyout-next-step-1')).toBeDisabled();
  });

  test('wizard can be closed with the × button', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-investor-buyout').click();
    await expect(adminPage.getByTestId('buyout-wizard')).toBeVisible();

    await adminPage.getByRole('button', { name: '×' }).last().click();
    await expect(adminPage.getByTestId('buyout-wizard')).not.toBeVisible();
  });

  test('Step 1 Next button is enabled after selecting a seller', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/ledger`);
    await adminPage.getByTestId('actions-menu-button').click();
    await adminPage.getByTestId('actions-investor-buyout').click();

    const sellerSelect = adminPage.getByTestId('buyout-seller-select');
    const options = await sellerSelect.locator('option').all();
    if (options.length > 1) {
      const firstValue = await options[1].getAttribute('value');
      if (firstValue) {
        await sellerSelect.selectOption(firstValue);
        await expect(adminPage.getByTestId('buyout-next-step-1')).toBeEnabled();
      }
    }
  });
});

test.describe('User Story 3.23 — Stakeholder Picker on Register New Investment', () => {
  test('investments/new page loads with a stakeholder select dropdown', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/investments/new`);
    await expect(adminPage.getByTestId('investor-select')).toBeVisible({ timeout: 15_000 });
  });

  test('default option is "Create new investor" and new investor fields are shown', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/investments/new`);
    const select = adminPage.getByTestId('investor-select');
    await expect(select).toHaveValue('');
    await expect(adminPage.getByTestId('investor-name')).toBeVisible();
    await expect(adminPage.getByTestId('investor-email')).toBeVisible();
  });

  test('selecting an existing stakeholder hides new investor fields and shows info card', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/investments/new`);
    const select = adminPage.getByTestId('investor-select');
    const options = await select.locator('option').all();

    if (options.length > 1) {
      const firstValue = await options[1].getAttribute('value');
      if (firstValue) {
        await select.selectOption(firstValue);
        await expect(adminPage.getByTestId('investor-name')).not.toBeVisible();
        await expect(adminPage.getByTestId('investor-email')).not.toBeVisible();
        // Type radios are present but disabled
        const radios = adminPage.locator('input[name="investorType"]');
        await expect(radios.first()).toBeDisabled();
      }
    }
  });

  test('switching back to "Create new investor" restores the new investor fields', async ({ adminPage, adminMeta }) => {
    await adminPage.goto(`/company/${adminMeta.tenantId}/investments/new`);
    const select = adminPage.getByTestId('investor-select');
    const options = await select.locator('option').all();

    if (options.length > 1) {
      const firstValue = await options[1].getAttribute('value');
      if (firstValue) {
        await select.selectOption(firstValue);
        await select.selectOption('');
        await expect(adminPage.getByTestId('investor-name')).toBeVisible();
        await expect(adminPage.getByTestId('investor-email')).toBeVisible();
      }
    }
  });
});
