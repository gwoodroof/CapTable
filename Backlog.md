# FEATURES & ENHANCEMENTS


# KNOWN BUGS

# FRONTLOG

- [x] User, when creating a new company, should be given some tips about what 'Authorized Shares' are and how many is typical, and about what Par Values are and typical values. These tips should be provided by hovering over 'info' icons. Pre-fill these fields with 10,000,000 authorized shares and 0.0001 par value by default and then let the user change them if they want. Implemented: `openModal()` resets to `{ authorizedShares: '10000000', parValue: '0.0001' }`; added `InfoIcon` SVG and hover-based `tooltipVisible` state with descriptive tooltips for each field; `data-tooltip` attributes enable E2E targeting. Spec: User Story 3.13.

- [x] Implement full RLS
- [x] The user should see their own name (First Last) in the top right of the page instead of their email address. Implemented: signup form collects First/Last Name (email path); Google SSO extracts name from the ID token. `User.name` and `PendingRegistration.name` added (default ""). JWT payload now includes `name`. All nav surfaces (CompanyNav + /companies inline nav) show name with email fallback. Spec: User Story 3.12. Tests updated.
- [x] BUG: Release notes were missing from the user menu on the /companies page. The CompanyNav component (used on all company-scoped pages) had the feature, but /companies/index.tsx had its own inline nav that omitted it. Fixed by adding the full Release Notes button + modal to the /companies inline nav. Added E2E tests in companies-list.spec.ts.

- [x] We don't need the `CapTableSnapshot` model. Remove the related and unused elements so our code and repo is not cluttered.
- [x] Add a LICENSE.md file
- [x] If admin hasn't set a custom icon, create a simple monogram using the (capitalized) first letter of the company name and use that.
- [x] BUG: Equity page/tab not loading. 'Failed to load equity'
- [x] User should see release notes as another option in the user menu in the top right, where other options include 'contact support'. The release notes should be displayed in a modal. The content for the release notes will be maintained here: https://docs.google.com/spreadsheets/d/1Ht3pQQUXwt7-r0PY1G0Xdxobb-baFWO3yayC_l8nFsU/edit?usp=sharing. That's a Google sheet where column A is "Date" and column B is "Release Notes". Actual release notes will start on row 2. 
- [x] User, at the bottom of their 'equity' tab, should see a prominent message: "If you have questions about this information, or wish to make changes, please contact your manager or an administrator."
- [x] Write some important E2E tests (using Playwright) that can be run locally and also in a future staging environment to be implemented as part of a future CI process.- [x] Implement basic PostgreSQL RLS migrations.
- [x] Notify stakeholders (via email) of new ledger entries for which they are the identified stakeholder. 
- [x] Admin users on the getcaptable.com/company/{id}/cap_table page should see a summary pie chart describing the current breakdown of cap table/ownership of the company. The pie chart should summarize the ownership per security type (e.g., option, preferred stock, etc.). Move the Ledger Transactions table to a separate 'Ledger' page/tab, and put the new pie chart where the ledger was before. Only Admins will have access to the Ledger page/tab, which should come right after the 'equity' page/tab. 
- [x] Admin users should be able to update the Company name, website, and icon, all from a new page /company/{id}/company_info page/tab. Only Admins will have access to that page/tab. The Company icon should be 28px square and should show up to the right of the company name drop-down in the header up top. 
- [x] In the header at the top of the app, instead of {username} and 'sign out' button in the top right corner, Make it just {User Name}, but when user hovers over, or clicks on that, they get a drop down to 'Contact Support' or 'Log Out'. 'Contact Support' is merely a mailto link to 'support@getcaptable.com' that opens in a new tab. 
- [x] User should be able to chose between companies from a drop-down in the top left of the page. Where is currently says "My Companies / {company name}, the company name should be the drop-down. 
- [x] Company names do not need to be unique. 2 different tenants could have the same name; the important thing is that they have unique IDs. 
- [x] Admin users on the getcaptable.com/company/{company_id}/stakeholders page should appear like it's a tab on the company/{id} page. There, an admin should be able to see a list of all stakeholders, and upgrade other stakeholders to be additional admins for that company.
- [x] Admins are just a type of stakeholder, so they should show up on the stakeholders tab/list. 
- [x] The Cap Table tab on the /company/{id} page should should update the url to /company/{id}/cap_table. Similar to how the stakeholders tab works. 
- [x] To the left of the 'Cap Table' tab on the /company/{id} page, there should be an 'Equity' tab. (/company/{id}/equity). Users that are NOT admins will only have access to that page/tab, and will NOT have access to the 'Cap Table' or 'Stakeholders' tab. As a result, we do not need a separate /admin page; rather, 'admin' is a role and permission set that grants user access to those additional pages/tab. An Admin can view the equity page for any stakeholder in the Company (at /company/{id}/stakeholder/{id}/equity). All of that content (e.g., the graph) is currently at /company/{id}/stakeholder/{id}.

