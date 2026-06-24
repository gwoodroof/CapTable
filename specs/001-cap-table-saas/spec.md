# Feature Specification: Cap Table Management SaaS

**Feature Branch**: `001-cap-table-saas`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "Draft a rigorous, production-grade product specification file for our multi-tenant Cap Table Management SaaS... organized into 4 critical epic buckets..."

## User Scenarios & Testing *(mandatory)*

### User Story 1.1 - Company Onboarding & Founding Stock (Priority: P1)

**As a** Company Founder, **I want to** initialize my company's legal entity metadata (Authorized Shares, Par Value, Class A Common Stock) and issue initial shares to co-founders, **so that** the baseline ownership structure is established.

**Why this priority**: Essential first step for any tenant using the system.

**Independent Test**: Can be verified by creating a new tenant and issuing founding shares, then checking the ledger for correct initial state.

**Acceptance Scenarios**:
1. **Given** a new tenant, **When** initializing metadata with 10M Authorized Shares and $0.0001 Par Value, **Then** the company entity is created successfully.
2. **Given** 10M Authorized Shares, **When** issuing 4M shares to Founder A and 4M shares to Founder B, **Then** the transactions are recorded in the immutable ledger.
3. **Given** 10M Authorized Shares, **When** attempting to issue 11M shares, **Then** the system MUST block the transaction with a validation error.

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

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001: Immutable Ledger**: All equity events MUST be recorded in an append-only transaction ledger.
- **FR-002: Multi-Tenant Isolation**: Every database record MUST be associated with a `tenant_id` and enforced via middleware.
- **FR-003: Data Precision**: All share counts and monetary values MUST use `Decimal` types (min 6 decimal places for shares).
- **FR-004: RBAC Enforcement**: Roles (Admin, Investor, Holder) MUST restrict access to specific features and data scopes.
- **FR-005: Validation Logic**: System MUST prevent issuing more shares than authorized or granting more options than allocated to the pool.
- **FR-006: SAFE/Convertible Modeling**: Automated conversion logic for SAFEs and Convertible Notes during funding rounds.
- **FR-007: Historical Reconstruction**: Capability to generate a cap table state for any arbitrary timestamp in the past.

## Success Criteria

1. **Precision**: 100% accuracy in share calculations; sum of ledger transactions MUST exactly match the cap table totals.
2. **Security**: Zero instances of unauthorized cross-tenant data access (horizontal privilege escalation).
3. **Auditability**: 100% of ledger-altering transactions MUST include a timestamp, initiator, and cryptographic hash or link to the previous entry.
4. **Performance**: Historical cap table reconstruction for 10,000+ transactions MUST complete in under 5 seconds.
5. **Testing**: 100% unit test coverage for the ledger service and conversion engines.

## Key Entities

- **Tenant**: Represents a legal company entity.
- **Stakeholder**: An individual or entity holding equity (Founders, Employees, Investors).
- **Security**: The base class for equity instruments (Common Stock, Preferred Stock, Options, SAFEs).
- **Grant/Issuance**: A specific award of a Security to a Stakeholder.
- **Vesting Schedule**: Logic defining the release of shares over time.
- **Ledger Entry**: The atomic record of an equity transaction.
- **Option Pool**: An allocation of shares reserved for future grants.

## Assumptions

- **Currency**: Currency is USD. No other currencies are supported at this time.
- **Compliance**: The system provides tools for compliance (e.g., ISO limits) but legal finality rests with the Company Admin.
- **Timezone**: All ledger timestamps are stored in UTC.
