# Quickstart Validation Guide: Cap Table SaaS

This guide provides end-to-end scenarios to validate the core functionality of the Cap Table SaaS.

## Scenario 1: New Company Setup & Initial Issuance
**Goal**: Verify tenant isolation and immutable ledger initialization.

1. **Setup**: Call `POST /api/v1/tenants/init` for "Company A".
2. **Action**: Call `POST /api/v1/tenants/:tenantA/grants` to issue 1M shares to "Founder 1".
3. **Verification**:
   - Query `GET /api/v1/tenants/:tenantA/ledger/report`.
   - **Expectation**: Ledger contains 1 entry (ISSUANCE). `chain_hash` is valid.
   - **Privacy Check**: Attempt to query `GET /api/v1/tenants/:tenantB/ledger/report` with Company A's token.
   - **Expectation**: `403 Forbidden`.

## Scenario 2: Option Exercise Workflow
**Goal**: Verify transactional atomicity and vesting logic.

1. **Prerequisite**: Grant 100k options to "Employee 1" with a schedule that has vested 25k.
2. **Action**: Call `POST /api/v1/stakeholders/me/exercises` for 10k shares as "Employee 1".
3. **Verification**:
   - Check `GET /api/v1/stakeholders/me/summary`.
   - **Expectation**: `exercisable` decreases to 15k (after admin approval). `total_shares` increases.
   - **Ledger Check**: Two new entries (EXERCISE of options, ISSUANCE of common stock).

## Scenario 3: Historical Audit
**Goal**: Verify dynamic cap table reconstruction.

1. **Prerequisite**: 10+ transactions over a 1-year period.
2. **Action**: Query `GET /api/v1/tenants/:tenantId/ledger/report?asOf=[Mid-Year Date]`.
3. **Verification**:
   - **Expectation**: The report matches the expected state at that specific timestamp, ignoring all transactions after the `asOf` date.
