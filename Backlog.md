# FEATURES & ENHANCEMENTS

- [ ] The user should see their own name (First Last) in the top right of the page instead of their email address. 
- [ ] Implement full RLS

# KNOWN BUGS

- [ ] Release notes seem to be missing from the user menu drop down

# FRONTLOG

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
- [x] Enable users to be stakeholders for multiple companies. User A might create a CapTable account and THEN create Company A. Only when creating Company A will User A be asked for the Company Name, as well as the authorized shares and par value. User A might later create a completely separate Company, Company B. User A would be an Admin for both companies. User A can invite User B to become a stakeholder in Company A, or Company B, or both (but not at the same time). User B could later create their own company, and be the admin for that company. CapTable needs a getcaptable.com/companies page where users can see a list of the companies for which they ar a stakeholder and create new companies. CapTable also needs a getcaptable.com/company/{company_ID} page, where users can interact with the company IF they are a stakeholder of that company. There should be a getcaptable.com/company/{company_id}/stakeholders page which lists the stakeholders of the company. There should also be a getcaptable.com/company/{company_id}/stakeholder/{stakeholder_id} page which should replace the modal with the graph. All that same content (e.g., the graph) should be moved to this new page. When a user is is 'invited' to join a company as a stakeholder, they should receive an invite email. The 'accept invitation' button (link) in that email will verify the email address. The user should then be take to a page where they can...
    1. a) use the already verified email address; or b) change to a new email address (which may then require verification);
    2. Join the company to which they've been invited. 

The Admin user must at least invite the stakeholder to the company before adding them to the ledger for the company. 
- [x] User should be able to chose between companies from a drop-down in the top left of the page. Where is currently says "My Companies / {company name}, the company name should be the drop-down. 
- [x] Company names do not need to be unique. 2 different tenants could have the same name; the important thing is that they have unique IDs. 
- [x] Admin users on the getcaptable.com/company/{company_id}/stakeholders page should appear like it's a tab on the company/{id} page. There, an admin should be able to see a list of all stakeholders, and upgrade other stakeholders to be additional admins for that company.
- [x] Admins are just a type of stakeholder, so they should show up on the stakeholders tab/list. 
- [x] The Cap Table tab on the /company/{id} page should should update the url to /company/{id}/cap_table. Similar to how the stakeholders tab works. 
- [x] To the left of the 'Cap Table' tab on the /company/{id} page, there should be an 'Equity' tab. (/company/{id}/equity). Users that are NOT admins will only have access to that page/tab, and will NOT have access to the 'Cap Table' or 'Stakeholders' tab. As a result, we do not need a separate /admin page; rather, 'admin' is a role and permission set that grants user access to those additional pages/tab. An Admin can view the equity page for any stakeholder in the Company (at /company/{id}/stakeholder/{id}/equity). All of that content (e.g., the graph) is currently at /company/{id}/stakeholder/{id}.

