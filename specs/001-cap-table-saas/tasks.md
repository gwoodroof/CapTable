# Tasks: Cap Table Management SaaS

**Input**: Design documents from `specs/001-cap-table-saas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-v1.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure with `backend/` and `frontend/` directories
- [x] T002 Initialize NestJS backend in `backend/` with strict TypeScript
- [x] T003 Initialize Next.js frontend in `frontend/` with Tailwind CSS
- [x] T004 [P] Configure Vitest in `backend/package.json` for unit testing
- [x] T005 [P] Configure Playwright in `frontend/package.json` for E2E testing
- [x] T006 [P] Setup ESLint and Prettier across the workspace

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T007 Initialize Prisma in `backend/` and configure PostgreSQL connection
- [x] T008 [P] Define base Prisma schema in `backend/prisma/schema.prisma` with `tenant_id` on all tables
- [x] T009 [P] Create precision math utility using `decimal.js` in `backend/src/common/utils/math.ts`
- [x] T010 Setup PostgreSQL Row-Level Security (RLS) migrations in `backend/prisma/migrations/`
- [x] T011 [P] Implement `LedgerService` skeleton in `backend/src/modules/ledger/ledger.service.ts`
- [x] T012 Implement `AuthMiddleware` in `backend/src/common/middleware/auth.middleware.ts` for JWT verification and Tenant extraction

**Checkpoint**: Foundation ready - user story implementation can now begin
---

## Phase 3: User Story 4.1 - Multi-Tenant Isolation & Role Enforcement (Priority: P1)

**Goal**: Ensure rigid data isolation and RBAC enforcement.

**Independent Test**: Verify that a user from Tenant A cannot access Tenant B resources.

### Implementation for User Story 4.1

- [ ] T013 [P] [US4.1] Create `TenantInterceptor` in `backend/src/common/interceptors/tenant.interceptor.ts` to enforce tenant scoping
- [ ] T014 [P] [US4.1] Implement `RolesGuard` in `backend/src/common/guards/roles.guard.ts` for RBAC enforcement
- [ ] T015 [US4.1] Configure Global Guards and Interceptors in `backend/src/main.ts`
- [ ] T016 [US4.1] Add integration test for tenant isolation in `backend/tests/integration/tenant-isolation.spec.ts`

---

## Phase 4: User Story 1.1 - Company Onboarding & Founding Stock (Priority: P1)

**Goal**: Initialize company metadata and issue founding shares.

**Independent Test**: Successfully create a tenant and verify initial ledger entries.

### Tests for User Story 1.1

- [ ] T017 [P] [US1.1] Unit test for Tenant initialization in `backend/tests/unit/tenant-init.spec.ts`

### Implementation for User Story 1.1

- [ ] T018 [P] [US1.1] Implement `TenantController` in `backend/src/modules/tenant/tenant.controller.ts` for `/api/v1/tenants/init`
- [ ] T019 [US1.1] Implement `TenantService` in `backend/src/modules/tenant/tenant.service.ts` to handle metadata and initial ledger entries
- [ ] T020 [US1.1] Implement `LedgerService.recordIssuance()` in `backend/src/modules/ledger/ledger.service.ts` with hash-chaining
- [ ] T021 [US1.1] Create Company Onboarding form in `frontend/src/pages/admin/onboarding.tsx`

---

## Phase 5: User Story 1.2 - Equity Incentive Pool Management (Priority: P2)

**Goal**: Create and track option pool balances.

**Independent Test**: Create a pool and verify authorized/allocated/available balances.

### Implementation for User Story 1.2

- [ ] T022 [P] [US1.2] Implement `PoolController` in `backend/src/modules/security/pool.controller.ts` for `/api/v1/tenants/:tenantId/pools`
- [ ] T023 [US1.2] Implement `PoolService` in `backend/src/modules/security/pool.service.ts` for pool logic
- [ ] T024 [US1.2] Add pool balance calculation logic in `backend/src/modules/security/pool.service.ts` (Dynamic aggregate from Ledger)
- [ ] T025 [P] [US1.2] Create Pool Management view in `frontend/src/pages/admin/pools.tsx`

---

## Phase 6: User Story 1.3 - Issuing Grants (Priority: P1)

**Goal**: Grant options or restricted stock with vesting schedules.

**Independent Test**: Issue a grant and verify it appears in the ledger with correct vesting.

### Tests for User Story 1.3

- [ ] T026 [P] [US1.3] Unit test for vesting schedule calculation in `backend/tests/unit/vesting.spec.ts`
- [ ] T027 [US1.3] Integration test for grant issuance flow in `backend/tests/integration/grant-issuance.spec.ts`

### Implementation for User Story 1.3

- [ ] T028 [P] [US1.3] Implement `GrantController` in `backend/src/modules/security/grant.controller.ts` for `/api/v1/tenants/:tenantId/grants`
- [ ] T029 [US1.3] Implement `GrantService` in `backend/src/modules/security/grant.service.ts` to process grants and vesting
- [ ] T030 [US1.3] Implement background event queue for email notifications in `backend/src/modules/notifications/`
- [ ] [P] T031 [US1.3] Create Grant Issuance form in `frontend/src/pages/admin/grants/new.tsx`

---

## Phase 7: User Story 2.1 - Individual Stakeholder Dashboard (Priority: P1)

**Goal**: View personal equity progress and vesting timeline.

**Independent Test**: Log in as a holder and verify only personal data is visible.

### Implementation for User Story 2.1

- [ ] T032 [P] [US2.1] Implement `StakeholderController` in `backend/src/modules/stakeholder/stakeholder.controller.ts` for `/api/v1/stakeholders/me/summary`
- [ ] T033 [US2.1] Implement `StakeholderService` in `backend/src/modules/stakeholder/stakeholder.service.ts` to aggregate personal holdings
- [ ] T034 [P] [US2.1] Create Stakeholder Dashboard in `frontend/src/pages/holder/dashboard.tsx`
- [ ] T035 [US2.1] Implement Vesting Chart component in `frontend/src/components/VestingChart.tsx`

---

## Phase 8: User Story 2.2 - Simulating and Initiating Exercises (Priority: P2)

**Goal**: Stakeholders can request to exercise vested options.

**Independent Test**: Submit an exercise request and verify it appears in the admin queue.

### Implementation for User Story 2.2

- [ ] T036 [P] [US2.2] Implement exercise request endpoint in `backend/src/modules/stakeholder/stakeholder.controller.ts`
- [ ] T037 [US2.2] Implement `ExerciseService` in `backend/src/modules/security/exercise.service.ts` with tax warning logic
- [ ] T038 [P] [US2.2] Create Exercise Simulation UI in `frontend/src/pages/holder/exercise.tsx`
- [ ] T039 [US2.2] Create Admin Approval queue UI in `frontend/src/pages/admin/approvals.tsx`

---

## Phase 9: User Story 1.4 - Modeling & Closing a Funding Round (Priority: P2)

**Goal**: Simulate priced rounds and SAFE conversions.

**Independent Test**: Run a simulated round and verify post-money cap table preview.

### Implementation for User Story 1.4

- [ ] T040 [P] [US1.4] Implement round modeling logic in `backend/src/modules/security/round-modeling.service.ts`
- [ ] T041 [US1.4] Implement SAFE conversion engine (Valuation Cap/Discount) in `backend/src/modules/security/conversion-engine.ts`
- [ ] T042 [P] [US1.4] Create Round Modeling UI in `frontend/src/pages/admin/rounds/model.tsx`

---

## Phase 10: User Story 4.2 - As-Of-Date Historical Ledger Audit (Priority: P2)

**Goal**: Reconstruct cap table at any historical timestamp.

**Independent Test**: Run report for a past date and verify it matches the expected state.

### Implementation for User Story 4.2

- [ ] T043 [P] [US4.2] Implement historical report endpoint in `backend/src/modules/ledger/ledger.controller.ts`
- [ ] T044 [US4.2] Implement `LedgerService.reconstructAtDate()` in `backend/src/modules/ledger/ledger.service.ts`
- [ ] T045 [P] [US4.2] Create Audit Report view in `frontend/src/pages/admin/audit.tsx`
- [ ] T046 [US4.2] Implement PDF export service in `backend/src/modules/reports/pdf-export.service.ts`

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and verification

- [ ] T047 [P] Achieve 100% unit test coverage for `LedgerService.ts`
- [ ] T048 Perform final multi-tenancy penetration test in `backend/tests/security/`
- [ ] T049 [P] Run all validation scenarios in `specs/001-cap-table-saas/quickstart.md`
- [ ] T050 [P] Final documentation update for API v1 in `docs/api-v1.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** and **Foundational (Phase 2)** MUST be completed first.
- **US4.1 (Phase 3)** is the first priority as it secures the multi-tenant layer.
- **US1.1 (Phase 4)** initializes the first tenant.
- **US1.2 (Phase 5)** and **US1.3 (Phase 6)** follow to enable core equity features.
- **US2.1 (Phase 7)** and **US2.2 (Phase 8)** provide stakeholder value.
- **US1.4 (Phase 9)** and **US4.2 (Phase 10)** are advanced features to be completed last.

### Parallel Opportunities

- Once Phase 2 is complete, US4.1, US1.1, and US1.2 can technically start in parallel if needed.
- Frontend and Backend implementation tasks within a user story marked [P] can run in parallel.
- All tests marked [P] can run in parallel.

---

## Parallel Example: User Story 1.1
- T018 (Controller) and T021 (Frontend) can start simultaneously.
- T020 (Ledger Service) can be worked on in parallel with the controller if the interface is defined.
