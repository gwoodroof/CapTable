# Feature Specification: Cap Table Management SaaS

**Feature Branch**: `001-cap-table-saas`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "Draft a rigorous, production-grade product specification file for our multi-tenant Cap Table Management SaaS... organized into 4 critical epic buckets..."

## User Scenarios & Testing *(mandatory)*

### User Story 0.1 - Email Verification on Signup (Priority: P1)

**As a** new user signing up with email and password, **I want to** verify ownership of my email address before my account is created, **so that** the platform can confirm deliverability and prevent abuse with unowned email addresses.

**Why this priority**: Protects against account enumeration and ensures the platform can reliably contact account owners. Not required for Google SSO because Google has already verified the address.

**Independent Test**: Submit a registration form, confirm no user record is created, click the link in the verification email, then confirm the user and tenant are created and a JWT is returned.

**Acceptance Scenarios**:
1. **Given** a valid email and password, **When** `POST /api/v1/auth/register` is called, **Then** a verification email is sent, no user or tenant is created yet, and the response is `202` with `{ message: "Verification email sent..." }`.
2. **Given** a valid verification token, **When** `GET /api/v1/auth/verify-email?token=<token>` is called, **Then** the tenant and user are created and the browser is redirected to `${FRONTEND_URL}/auth/verified?token=<jwt>`.
3. **Given** an expired or unknown verification token, **When** `GET /api/v1/auth/verify-email?token=<token>` is called, **Then** the system returns `400 Bad Request`.
4. **Given** an email already registered in the `User` table, **When** `POST /api/v1/auth/register` is called with that email, **Then** the system returns `409 Conflict` and no verification email is sent.
5. **Given** a repeated signup with the same email before verification, **When** `POST /api/v1/auth/register` is called again, **Then** a fresh token is issued (previous one invalidated) and a new verification email is sent.
6. **Given** a Google SSO signup, **When** completing registration via `POST /api/v1/auth/google/register`, **Then** no email verification step is required — the user and tenant are created immediately.

**Key Implementation Notes**:
- Pending signups are stored in the `PendingRegistration` table (email, bcrypt-hashed password, token, expiresAt). Company details are NOT collected at signup — they are collected separately when the user creates their first company (see User Story 0.2).
- Verification tokens are 32-byte cryptographically random hex strings with a 24-hour TTL.
- Verification emails are delivered via Postmark (env: `POSTMARK_API_KEY`).
- After successful verification the `PendingRegistration` record is deleted.

---

### User Story 0.2 - Company Creation (Priority: P1)

**As a** registered user, **I want to** create a company (providing its Name, Authorized Shares, and Par Value) as a step separate from account signup, **so that** I can manage multiple companies under a single login and share a single identity across them.

**Why this priority**: Decoupling account identity from company membership is the architectural prerequisite for multi-company support. A `User` is a first-class entity independent of any `Tenant`.

**Independent Test**: Register an account, confirm no `Tenant` exists yet, navigate to `/companies`, create Company A, then verify the `Tenant` record is created and the user has an `ADMIN` `CompanyMembership` for it.

**Acceptance Scenarios**:
1. **Given** a verified user with no companies, **When** they visit `/companies`, **Then** a "Create your first company" prompt is displayed.
2. **Given** a user clicking "Create Company", **When** they submit a Company Name, Authorized Shares, and Par Value, **Then** a new `Tenant` is created and the user is linked as `ADMIN` via `CompanyMembership`.
3. **Given** an existing user with Company A, **When** they create Company B, **Then** both companies appear on `/companies` and the user holds `ADMIN` `CompanyMembership` for each.
4. **Given** a company creation form, **When** Authorized Shares is zero or negative, **Then** the system MUST reject with a validation error.

**Key Implementation Notes**:
- Company Name, Authorized Shares, and Par Value are collected at company creation, not at account signup.
- The creating user is automatically assigned `ADMIN` role for the new company in `CompanyMembership`.

---

### User Story 1.1 - Company Onboarding & Founding Stock (Priority: P1)

**As a** Company Founder, **I want to** initialize my company's legal entity metadata (Authorized Shares, Par Value, Class A Common Stock) and issue initial shares to co-founders, **so that** the baseline ownership structure is established.

**Why this priority**: Essential first step for any tenant using the system.

**Independent Test**: Can be verified by creating a new tenant and issuing founding shares, then checking the ledger for correct initial state.

**Acceptance Scenarios**:
1. **Given** a new tenant, **When** initializing metadata with 10M Authorized Shares and $0.0001 Par Value, **Then** the company entity is created successfully.
2. **Given** 10M Authorized Shares, **When** issuing 4M shares to Founder A and 4M shares to Founder B, **Then** the transactions are recorded in the immutable ledger.
3. **Given** 10M Authorized Shares, **When** attempting to issue 11M shares, **Then** the system MUST block the transaction with a validation error.

---

### User Story 1.5 - Stakeholder Ledger Entry Notifications (Priority: P1)

**As a** Stakeholder, **I want to** receive an email notification whenever a new ledger entry is recorded that names me as the stakeholder, **so that** I am immediately aware of any change to my equity position without having to log in and check.

**Why this priority**: Stakeholders may not check the platform regularly. An automated email ensures they are informed of every equity event (share issuances, vestings, cancellations, etc.) as it happens, which also provides an external audit trail they can reference.

**Independent Test**: Record a new ledger entry for a stakeholder who has an email address. Confirm the Postmark API is called once with an email addressed to that stakeholder. Then record an entry for a stakeholder with no email address and confirm no Postmark API call is made. Finally, simulate a Postmark failure and confirm the ledger entry is still created and returned successfully.

**Acceptance Scenarios**:
1. **Given** a new ledger entry is recorded and the identified stakeholder has an email address, **When** the entry is committed, **Then** a notification email is sent to `Stakeholder.email` containing the transaction type, security label, quantity, and company name.
2. **Given** a new ledger entry is recorded and the identified stakeholder has no email address (`Stakeholder.email` is null), **When** the entry is committed, **Then** no email is sent.
3. **Given** the email notification service (Postmark) is temporarily unavailable, **When** a ledger entry is recorded, **Then** the entry is still written to the database and returned to the caller — the notification failure MUST NOT roll back or block the ledger write.
4. **Given** a notification email is sent, **Then** it includes: (a) the transaction type in human-readable form (e.g., "Issuance", "Vesting"), (b) the security name or type, (c) the formatted share quantity, (d) the company name, and (e) a direct link to the stakeholder's equity page (`/company/{tenantId}/equity`).
5. **Given** a notification email is sent, **Then** the email subject line follows the pattern: `Equity update: {Transaction Type} — {Company Name}`.

**Key Implementation Notes**:
- Notification is dispatched **fire-and-forget** inside `LedgerService.recordTransaction()` immediately after the `LedgerTransaction` is committed. The email promise is not awaited; any rejection is silently swallowed to preserve ledger integrity.
- Delivery is via Postmark (env: `POSTMARK_API_KEY`), using the existing `EmailService` infrastructure. `LedgerModule` imports `EmailModule` so `EmailService` can be injected.
- No new API endpoint or Prisma migration is required — all data needed for the email (tenant name, stakeholder name/email, security label) is already fetched during the validation phase of `recordTransaction()`.
- Notifications cover all `TransactionType` values: ISSUANCE, VEST, EXERCISE, CANCELLATION, TRANSFER, ADJUSTMENT.

---

### User Story 1.3 - Issuing Grants (ISO, NSO, RSA) (Priority: P1)

**As a** Company Admin, **I want to** grant options or restricted stock to employees and advisors, **so that** equity incentives are cleanly tracked.

**Why this priority**: Core value proposition for employee equity management.

**Independent Test**: Create a grant and verify it appears in the ledger and stakeholder view with correct vesting details.

**Acceptance Scenarios**:
1. **Given** an active option pool, **When** issuing an ISO grant with a 4-year monthly vest and 1-year cliff, **Then** the vesting schedule is calculated precisely.
2. **Given** a new grant, **When** processing, **Then** Board Approval Date and Grant Date MUST be required.
3. **Given** a finalized grant, **Then** a background notification event MUST be queued for email delivery.

---

### User Story 2.1 - Individual Stakeholder Dashboard (Priority: P1)

**As an** Employee Option Holder, **I want to** view a clear visual timeline of my equity progress, **so that** I know exactly how many options are Vested, Unvested, Exercised, and Exercisable.

**Why this priority**: Primary touchpoint for the majority of users (employees).

**Independent Test**: Log in as a stakeholder and verify only personal grants are visible with accurate vesting calculations.

**Acceptance Scenarios**:
1. **Given** a stakeholder login, **When** viewing the dashboard, **Then** only their own grants are displayed.
2. **Given** a grant with an upcoming cliff, **When** viewing the dashboard, **Then** the next cliff date MUST be prominently displayed.
3. **When** viewing the dashboard, **Then** global company cap table details (other holders, total authorized) MUST be hidden.

---

### User Story 4.1 - Multi-Tenant Isolation & Role Enforcement (Priority: P1)

**As a** System Operator, **I want to** ensure that user authorization tokens are rigidly bound to specific tenant IDs, **so that** horizontal privilege escalation is strictly impossible.

**Why this priority**: Critical security requirement for multi-tenant SaaS.

**Independent Test**: Attempt to access Tenant B's data using a valid Tenant A token; request MUST be rejected.

**Acceptance Scenarios**:
1. **Given** a user authenticated for Tenant A, **When** requesting a resource owned by Tenant B, **Then** the system MUST return a 403 Forbidden or 404 Not Found error.
2. **Given** a request, **When** processing, **Then** the Tenant ID MUST be extracted from the secure token and used as a mandatory filter for all database queries.

---

### User Story 3.1 - Companies List Page (Priority: P1)

**As a** user, **I want to** see all companies where I hold a membership and create new companies from `/companies`, **so that** I can navigate and manage my equity across multiple employers, investments, or ventures.

**Why this priority**: The central navigation hub for multi-company users; every authenticated session begins here.

**Independent Test**: Log in as User A (stakeholder in Company A and Company B), navigate to `/companies`, verify both are listed. Create Company C and verify it appears immediately.

**Acceptance Scenarios**:
1. **Given** an authenticated user, **When** visiting `/companies`, **Then** only companies with a `CompanyMembership` record for that user are displayed.
2. **Given** a user with no companies, **When** visiting `/companies`, **Then** a "Create your first company" prompt is shown with no list items.
3. **Given** a list of companies, **When** the user clicks a company card, **Then** they are navigated to `/company/{company_id}`.
4. **Given** a "Create Company" action, **When** completed, **Then** the new company appears immediately in the list without a full page reload.

---

### User Story 3.2 - Stakeholder Invitation (Priority: P1)

**As a** Company Admin, **I want to** invite a person to become a stakeholder of my company via email, **so that** they can access their equity data and be referenced in the company ledger.

**Why this priority**: The invitation gate is required for ledger integrity — no uninvited person may appear in a company ledger.

**Independent Test**: As Admin of Company A, send an invitation to user@example.com. Verify a `CompanyInvitation` record (status: PENDING) is created, an invite email is sent, and attempting to create a ledger entry for that stakeholder before invitation is rejected.

**Acceptance Scenarios**:
1. **Given** an Admin on `/company/{id}/stakeholders`, **When** they submit an invitation for a valid email, **Then** a `CompanyInvitation` record is created with status `PENDING` and an invite email is sent.
2. **Given** a `PENDING` invitation already exists for an email+company pair, **When** the Admin re-invites the same email, **Then** a new token is issued (previous invalidated) and a fresh email is sent.
3. **Given** a stakeholder who has NOT been invited, **When** an Admin attempts to create a ledger entry for that stakeholder, **Then** the system MUST reject the transaction with `422 Unprocessable Entity`.
4. **Given** an expired invitation (>7 days), **When** the invitee clicks the link, **Then** the system returns an error and advises the Admin to re-send the invitation.

**Key Implementation Notes**:
- Invitation tokens are 32-byte cryptographically random hex strings with a 7-day TTL.
- Invite emails are delivered via Postmark.
- `CompanyInvitation` stores: invitee email, `company_id` (FK to Tenants), token, status (`PENDING` | `ACCEPTED` | `EXPIRED`), `expires_at`.

---

### User Story 3.3 - Accepting an Invitation (Priority: P1)

**As an** invited user, **I want to** accept a company invitation via the email link, **so that** my email is verified and I am joined to the company as a stakeholder.

**Why this priority**: Closes the invitation loop and bootstraps the invitee's account or company membership.

**Independent Test**: Click an invitation link, confirm email is verified, choose to keep or change the email, then confirm `CompanyMembership` is created with role `STAKEHOLDER` and the user can access `/company/{id}`.

**Acceptance Scenarios**:
1. **Given** a valid invitation link, **When** clicked, **Then** the invitee's email is marked as verified and they are taken to an onboarding page.
2. **Given** the onboarding page, **When** the user chooses to keep the invited email, **Then** no further email verification is required.
3. **Given** the onboarding page, **When** the user enters a different email address, **Then** a verification email is sent to that address; the user must verify it before joining the company.
4. **Given** a completed onboarding, **When** the user confirms, **Then** a `CompanyMembership` record is created with role `STAKEHOLDER`, and the `CompanyInvitation` status is set to `ACCEPTED`.
5. **Given** an invitee who already has a CapTable account, **When** they click the invitation link, **Then** they are prompted to log in and the new `CompanyMembership` is attached to their existing `User` record.
6. **Given** an invitee with no existing CapTable account, **When** they complete onboarding, **Then** a new `User` record is created before the `CompanyMembership` is created.

---

### User Story 3.4 - Company Pages & Stakeholder Detail (Priority: P1)

**As a** stakeholder, **I want to** navigate to a dedicated page for each company I belong to, and view individual stakeholder detail on its own page rather than a modal, **so that** the experience is deep-linkable and scalable.

**Why this priority**: Modals do not support shareable URLs or direct navigation; the multi-company architecture requires company-scoped routes.

**Independent Test**: Navigate directly to `/company/{id}/stakeholder/{stakeholder_id}` and confirm the vesting graph and all grant details render on the page without a modal.

**Acceptance Scenarios**:
1. **Given** an authenticated user, **When** visiting `/company/{id}`, **Then** the browser redirects to `/company/{id}/cap_table`, which shows the Cap Table tab only if they hold a `CompanyMembership` for that company; otherwise 403 Forbidden.
2. **Given** an Admin visiting `/company/{id}/stakeholders`, **Then** the full list of stakeholders with their membership status is displayed.
3. **Given** a direct URL to `/company/{id}/stakeholder/{stakeholder_id}`, **When** navigated to, **Then** the vesting graph and all grant content renders as a full page (no modal required).
4. **Given** a user with no membership in a company, **When** they attempt to access any `/company/{id}/*` route, **Then** the system returns 403 Forbidden.

---

### User Story 3.8 - User Menu Dropdown (Priority: P1)

**As a** logged-in user, **I want to** access account actions (contact support, log out) from a contextual dropdown on my name in the nav, **so that** the header stays clean and the sign-out flow is consistent across all pages.

**Why this priority**: The current sign-out button is always visible and takes up persistent header space. A dropdown keeps the nav minimal and adds a support contact path.

**Independent Test**: On any authenticated page, hover over (or click) the email address in the top-right corner. Confirm a dropdown appears with "Contact Support" and "Log Out". Click "Contact Support" and confirm a mailto link to `support@getcaptable.com` opens in a new tab. Click "Log Out" and confirm the token is cleared and the user is redirected to `/login`.

**Acceptance Scenarios**:
1. **Given** any authenticated page, **When** a user hovers over or clicks their email in the top-right corner, **Then** a dropdown appears with two items: "Contact Support" and "Log Out".
2. **Given** the dropdown is open, **When** the user clicks "Contact Support", **Then** a `mailto:support@getcaptable.com` link opens in a new browser tab without closing the current session.
3. **Given** the dropdown is open, **When** the user clicks "Log Out", **Then** the local JWT is cleared and the user is redirected to `/login`.
4. **Given** the dropdown is open, **When** the user clicks or moves focus elsewhere, **Then** the dropdown closes.
5. **Given** any authenticated page, **Then** the old standalone "Sign out" button is no longer present in the header.

---

### User Story 3.12 - Display User Name in Navigation (Priority: P2)

**As a** logged-in user, **I want to** see my full name (First Last) in the top-right navigation bar instead of my email address, **so that** the interface feels personal and professional.

**Why this priority**: Minor UX polish; enhances trust and recognition.

**Independent Test**: Sign up with a First Name and Last Name via the email/password flow. After verifying and logging in, confirm the nav bar shows the full name (not the email address). For Google SSO, confirm the name comes from the Google token automatically.

**Acceptance Scenarios**:
1. **Given** a new user signing up with email/password, **When** they fill in First Name and Last Name on the signup form and complete verification, **Then** their full name is stored on the `User` record and embedded in the JWT payload.
2. **Given** a logged-in user, **When** they view any authenticated page (companies list or any company-scoped page), **Then** the navigation bar displays their full name, not their email address.
3. **Given** a Google SSO signup, **When** completing registration, **Then** the name from the Google ID token is automatically stored and displayed without requiring an extra form field.
4. **Given** a user whose name is an empty string (legacy account or account with no name set), **When** they view any authenticated page, **Then** the navigation bar falls back to displaying their email address.
5. **Given** a user switches companies via the company switcher, **When** a new JWT is issued by `POST /auth/switch-company`, **Then** the new token still includes the user's name so the nav continues to display the correct name.

**Key Implementation Notes**:
- `User.name` and `PendingRegistration.name` both use `@default("")` so existing rows are unaffected by the migration.
- The JWT payload includes a `name` field alongside `sub`, `tenantId`, `email`, and `role`.
- The signup form collects First Name and Last Name as two separate inputs and concatenates them as `"${firstName} ${lastName}"` before sending to the API.
- Google SSO extracts the full name from `getPayload().name` on the Google ID token.
- All nav surfaces (`CompanyNav` component and the inline nav on `/companies`) fall back to email when `name` is empty.

---

### User Story 3.13 - Create Company Form: Defaults & Field Tips (Priority: P2)

**As a** user creating a new company, **I want to** see helpful tips about Authorized Shares and Par Value, and have sensible defaults pre-filled, **so that** I can make an informed decision without needing to research these fields independently.

**Why this priority**: Reduces friction for first-time company creators who are unfamiliar with standard startup cap table values.

**Independent Test**: Open the "Create a new company" modal. Confirm the Authorized Shares field defaults to 10,000,000 and Par Value defaults to 0.0001. Hover over the info icon next to each field and confirm a descriptive tooltip appears.

**Acceptance Scenarios**:
1. **Given** the user clicks "+ Create Company", **When** the modal opens, **Then** the Authorized Shares input is pre-filled with `10000000` and the Par Value input is pre-filled with `0.0001`.
2. **Given** the modal is open, **When** the user hovers over the info icon next to "Authorized Shares", **Then** a tooltip appears explaining that most startups authorize 10,000,000 shares for flexibility.
3. **Given** the modal is open, **When** the user hovers over the info icon next to "Par Value", **Then** a tooltip appears explaining that $0.0001 is typical for Delaware startups to minimize franchise taxes.
4. **Given** the user changes the pre-filled values before submitting, **When** the form is submitted, **Then** the user-specified values (not the defaults) are used to create the company.
5. **Given** the user cancels and reopens the modal, **When** the modal opens again, **Then** the default values are restored.

**Key Implementation Notes**:
- `openModal()` resets the form to `{ name: '', authorizedShares: '10000000', parValue: '0.0001' }` each time it is called.
- Info icons use an SVG circle-i design and reveal tooltips on `mouseenter`/`mouseleave` via a `tooltipVisible` state variable.
- Tooltip for Par Value anchors to the right edge to prevent overflow off the right side of the modal.

---

### User Story 3.18 - Actions Menu on the Ledger Tab (Priority: P1)

**As an** admin on the Ledger tab, **I want to** access "+ Add Investment" and "+ Grant Options" from a single "Actions" dropdown menu, **so that** the page header stays clean and these operations are clearly grouped as admin-only actions.

**Why this priority**: The Ledger tab is the primary admin workspace; surfacing ad-hoc data-entry operations behind an explicit "Actions" menu makes the distinction between viewing and mutating clearer.

**Independent Test**: Navigate to the Ledger tab as an admin. Confirm no standalone "+ Add Investment" or "+ Grant Options" buttons are present. Click the "Actions" button. Confirm a dropdown appears with both items. Click each and confirm navigation to the correct page.

**Acceptance Scenarios**:
1. **Given** an admin is on the Ledger tab, **When** the page loads, **Then** an "Actions ▾" button is shown in the header; no standalone "+ Add Investment" or "+ Grant Options" buttons exist.
2. **Given** the Actions button is clicked, **When** the dropdown opens, **Then** it contains "Add Investment" and "Grant Options" as items.
3. **Given** the dropdown is open, **When** the user clicks "Add Investment", **Then** the dropdown closes and the user is navigated to `/investments/new`.
4. **Given** the dropdown is open, **When** the user clicks "Grant Options", **Then** the dropdown closes and the user is navigated to `/grants/new`.
5. **Given** the dropdown is open, **When** the user clicks anywhere outside, **Then** the dropdown closes.
6. **Given** the Ledger page already redirects non-admins away, **Then** the Actions menu is effectively admin-only.

**Key Implementation Notes**:
- `actionsOpen` state + `actionsRef` with a `mousedown` click-outside handler, matching the existing pattern used by the company-switcher and user-menu dropdowns.
- `data-testid` attributes: `actions-menu-button`, `actions-menu-dropdown`, `actions-add-investment`, `actions-grant-options`, `actions-offboard-stakeholder`.

---

### User Story 3.19 - Stakeholder Offboarding Wizard (Priority: P1)

**As an** admin on the Ledger tab, **I want to** run a guided offboarding wizard for a departing stakeholder, **so that** vesting entries are reconciled, the post-termination exercise window is recorded, and any acceleration clauses are applied, all from a single confirm-before-commit flow.

**Why this priority**: Departures are time-sensitive and high-stakes. An error in vesting reconciliation or PTEP configuration can expose the company to legal liability; a step-by-step wizard with a confirmation summary reduces that risk.

**Independent Test**: Open the Actions menu on the Ledger tab. Click "Offboard Stakeholder". Complete each step of the wizard and confirm the ledger is updated with the expected CANCELLATION and/or VEST entries after clicking "Confirm & Apply".

**Acceptance Scenarios**:
1. **Given** an admin opens the Actions menu, **When** they click "Offboard Stakeholder", **Then** a 5-step wizard modal opens at Step 1.
2. **Step 1 — Termination Details**: Admin selects the stakeholder, enters the termination date, and selects the termination type (Voluntary, Involuntary, Disability, Death, Retirement).
3. **Step 2 — Vesting Recalculation**: The wizard fetches a preview from the backend and displays a table showing total granted, shares vested by the termination date, any over-vested entries to be reversed, and net vested shares.
4. **Step 3 — PTEP Configuration**: Admin sees the standard 90-day window. A checkbox allows overriding it with a custom number of days. The calculated exercise deadline is displayed.
5. **Step 4 — Acceleration**: A toggle enables accelerated vesting. If toggled on, admin chooses between "flat number of additional shares" or "additional months of vesting" and enters the amount.
6. **Step 5 — Confirmation**: A summary shows stakeholder name, termination date/type, shares retained, cancellations, acceleration, and PTEP deadline. Admin clicks "Confirm & Apply".
7. **Given** the admin clicks "Confirm & Apply", **Then** the backend: creates CANCELLATION entries for any VEST entries after the termination date, creates a VEST entry for any accelerated shares, and marks each of the stakeholder's grants with `terminatedAt` and `terminationType`.
8. **Given** a grant is terminated, **When** `materializeVestings` runs, **Then** it does not create VEST entries for periods after `terminatedAt`.
9. **Given** a non-admin user is on the Ledger page, **Then** they are redirected away and cannot access the wizard.

**Key Implementation Notes**:
- Schema: `terminatedAt DateTime?`, `terminationType String?`, `ptepDays Int?` added to `Grant`.
- Backend endpoints: `POST /api/v1/grants/offboard/preview` (returns preview without writing) and `POST /api/v1/grants/offboard/commit` (applies changes).
- `materializeVestings` now skips events where `event.date > grant.terminatedAt`.
- Acceleration "months" method computes future vesting events in the window `(terminationDate, terminationDate + N months]` and sums them; "shares" method distributes a flat total proportionally across the stakeholder's grants by grant quantity.
- CANCELLATION entries created for each existing VEST ledger entry with `timestamp > terminationDate`.
- Acceleration VEST entries use `vestingPeriodIndex = null` (PostgreSQL NULLs don't violate the unique constraint).
- `data-testid` attributes: `offboard-wizard`, `offboard-step-1` through `offboard-step-5`, `offboard-stakeholder-select`, `offboard-termination-date`, `offboard-termination-type`, `offboard-ptep-override-toggle`, `offboard-ptep-days`, `offboard-acceleration-toggle`, `offboard-accel-method`, `offboard-accel-value`, `offboard-confirm-button`.

---

### User Story 3.20 - Stock Certificate PDF Attached to Equity Notification Email (Priority: P2)

**As a** stakeholder who receives shares, **I want to** receive a stock certificate PDF attached to my notification email, **so that** I have a formal record of my equity transaction without having to log in.

**Why this priority**: A certificate provides a recognizable, legally-flavored artifact that increases stakeholder trust and gives them an offline record of their equity position.

**Independent Test**: Record an ISSUANCE ledger entry for a stakeholder with an email address. Confirm the Postmark API is called with one `Attachment` whose `ContentType` is `application/pdf` and whose `Name` matches `certificate-CS-XXXX.pdf`. Confirm the `LedgerTransaction` row has a non-null `certificateNumber`. Record a VEST entry and confirm no attachment is sent.

**Acceptance Scenarios**:
1. **Given** a ledger entry of type ISSUANCE, EXERCISE, or TRANSFER is recorded for a stakeholder with an email, **When** the entry is committed, **Then** a PDF stock certificate is generated and attached to the notification email.
2. **Given** a ledger entry of type VEST, CANCELLATION, or ADJUSTMENT is recorded, **When** the entry is committed, **Then** no certificate is generated and the notification email (if any) has no attachment.
3. **Given** a certificate is generated, **Then** the `LedgerTransaction.certificateNumber` field is set to the value `CS-XXXX` (e.g. `CS-0001`), where XXXX is a per-tenant sequential number padded to 4 digits.
4. **Given** multiple cert-eligible transactions have been recorded for a tenant, **When** a new cert-eligible entry is added, **Then** its `certificateNumber` is one higher than the current count of non-null `certificateNumber` rows for that tenant (computed inside the DB transaction).
5. **Given** the company has an `iconUrl` set, **When** the certificate is generated, **Then** the icon is fetched and embedded; if the fetch fails or returns a non-OK status, the service falls back to a monogram square using the first letter of the company name.
6. **Given** PDF generation fails, **When** a cert-eligible ledger entry is committed, **Then** the notification email is still sent (without an attachment) and the ledger entry is still written — the failure is swallowed.
7. **Given** the stakeholder has no email address, **Then** no certificate is generated and no email is sent.

**Certificate content**:
- Company name and icon (or monogram fallback)
- Certificate serial number (e.g. `CS-0001`) displayed in the top-right corner
- Stakeholder full name
- Share quantity (locale-formatted) and security label (e.g. "10,000 Shares of Common Stock")
- Issue date (Month D, YYYY format)
- Footer disclaimer line

**Key Implementation Notes**:
- Schema: `certificateNumber String?` added to `LedgerTransaction`. Applied via `prisma db push` (no migration file, same as prior schema changes). Prisma client regenerated.
- `CertificateService` (`src/common/certificate/certificate.service.ts`) uses the `pdfkit` npm package. Page size: LETTER landscape (792 × 612 pts), 0.5-inch (36 pt) margins. Icon is fetched via native `fetch` with a 5-second `AbortSignal` timeout.
- `CertificateModule` is imported by `LedgerModule`.
- `EmailService.sendLedgerNotification()` accepts an optional second parameter `PostmarkAttachment[]`; when provided, the array is passed to Postmark's `Attachments` field.
- For cert-eligible types, `LedgerService` runs an async IIFE (fire-and-forget): generate PDF → send email with attachment. For non-cert types, the existing direct `.catch()` fire-and-forget path is used.
- Certificate attachment file name: `certificate-{certNumber}.pdf`.
- 8 unit tests added in `certificate.service.spec.ts`; 10 new cert-specific tests added to `ledger.service.spec.ts` (213 total unit tests passing).

---

### User Story 3.21 - Investor Buyout Wizard (Priority: P1)

**As an** admin, **I want to** record a share transfer from one existing stakeholder (seller) to another (buyer) through a guided wizard, **so that** the ledger accurately reflects the ownership change, the seller's shares are cancelled, the buyer receives a new stock certificate, and the original cost-basis information is captured for QSBS / tax tracking.

**Why this priority**: Secondary-market transfers are a core cap table event. Without this, an admin would have to manually create two ledger entries with no validation, no chain integrity check, and no cost-basis record.

**Independent Test**: Navigate to the Ledger tab as an admin, open the Actions menu, click "Investor Buyout", complete all 5 wizard steps (seller → security/shares → buyer → cost basis → confirm), and click "Confirm & Apply". Verify the ledger now contains a new CANCELLATION row for the seller and a new ISSUANCE row for the buyer in the same `withTenant` transaction, and that the buyer's ISSUANCE has a `certificateNumber` assigned.

**Acceptance Scenarios**:
1. **Given** an admin opens the Actions menu on the Ledger tab, **Then** an "Investor Buyout" option is present.
2. **Given** the admin clicks "Investor Buyout", **Then** a 5-step modal wizard opens (same pattern as the offboarding wizard).
3. **Given** Step 1, **When** no seller is selected, **Then** the "Next →" button is disabled.
4. **Given** the admin selects a seller and advances to Step 2, **Then** the wizard fetches and displays that seller's current holdings (grouped by security class with net share balance); if the seller has only one security, it is auto-selected.
5. **Given** Step 2, **When** the admin enters a quantity greater than the seller's current balance, **Then** an inline validation error is shown and "Next →" is disabled.
6. **Given** Step 2, **When** the admin enters a valid quantity and sale price per share, **Then** "Next →" advances to Step 3.
7. **Given** Step 3, **Then** the buyer dropdown contains all stakeholders except the seller.
8. **Given** the admin selects a buyer and clicks "Next →", **Then** the backend `POST /ledger/:tenantId/buyout/preview` endpoint is called; on success the wizard advances to Step 4; on failure the error message is shown inline in Step 3.
9. **Given** Step 4 (Cost Basis), **Then** a read-only table shows all ISSUANCE transactions for the seller in the selected security (original issue date, quantity, original price per share). No eligibility computation is performed.
10. **Given** Step 5 (Confirmation), **Then** a full summary is shown: seller name, buyer name, security, quantity, sale price per share, total consideration (quantity × price), and the two ledger entries to be created (CANCELLATION for seller, ISSUANCE for buyer). A "Confirm & Apply" button is displayed.
11. **Given** the admin clicks "Confirm & Apply", **Then** `POST /ledger/:tenantId/buyout/commit` is called; on success a success state is shown and the page reloads; on failure an error is shown inline.
12. **Given** the commit succeeds, **Then** exactly two `LedgerTransaction` rows are created inside a single `withTenant` transaction: a CANCELLATION (seller, no `pricePerShare`, no `certificateNumber`) and an ISSUANCE (buyer, with `pricePerShare` and a new `CS-XXXX` `certificateNumber`); the issuance's `previousRowHash` equals the cancellation's `chainHash`.
13. **Given** the commit succeeds and the buyer has an email address, **Then** a stock certificate PDF (per User Story 3.20) is generated and emailed to the buyer asynchronously (fire-and-forget, same as `recordTransaction`).

**Validation** (enforced on both preview and commit):
- Seller ≠ buyer.
- Quantity > 0.
- Sale price per share > 0.
- Seller's balance in the selected security at commit time ≥ quantity (re-validated at commit, not just preview).
- Seller, buyer, and security must all belong to the tenant.

**Backend endpoints** (`LedgerController`):
- `GET /ledger/:tenantId/holdings/:stakeholderId` — returns `{ securityId, securityName, securityType, balance }[]` filtered to securities with a positive net balance.
- `POST /ledger/:tenantId/buyout/preview` — accepts `{ sellerId, buyerId, securityId, quantity, pricePerShare }`, returns `{ seller, buyer, security, sellerBalance, quantity, pricePerShare, totalConsideration, sellerIssuances[] }`. No DB write.
- `POST /ledger/:tenantId/buyout/commit` — same body; creates both ledger entries atomically. Returns `{ cancellationEntry, issuanceEntry }`.
- All three endpoints require ADMIN role.

**Key Implementation Notes**:
- No new Prisma schema changes — all data fits existing `LedgerTransaction` fields.
- `LedgerService.getStakeholderHoldings()` groups all transactions by `securityId` and applies the same sign rules as `getStakeholderBalance()`; returns only securities with a positive balance.
- `LedgerService.buyoutCommit()` creates both entries inside a single `withTenant` call. The cancellation's `chainHash` is computed first and used as the issuance's `previousRowHash`, maintaining chain integrity.
- Cert number for the issuance is computed with `count({ where: { tenantId, certificateNumber: { not: null } } })` inside the same transaction.
- 4 unit tests added for `getStakeholderHoldings`, 7 for `buyoutPreview`, 9 for `buyoutCommit` (251 total backend tests passing).
- 5 E2E tests added in `ledger.spec.ts`.

---

### User Story 3.22 - Add Stakeholder from the Stakeholders Tab (Priority: P1)

**As an** admin, **I want to** add a new stakeholder directly from the Stakeholders tab without navigating away, **so that** I can quickly onboard investors, employees, or entities before issuing them equity.

**Why this priority**: Stakeholders must exist before they can appear in the Ledger or Cap Table. The alternative flow (add via Cap Table) is non-obvious; a direct "Add Stakeholder" button on the Stakeholders page reduces admin friction.

**Independent Test**: On the `/company/:id/stakeholders` page, click "Add Stakeholder", fill in a name and type, submit, and confirm the new stakeholder appears at the top of the list without a page reload.

**Acceptance Scenarios**:

1. **Given** an admin navigates to the Stakeholders tab, **Then** an "Add Stakeholder" button is visible in the table header.
2. **Given** the admin clicks "Add Stakeholder", **Then** a modal opens with Name (required), Type (INDIVIDUAL/ENTITY select), and Email (optional) fields.
3. **Given** the Name field is empty, **Then** the submit button is disabled.
4. **Given** the admin types a name, **Then** the submit button becomes enabled.
5. **Given** the admin clicks Cancel, **Then** the modal closes without making any API call.
6. **Given** the admin submits a valid name and type with no email, **Then** a POST to `POST /api/v1/stakeholders` is made and the new stakeholder is prepended to the list.
7. **Given** the admin submits with an email already in use by another stakeholder, **Then** an inline error "A stakeholder with that email address already exists." is shown and the modal stays open.
8. **Given** the submit succeeds, **Then** the modal closes and the new stakeholder appears at the top of the table with the correct name, type badge, and "No account" in the Platform Role column.

**Validation Rules**:
- Name must be non-empty after trimming whitespace.
- Type must be `INDIVIDUAL` or `ENTITY` (defaults to `INDIVIDUAL`).
- Email is optional; if provided it must be unique per tenant.

**Backend Endpoints Used**:
- `POST /api/v1/stakeholders` — `StakeholderController.createStakeholder()`, requires ADMIN role; accepts `{ name, type, email? }`.

**Key Implementation Notes**:
- No backend changes required — `POST /api/v1/stakeholders` already existed.
- Modal state (`addOpen`, `addName`, `addType`, `addEmail`, `addError`, `addSubmitting`) added to `stakeholders/index.tsx`.
- On success, the created object is prepended to the React state array (no page reload).
- `data-testid` attributes: `add-stakeholder-button`, `add-stakeholder-modal`, `add-stakeholder-name`, `add-stakeholder-type`, `add-stakeholder-email`, `add-stakeholder-submit`.
- 5 unit tests already existed for `createStakeholder` (empty name, whitespace trim, duplicate email, entity type, no email).
- 7 E2E tests added in `stakeholders.spec.ts` (button visible, modal opens, fields present, submit disabled when empty, enabled after name entry, cancel closes modal, full round-trip creates stakeholder).

---

### User Story 3.17 - Company Icons on the /companies List (Priority: P2)

**As a** user on the `/companies` page, **I want to** see each company's icon (or monogram fallback) on its card, **so that** companies are visually distinct and the list feels consistent with the rest of the app.

**Why this priority**: Cosmetic consistency — the icon/monogram is already set up everywhere else (CompanyNav, company info page) and the `/companies` page is the primary entry point.

**Independent Test**: On the `/companies` page, confirm that a company with a custom icon shows that image, while a company without one shows a blue square with the first letter of its name. Confirm the `BuildingIcon` (blue 3×3 table grid) is no longer shown on cards.

**Acceptance Scenarios**:
1. **Given** a company has a custom `iconUrl`, **When** its card is displayed on `/companies`, **Then** the icon image is shown (42×42px, rounded corners) in place of the generic building icon.
2. **Given** a company has no `iconUrl`, **When** its card is displayed, **Then** a blue 42×42px monogram square with the uppercased first letter of the company name is shown.
3. **Given** either case, **Then** the card layout (company name, date, authorized shares, par value) is unchanged.

**Key Implementation Notes**:
- `Company` interface extended with `iconUrl?: string | null`.
- The `BuildingIcon` component is retained only for the empty-state illustration (no companies yet); it is no longer used in the company cards.

---

### User Story 3.16 - Alpha Badge on All Brand Nav Pages (Priority: P3)

**As a** user on any page that shows the CapTable logo and brand name, **I want to** see the "Alpha" badge next to the wordmark, **so that** the app's pre-release status is consistently communicated everywhere, not just on the homepage.

**Why this priority**: Low-effort consistency fix; the badge already exists on the homepage and simply needs propagating.

**Independent Test**: Visit `/companies`, `/signup`, `/privacy`, and `/terms`. Confirm the amber "Alpha" badge appears after the "CapTable" wordmark on each page. Hover the badge and confirm the tooltip appears.

**Acceptance Scenarios**:
1. **Given** any of the pages `/companies`, `/signup`, `/privacy`, `/terms`, **When** the page renders, **Then** an amber "Alpha" badge appears to the right of the "CapTable" brand name in the navigation.
2. **Given** the Alpha badge is visible, **When** the user hovers over it, **Then** a tooltip reads "⚠ This app is under rapid development and is currently for educational uses only."
3. **Given** the badge is rendered, **Then** it is visually identical to the badge on the homepage (same color, font, border, and padding).

**Key Implementation Notes**:
- Badge and tooltip logic extracted into a reusable `AlphaBadge` component at `src/components/AlphaBadge.tsx`.
- Imported and placed immediately after the `<span>CapTable</span>` wordmark on `/companies`, `/signup`, `/privacy`, and `/terms`.

---

### User Story 3.15 - Automatic Vesting Entries on the Ledger (Priority: P1)

**As an** admin viewing the ledger, **I want to** see VEST entries automatically created over time for each options holder in accordance with their vesting schedule, **so that** the ledger is always an accurate source of truth for who has vested what.

**Why this priority**: Vesting is a core cap-table operation. Without automatic VEST entries, the ledger understates stakeholders' earned equity and the equity tab shows stale data.

**Independent Test**: Create a grant with a past grant date (e.g., 2 years ago), a 1-year cliff, and monthly vesting. Navigate to the Ledger page. Confirm that VEST ledger entries appear automatically, one per due vesting period, with correct quantities and timestamps matching the scheduled vest dates.

**Acceptance Scenarios**:
1. **Given** a grant exists with a grant date in the past and a vesting schedule, **When** an admin loads the Ledger page, **Then** VEST entries are automatically created for all vesting periods whose scheduled date is on or before today.
2. **Given** a grant has a 1-year cliff, **When** vesting is materialized before the cliff date, **Then** no VEST entries are created.
3. **Given** the cliff date has passed, **When** vesting is materialized, **Then** a single cliff VEST entry is created aggregating all periods up to the cliff date.
4. **Given** post-cliff periods are due, **When** vesting is materialized, **Then** one VEST entry per period is created at the scheduled vest date.
5. **Given** vesting has already been materialized, **When** the Ledger page is loaded again, **Then** no duplicate VEST entries are created (idempotent).
6. **Given** total grant quantity does not divide evenly by the number of periods, **When** vesting entries are created, **Then** the last period absorbs any rounding remainder so the sum of all VEST entries equals the grant quantity exactly.
7. **Given** a VEST entry fails to create (e.g., server error), **When** the ledger page loads, **Then** the existing data is still displayed — vesting materialization is non-blocking.

**Key Implementation Notes**:
- `computeVestingEvents(grant, schedule)` is a pure function in `vesting.service.ts` that returns `{ periodIndex, date, quantity }[]`. Events before the cliff are batched into a single cliff event at `grantDate + cliffMonths`.
- `VestingService.materializeVestings(tenantId, now)` queries all grants for the tenant, checks which `(grantId, vestingPeriodIndex)` pairs already exist in the ledger (unique constraint prevents duplicates), and calls `LedgerService.recordTransaction` for any missing ones with `transactionType = 'VEST'` and `timestamp = event.date`.
- `POST /api/v1/grants/run-vesting` is called on every Ledger page load, before fetching the transaction report. The call is fire-and-forget (errors are swallowed so they don't block page rendering).
- `LedgerTransaction` has two new nullable fields: `grantId` (foreign key to `Grant`) and `vestingPeriodIndex` (Int). A `@@unique([grantId, vestingPeriodIndex])` constraint provides the idempotency guarantee — PostgreSQL does not enforce uniqueness between NULL rows.

---

### User Story 3.14 - User Info Modal (Priority: P2)

**As a** logged-in user, **I want to** choose "User Info" from the user dropdown, **so that** I can view my email address and update my display name without leaving the app.

**Why this priority**: Users who signed up via email or Google SSO may want to correct their display name; exposing a lightweight profile editor avoids the need for a separate settings page.

**Independent Test**: Open the user menu, click "User Info", confirm a modal opens with a read-only email field pre-populated from the JWT and an editable name field. Update the name, click Save, and confirm the modal closes and the nav now shows the updated name.

**Acceptance Scenarios**:
1. **Given** any authenticated page, **When** the user opens the user dropdown, **Then** "User Info" is listed as the first item (above "Contact Support").
2. **Given** the user menu is open, **When** the user clicks "User Info", **Then** the dropdown closes and a modal opens titled "User Info".
3. **Given** the User Info modal is open, **Then** the email field is pre-populated with the user's email from the JWT and is read-only.
4. **Given** the User Info modal is open, **Then** the name field is pre-populated with the user's current display name from the JWT and is editable.
5. **Given** the user updates the name and clicks "Save", **When** the server responds with a new JWT, **Then** the modal closes, the new token is stored, and the nav bar reflects the updated name.
6. **Given** the User Info modal is open, **When** the user clicks "Cancel" or the × button, **Then** the modal closes without saving any changes.
7. **Given** the modal is present on both `/companies` and any company-scoped page, **Then** the same User Info behavior is available from both nav surfaces.

**Key Implementation Notes**:
- `PATCH /api/v1/auth/profile` accepts `{ name }`, updates the `User.name` column in the database, and returns a fresh signed JWT containing the updated name.
- The frontend reads `name` and `email` from the decoded JWT when the modal opens (no extra API call required for the initial load).
- After a successful save, the `/companies` page updates `displayName` state immediately so the nav label reflects the change without a reload.

---

### User Story 3.11 - Release Notes in User Menu (Priority: P2)

**As a** logged-in user, **I want to** see a "Release Notes" option in the user dropdown, **so that** I can read what has changed in the product without leaving the app.

**Why this priority**: Keeps users informed of new features and fixes; low-risk addition alongside the existing "Contact Support" item.

**Independent Test**: Open the user menu, click "Release Notes", confirm a modal opens with the heading "Release Notes", confirm content rows load from the Google Sheet, and confirm the modal closes via the × button and via backdrop click.

**Acceptance Scenarios**:
1. **Given** any authenticated page, **When** the user opens the user menu, **Then** "Release Notes" is listed between "Contact Support" and "Log Out".
2. **Given** the user menu is open, **When** the user clicks "Release Notes", **Then** the dropdown closes and a modal opens with the heading "Release Notes".
3. **Given** the Release Notes modal is open, **When** the content loads successfully, **Then** each row from the Google Sheet is displayed with its date (column A) and release note text (column B), in the order they appear in the sheet.
4. **Given** the Release Notes modal is open, **When** the user clicks the × button, **Then** the modal closes.
5. **Given** the Release Notes modal is open, **When** the user clicks the backdrop overlay, **Then** the modal closes.
6. **Given** the Release Notes modal is open and the Google Sheet is unreachable, **Then** an error message is shown in place of the entries.
7. **Given** the Release Notes modal has been opened once, **When** the user opens it again, **Then** the previously fetched entries are shown immediately (no second network request).

**Key Implementation Notes**:
- Release note content is fetched from the Google Sheet at `https://docs.google.com/spreadsheets/d/1Ht3pQQUXwt7-r0PY1G0Xdxobb-baFWO3yayC_l8nFsU` via the public gviz/tq JSON endpoint (`?tqx=out:json`). No API key is required because the sheet is publicly readable.
- Column A contains the date label (formatted string); column B contains the release note text. The header row is skipped by the gviz response format.
- Fetched entries are cached in component state; re-opening the modal reuses the cached result.
- The modal is rendered as a sibling of `<nav>` in the DOM (not nested inside it) to avoid z-index conflicts.

---

### User Story 3.5 - Company Switcher Dropdown (Priority: P1)

**As a** user who belongs to multiple companies, **I want to** switch between my companies directly from the navigation bar without returning to the companies list, **so that** I can move fluidly between my cap tables.

**Why this priority**: Multi-company membership is only useful if navigation between companies is frictionless. The breadcrumb "My Companies / Company Name" is the logical affordance for this switcher.

**Independent Test**: Log in as a user with two or more companies. While on `/company/{id}`, click the company name in the nav breadcrumb and confirm a dropdown appears listing all your companies. Select a different company and confirm the URL changes to `/company/{other_id}`.

**Acceptance Scenarios**:
1. **Given** a user on any `/company/{id}/*` page, **When** they click the company name in the nav breadcrumb, **Then** a dropdown opens listing all companies where they hold a `CompanyMembership`, fetched from `GET /api/v1/tenants`.
2. **Given** the dropdown is open, **When** the user selects a different company, **Then** the browser navigates to `/company/{selected_id}` and the dropdown closes.
3. **Given** the dropdown is open, **When** the user selects the currently active company, **Then** nothing happens (no navigation).
4. **Given** the dropdown is open and the user has only one company, **Then** that one company is listed with a checkmark; an "+ All companies" link routes to `/companies`.
5. **Given** a user on a stakeholder detail sub-page (e.g., `/company/{id}/stakeholder/{sid}`), **When** the page loads, **Then** the nav shows "My Companies / Company Name ▾ / Stakeholder Name" and the switcher works the same as on the dashboard.

---

### User Story 3.6 - Stakeholders Tab & Role Management (Priority: P1)

**As a** Company Admin, **I want to** view all stakeholders in a dedicated tab on the company dashboard, and promote a stakeholder to Admin, **so that** I can manage who has administrative access without leaving the cap table context.

**Why this priority**: The Stakeholders tab is the primary surface for managing company membership. Without it, there is no way to grant admin access to additional users.

**Independent Test**: Navigate to `/company/{id}/stakeholders`. Confirm the tab is highlighted, the stakeholder list loads, and a "Make Admin" button appears beside any stakeholder whose platform role is `STAKEHOLDER`. Click the button, confirm the badge changes to `ADMIN`, and confirm the button disappears for that row.

**Acceptance Scenarios**:
1. **Given** an authenticated user on `/company/{id}`, **When** they click the "Stakeholders" tab, **Then** the browser navigates to `/company/{id}/stakeholders` and the Stakeholders tab is highlighted.
2. **Given** a Stakeholders page, **Then** it lists every `Stakeholder` equity-holder record AND every `CompanyMembership` user who has no `Stakeholder` record (e.g., the founding admin). Each row shows name, email, type, and platform role (ADMIN / STAKEHOLDER / "No account").
3. **Given** an Admin viewing the list, **When** a stakeholder row shows role = STAKEHOLDER, **Then** a "Make Admin" button is rendered; clicking it calls `PATCH /api/v1/tenants/:id/memberships/:userId/role` and updates the badge to ADMIN.
4. **Given** a stakeholder with no platform account (no `CompanyMembership`), **Then** the row shows "No account" and no action button is rendered.
5. **Given** a non-Admin user viewing the list, **Then** no "Make Admin" buttons are rendered.

---

### User Story 3.7 - Equity Tab & Role-Based Tab Visibility (Priority: P1)

**As a** company member, **I want to** see my own equity holdings and vesting schedule in a dedicated "Equity" tab, **so that** I can view my position without needing admin access to the full cap table.

**Why this priority**: Non-admin members (stakeholders) must have a meaningful entry point into the app. Without an Equity tab they have no accessible page after login.

**Independent Test**: Log in as a STAKEHOLDER user, confirm only the "Equity" tab is visible, confirm the page loads equity data from `GET /api/v1/tenants/:id/my-equity`, and confirm navigating directly to `/company/{id}/cap_table` or `/company/{id}/stakeholders` redirects back to `/company/{id}/equity`.

**Acceptance Scenarios**:
1. **Given** an authenticated ADMIN, **When** on any company-scoped tab, **Then** five tabs are visible in order: "Equity" | "Ledger" | "Cap Table" | "Stakeholders" | "Company Info".
2. **Given** an authenticated STAKEHOLDER, **When** on any company-scoped page, **Then** only the "Equity" tab is visible.
3. **Given** a STAKEHOLDER navigating directly to `/company/{id}/cap_table` or `/company/{id}/stakeholders`, **Then** the app redirects them to `/company/{id}/equity`.
4. **Given** a user with a `Stakeholder` equity record (matched by email), **When** they visit `/company/{id}/equity`, **Then** their holdings, grants, and vesting timeline are displayed.
5. **Given** a user with no `Stakeholder` equity record, **When** they visit `/company/{id}/equity`, **Then** an empty state message is shown ("No equity positions yet").
6. **Given** an ADMIN, **When** they click a stakeholder's name in the Stakeholders list, **Then** they navigate to `/company/{id}/stakeholder/{id}/equity` showing that stakeholder's full equity detail.
7. **Given** a non-admin navigating to `/company/{id}/stakeholder/{id}/equity`, **Then** the app redirects them to `/company/{id}/equity`.
8. **Given** a user navigating directly to `/company/{id}`, **When** they are ADMIN, **Then** they are redirected to `/company/{id}/cap_table`; **When** they are STAKEHOLDER, **Then** they are redirected to `/company/{id}/equity`.
9. **Given** any user viewing `/company/{id}/equity`, **Then** a prominent informational notice is displayed at the bottom of the page reading: "If you have questions about this information, or wish to make changes, please contact your manager or an administrator."

---

### User Story 3.10 - Cap Table Pie Chart & Ledger Tab (Priority: P1)

**As a** Company Admin, **I want to** see a summary pie chart of ownership by security type on the Cap Table tab, and view the full transaction history on a separate Ledger tab, **so that** I can understand the current ownership structure at a glance without the ledger table overwhelming the dashboard.

**Why this priority**: The ledger table is operational detail; the cap table overview needs a visual summary. Separating them into two tabs keeps each view focused and immediately useful.

**Independent Test**: Navigate to `/company/{id}/cap_table`. Confirm the ledger table is gone and a donut pie chart is shown with one slice per security type that has net-positive issued shares. Navigate to `/company/{id}/ledger`. Confirm the full transactions table and click-to-expand modal work exactly as before. Verify a STAKEHOLDER user navigating to either URL is redirected to `/equity`.

**Acceptance Scenarios**:
1. **Given** an Admin on the Cap Table tab, **When** the page loads, **Then** a donut pie chart is displayed showing one slice per security type with a net-positive issued share count. The ledger transactions table is NOT present on this page.
2. **Given** the pie chart, **When** the Admin hovers over a slice, **Then** a tooltip shows the security type name and net issued share count.
3. **Given** the pie chart, **When** rendered, **Then** a breakdown legend below it lists each security type with its color, formatted net share count, and percentage of total issued shares.
4. **Given** no issued shares in the ledger, **When** the Cap Table tab loads, **Then** an empty-state message is shown in place of the chart ("No issued shares recorded yet.").
5. **Given** an Admin on the Ledger tab (`/company/{id}/ledger`), **When** the page loads, **Then** the full chronological ledger transactions table is shown, each row clickable to expand an audit-trail detail modal (hash, stakeholder, security, timestamps).
6. **Given** a STAKEHOLDER navigating directly to `/company/{id}/ledger` or `/company/{id}/cap_table`, **Then** the app redirects them to `/company/{id}/equity`.
7. **Given** any Admin company page, **When** the tab bar renders, **Then** tabs appear in this order: Equity | Ledger | Cap Table | Stakeholders | Company Info.

**Key Implementation Notes**:
- Pie chart slices represent **net issued shares** per security type: `sum(ISSUANCE) − sum(CANCELLATION)`. Security types with a net of zero or below are excluded from the chart.
- The chart is a recharts `PieChart` with a donut style (`innerRadius`, `outerRadius`). The existing `GET /api/v1/ledger/:tenantId/report` endpoint supplies all transaction data needed — no new backend endpoint is required.
- The "Total Issued" stat card on the Cap Table tab replaces the former "Ledger Entries" card and shows the sum of all net-issued shares across all security types.
- Security type colors are consistent across the app: Common Stock `#0066cc`, Preferred Stock `#7c3aed`, Options `#f59e0b`, SAFEs `#10b981`, Convertible Notes `#06b6d4`, Warrants `#f97316`.

---

### User Story 3.9 - Company Info Tab (Priority: P1)

**As a** Company Admin, **I want to** update the company's name, website, and icon from a dedicated "Company Info" tab, **so that** company branding and metadata are easy to maintain without a support request.

**Why this priority**: Company metadata (name and icon) is visible in the nav on every page; admins need a self-service way to keep it accurate.

**Independent Test**: As an Admin, navigate to `/company/{id}/company_info`. Confirm the form pre-fills with the current name and any previously saved website/icon. Upload a square image under 500 KB, save, and confirm the nav icon updates. Verify a non-Admin visiting the same URL is redirected to `/company/{id}/equity`.

**Acceptance Scenarios**:
1. **Given** an Admin on any company page, **When** they click the "Company Info" tab, **Then** the browser navigates to `/company/{id}/company_info`.
2. **Given** the Company Info page, **When** it loads, **Then** a form is displayed pre-filled with the current company name, website (if set), and a preview of the current icon (if set).
3. **Given** a valid form submission, **When** the Admin clicks "Save Changes", **Then** `PATCH /api/v1/tenants/:tenantId` is called, the Tenant record is updated, and a success confirmation is shown.
4. **Given** a saved icon, **When** the Company Info page loads, **Then** the icon is shown as a preview image above the file-chooser button.
5. **Given** a saved icon, **When** any company page loads, **Then** the icon is displayed at 28×28px immediately to the right of the company name dropdown in the nav bar.
6. **Given** a non-Admin user navigating directly to `/company/{id}/company_info`, **Then** the app redirects them to `/company/{id}/equity`.
7. **Given** a form submission with an empty company name, **Then** the system MUST reject with a client-side validation error before making any API call.
8. **Given** an Admin selects an image file larger than 500 KB, **Then** the file is rejected client-side with an error message and no API call is made.
9. **Given** an Admin selects a non-square image (width ≠ height), **Then** the file is rejected client-side with a message showing the actual dimensions and no API call is made.
10. **Given** a valid square image ≤ 500 KB, **When** selected, **Then** it is converted to a base64 data URL and shown immediately as a preview; the data URL is sent to the backend on save.
11. **Given** an existing icon, **When** the Admin clicks "Remove icon" and saves, **Then** `iconUrl` is set to `null` on the Tenant and the icon no longer appears in the nav.
12. **Given** no custom icon has been saved (`iconUrl` is null or empty), **When** any company page with the nav bar loads, **Then** a 28×28px monogram is displayed at the icon position showing the capitalized first letter of the company name, with a blue (`#0066cc`) background and white text.

**Key Implementation Notes**:
- `PATCH /api/v1/tenants/:tenantId` accepts `{ name?, website?, iconUrl? }` and is ADMIN-gated.
- The icon is uploaded from the user's computer, converted client-side to a base64 data URL, and stored as a string in `Tenant.iconUrl`. No file-hosting service is required.
- Both the size check (> 500 KB) and the square check (width ≠ height) are enforced client-side using `File.size` and a temporary `Image` object to read natural dimensions before the `FileReader` encodes the data URL.
- `GET /api/v1/tenants` (company list) includes `website` and `iconUrl` in each Tenant response, so the nav icon can be resolved from the already-fetched company list without an extra round-trip.

---

### User Story 1.2 - Equity Incentive Pool Management (Priority: P2)

**As a** Founder/Board Member, **I want to** create and expand an option pool, **so that** we have a dedicated ledger of unallocated shares.

**Acceptance Scenarios**:
1. **Given** an existing pool, **When** increasing the pool size, **Then** the change is recorded as a ledger transaction.
2. **When** viewing the pool, **Then** 'Authorized', 'Allocated', and 'Available' balances MUST be displayed with decimal precision.

---

### User Story 1.4 - Modeling & Closing a Funding Round (Priority: P2)

**As a** Company Admin, **I want to** simulate and finalize a priced round, convert outstanding SAFEs, and issue Preferred Stock.

**Acceptance Scenarios**:
1. **Given** outstanding SAFEs with valuation caps, **When** closing a round, **Then** conversion to Preferred Stock is calculated automatically.
2. **When** modeling a round, **Then** the system MUST provide a preview ledger that does not mutate the main database until finalized.

---

### User Story 2.2 - Simulating and Initiating Exercises (Priority: P2)

**As a** Vested Option Holder, **I want to** select an amount of vested options to exercise and submit a request.

**Acceptance Scenarios**:
1. **When** initiating an exercise, **Then** an informational tax warning MUST be displayed.
2. **Given** an exercise request, **When** submitted, **Then** it MUST be queued for Admin approval and NOT mutate the ledger immediately.

---

### User Story 4.2 - As-Of-Date Historical Ledger Audit (Priority: P2)

**As a** Company Administrator, **I want to** view the entire cap table exactly as it stood on a specific historical date.

**Acceptance Scenarios**:
1. **When** querying a historical date, **Then** the system MUST replay the append-only ledger up to that timestamp to generate the view.
2. **Then** the generated view MUST be downloadable as an immutable PDF report.

---

### Edge Cases

- **Rounding Errors**: Handling fractional shares (e.g., $1/3$ share) using high-precision math to ensure the sum of individual holdings equals the ledger total.
- **Over-Issuance**: Attempting to grant more options than available in the pool or more shares than authorized.
- **Cross-Tenant Access**: Handling malformed or hijacked tokens attempting to leak data across companies.
- **Vesting Modifications**: Retroactive changes to vesting schedules (must be handled via new ledger entries, not mutation).
- **Leaver Processing**: Terminating an employee and handling the cancellation of unvested options and the post-termination exercise period (PTEP).
- **Invitation Edge Cases**: An invitee who changes their email on the onboarding page but fails to verify the new email — invitation remains PENDING and the original link cannot be re-used.
- **Duplicate Invitations**: Inviting an email that already holds an ACCEPTED CompanyMembership for that company — system should return a 409 and not send a new email.
- **Invitation + Existing Account**: An invited email that belongs to an existing CapTable user — membership must attach to the existing User, not create a duplicate account.

## E2E Test Coverage

### Framework & Location

End-to-end tests use Playwright and live in `frontend/tests/e2e/`. Configuration is at `frontend/playwright.config.ts`.

```bash
# Run all E2E tests (starts both servers automatically)
cd frontend && npm run test:e2e

# View HTML report on failure
cd frontend && npx playwright show-report
```

### Auth Strategy

Tests register accounts with unique `@maildrop.cc` disposable addresses. Postmark delivers the real verification email to Maildrop, the test polls the Maildrop API until it arrives, extracts the verification link, and navigates the browser through it. The email is deleted from Maildrop only after the relevant assertions pass — so if a test fails, the email remains for inspection.

The backend is started with `NODE_ENV=test` which loads `backend/.env.test`. A dedicated `captable_test` database keeps test data isolated from the dev database.

After every test run, `global-teardown.ts` deletes all users, tenants, and associated records whose email ends with `@maildrop.cc`.

### Test Map

| File | User Stories | Scope |
|------|-------------|-------|
| `auth/signup.spec.ts` | 0.1 | Register returns 202; duplicate email returns 409; invalid token returns 400; full browser flow: register → Maildrop poll → verify link → `/companies` with token stored |
| `companies/companies-list.spec.ts` | 3.1, 0.2, 3.11 | Unauthenticated redirect to `/login`; company card visible after login; create company modal; zero-shares validation; Release Notes option in user menu on /companies; modal opens and closes |
| `company/nav.spec.ts` | 3.5, 3.8, 3.9, 3.11 | User menu opens on click; Log Out clears token and redirects to `/login`; dropdown closes on outside click; company switcher shows checkmark on current company and "+ All companies" link; Release Notes modal opens and closes; monogram shows first letter when no icon is set |
| `company/stakeholders.spec.ts` | 3.6 | Stakeholders tab navigation; ADMIN badge visible for founding user; all five tabs visible to admin |
| `company/equity.spec.ts` | 3.7 | Admin sees all five tabs; `/company/:id` redirects admin to `cap_table`; empty equity state when no Stakeholder record |
| `security/tenant-isolation.spec.ts` | 4.1 | Tenant A JWT rejected on Tenant B's tenant, stakeholders, and ledger endpoints (403) |

### Screenshots

All tests run with `screenshot: 'on'` — every step captures a PNG into `frontend/test-results/`. Inspect screenshots to diagnose visual failures:
```bash
ls frontend/test-results/
```

### Adding New Tests

1. Use `uniqueMailbox()` and `maildropAddress()` from `helpers/maildrop.ts` for any test that needs its own account. Never share user state between tests that mutate data.
2. Call `deleteEmail()` only after the relevant assertions pass.
3. Tests using the pre-authed admin session import `{ test, expect }` from `fixtures/index.ts`.
4. Pure API tests (no browser navigation) use the standard `@playwright/test` import with the `request` fixture.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-000: Email Verification on Signup**: Users registering with email/password MUST verify their email address via a one-time link before a `User` or `Tenant` record is created. Google SSO users are exempt.
- **FR-001: Immutable Ledger**: All equity events MUST be recorded in an append-only transaction ledger.
- **FR-002: Multi-Tenant Isolation**: Every database record MUST be associated with a `tenant_id` and enforced via middleware.
- **FR-003: Data Precision**: All share counts and monetary values MUST use `Decimal` types (min 6 decimal places for shares).
- **FR-004: RBAC Enforcement**: Roles (Admin, Investor, Holder) MUST restrict access to specific features and data scopes.
- **FR-005: Validation Logic**: System MUST prevent issuing more shares than authorized or granting more options than allocated to the pool.
- **FR-006: SAFE/Convertible Modeling**: Automated conversion logic for SAFEs and Convertible Notes during funding rounds.
- **FR-007: Historical Reconstruction**: Capability to generate a cap table state for any arbitrary timestamp in the past.
- **FR-008: Multi-Company Membership**: A single `User` account MUST be able to hold membership in multiple companies. The `User` ↔ `Tenant` relationship is many-to-many via `CompanyMembership`, which records the user's role per company. The `User` table does NOT contain a `tenant_id` column.
- **FR-009: Invitation Gate for Ledger Entries**: An Admin MUST create a `CompanyInvitation` for a stakeholder (and have it accepted or at minimum sent) before any ledger entry may reference that stakeholder. The backend MUST enforce this constraint.
- **FR-010: Invitation Email Verification**: The invitation link serves as the invitee's email verification step for that specific email address. If the invitee changes their email on the onboarding page, a fresh verification email is sent to the new address before membership is granted.
- **FR-011: Company-Scoped Roles**: User roles (`ADMIN`, `STAKEHOLDER`) are scoped per `CompanyMembership` record, not globally on the `User` record. A user may be `ADMIN` in Company A and `STAKEHOLDER` in Company B simultaneously.
- **FR-014: Stakeholders Tab Endpoint**: `GET /api/v1/tenants/:tenantId/stakeholders` returns a unified list of all equity holders and platform members. The list includes: (a) every `Stakeholder` record, annotated with `membership: { userId, role }` if a matching `User` email exists in `CompanyMembership`, else `membership: null`; and (b) every `CompanyMembership` user whose email does NOT match any `Stakeholder` record, shown as a member-only row with `isStakeholder: false` and `type: null`. Users who are both a `Stakeholder` and a member appear exactly once.
- **FR-015: Role Promotion Endpoint**: `PATCH /api/v1/tenants/:tenantId/memberships/:userId/role` (ADMIN only) updates the `CompanyMembership.role` for the given user in the given company. Accepts `{ role: 'ADMIN' | 'STAKEHOLDER' }`. Returns 404 if no membership exists.
- **FR-013: Non-Unique Company Names**: Company (Tenant) names are NOT required to be unique. Two different companies may share the same display name. All identity and access control is performed via the opaque `tenant_id` UUID, never by name.
- **FR-012: Company Switcher Endpoint**: `GET /api/v1/tenants` MUST return an array of `Tenant` records for all companies where the authenticated user holds a `CompanyMembership`. The response is used to populate the company switcher dropdown in the nav. The endpoint requires authentication and returns an empty array (not 403) if the user has no memberships.
- **FR-016: My-Equity Endpoint**: `GET /api/v1/tenants/:tenantId/my-equity` returns the calling user's own equity summary (stakeholder info, balances, grants, vestingEvents) for the specified company. The stakeholder is resolved by matching the `email` from the caller's JWT against `Stakeholder.email` for that tenant. Returns `{ stakeholder: null, balances: [], grants: [], vestingEvents: [] }` if no matching `Stakeholder` record exists. Accessible to all authenticated company members (not admin-only).
- **FR-017: Role-Based Tab Visibility**: The company dashboard tab bar renders conditionally by role. ADMIN members see five tabs in order: Equity | Ledger | Cap Table | Stakeholders | Company Info. STAKEHOLDER members see only the Equity tab. Navigating directly to `/company/{id}/ledger`, `/company/{id}/cap_table`, `/company/{id}/stakeholders`, or `/company/{id}/company_info` as a STAKEHOLDER MUST redirect to `/company/{id}/equity`. Navigating directly to `/company/{id}/stakeholder/{id}/equity` as a STAKEHOLDER MUST also redirect to `/company/{id}/equity`.
- **FR-018: Company Info Endpoint**: `PATCH /api/v1/tenants/:tenantId` (ADMIN only) accepts a partial body `{ name?, website?, iconUrl? }` and updates the corresponding fields on the `Tenant` record. `website` and `iconUrl` may be set to `null` to clear them. Returns the updated `Tenant` object. The `GET /api/v1/tenants` list response includes `website` and `iconUrl` on each tenant so the nav bar can resolve the company icon without an additional request. The icon is stored as a base64 data URL; the frontend enforces that the source image is square and no larger than 500 KB before encoding.
- **FR-019: Icon Upload Validation**: Icon validation is enforced client-side before any API call.
- **FR-022: Company Monogram Fallback**: When a company has no saved `iconUrl`, the nav bar MUST render a 28×28px monogram in place of the icon, displaying the capitalized first letter of the company name on a blue (`#0066cc`) background. The monogram disappears only when a real icon is saved.
- **FR-020: Ledger Entry Stakeholder Notification**: After every successful `LedgerTransaction` commit, `LedgerService` MUST attempt to send a notification email to `Stakeholder.email` (if non-null). The attempt MUST be fire-and-forget — a Postmark failure MUST NOT roll back or delay the ledger write. The email is delivered via `EmailService.sendLedgerNotification()` and includes the transaction type, security label, quantity, company name, and a link to the stakeholder's equity page. The image MUST be square (natural width equals natural height) and MUST be 500 KB or smaller. Files failing either check are rejected with a descriptive error message; the file input is cleared and no network request is made.
- **FR-021: Release Notes Modal**: The user dropdown MUST include a "Release Notes" item between "Contact Support" and "Log Out". Clicking it opens a modal that fetches entries from a public Google Sheet (column A = date label, column B = release note text, data starts on row 2) via the gviz/tq JSON endpoint. The fetch result is cached in component state so re-opening the modal does not trigger a second network request. A fetch failure MUST show an inline error message; it MUST NOT crash the page. The modal closes on × button click or backdrop click.

## Success Criteria

1. **Precision**: 100% accuracy in share calculations; sum of ledger transactions MUST exactly match the cap table totals.
2. **Security**: Zero instances of unauthorized cross-tenant data access (horizontal privilege escalation).
3. **Auditability**: 100% of ledger-altering transactions MUST include a timestamp, initiator, and cryptographic hash or link to the previous entry.
4. **Performance**: Historical cap table reconstruction for 10,000+ transactions MUST complete in under 5 seconds.
5. **Testing**: 100% unit test coverage for the ledger service and conversion engines.

## Key Entities

- **PendingRegistration**: Temporary record holding a pre-hashed password and short-lived token for a signup that has not yet been email-verified. Does NOT store company details — those are collected at company creation time. Deleted upon successful verification.
- **User**: An authenticated identity (email + credentials). A `User` can hold membership in zero or more companies; there is no `tenant_id` on the `User` record. Membership and role are tracked via `CompanyMembership`.
- **CompanyMembership**: Join table linking a `User` to a `Tenant` with a role (`ADMIN` or `STAKEHOLDER`). A user may have one membership per company. Created when a user creates a company (ADMIN) or accepts an invitation (STAKEHOLDER).
- **CompanyInvitation**: A pending invitation for an email address to join a specific `Tenant`. Stores the invitee email, company ID, a short-lived token, and a status (`PENDING` | `ACCEPTED` | `EXPIRED`). No ledger entry may reference a stakeholder whose invitation is not at least PENDING.
- **Tenant**: Represents a legal company entity (Name, Authorized Shares, Par Value, optional Website, optional Icon URL).
- **Stakeholder**: An individual or entity holding equity in a specific company (Founders, Employees, Investors). Linked to a `User` once the invitation is accepted.
- **Security**: The base class for equity instruments (Common Stock, Preferred Stock, Options, SAFEs).
- **Grant/Issuance**: A specific award of a Security to a Stakeholder.
- **Vesting Schedule**: Logic defining the release of shares over time.
- **Ledger Entry**: The atomic record of an equity transaction.
- **Option Pool**: An allocation of shares reserved for future grants.

## Routes & Pages

| Route | Access | Description |
|---|---|---|
| `/companies` | Authenticated | List all companies the user is a member of; create new companies. |
| `/company/{company_id}` | CompanyMembership required | Redirect → `/company/{company_id}/cap_table` (ADMIN) or `/company/{company_id}/equity` (STAKEHOLDER). |
| `/company/{company_id}/equity` | CompanyMembership required | Equity tab: the current user's own holdings, grants, and vesting timeline. Accessible to all roles. |
| `/company/{company_id}/ledger` | ADMIN only | Ledger tab: full chronological ledger transactions table with click-to-expand audit-trail detail modal. Non-admins are redirected to `/equity`. |
| `/company/{company_id}/cap_table` | ADMIN only | Cap Table tab: stat cards, ownership donut pie chart (net issued shares by security type), Add Investment / Grant Options actions. Non-admins are redirected to `/equity`. |
| `/company/{company_id}/stakeholders` | ADMIN only | Stakeholders tab: all equity holders and platform members; Admin can upgrade roles here. Non-admins are redirected to `/equity`. |
| `/company/{company_id}/company_info` | ADMIN only | Company Info tab: edit company name, website, and icon. Non-admins are redirected to `/equity`. |
| `/company/{company_id}/stakeholder/{stakeholder_id}` | CompanyMembership required | Redirect → `/company/{company_id}/stakeholder/{stakeholder_id}/equity`. |
| `/company/{company_id}/stakeholder/{stakeholder_id}/equity` | ADMIN only | Admin view of a specific stakeholder's equity detail: vesting graph, grant list, holdings summary. Non-admins are redirected to `/equity`. |

## Assumptions

- **Currency**: Currency is USD. No other currencies are supported at this time.
- **Compliance**: The system provides tools for compliance (e.g., ISO limits) but legal finality rests with the Company Admin.
- **Timezone**: All ledger timestamps are stored in UTC.
