# Implementation Plan: Cap Table Management SaaS

**Branch**: `001-cap-table-saas` | **Date**: 2026-06-23 | **Spec**: [specs/001-cap-table-saas/spec.md](spec.md)

**Input**: Feature specification from `/specs/001-cap-table-saas/spec.md`

## Summary

This plan defines the technical architecture for a multi-tenant Cap Table Management SaaS. It implements an immutable, append-only ledger for all equity transactions, ensuring 100% mathematical precision and strict data isolation between tenants. The system supports company onboarding, incentive pool management, grant issuance, funding round modeling, and stakeholder self-service.

## Technical Context

**Language/Version**: Node.js v20+, strict TypeScript.

**Primary Dependencies**: NestJS (Backend), Next.js (Frontend), Prisma (ORM), Zod (Validation), Passport.js (Auth).

**Storage**: PostgreSQL. Using `DECIMAL(20, 10)` for shares and `DECIMAL(20, 2)` for currency values.

**Testing**: Vitest for unit/integration tests, Playwright for E2E. Mandatory 100% coverage for ledger services.

**Target Platform**: Linux/Docker.

**Project Type**: Multi-tenant Web SaaS.

**Performance Goals**: <5s for historical cap table reconstruction (10k+ transactions).

**Constraints**: Strict multi-tenancy at the query level (tenant_id mandatory). Immutable ledger (no DELETE/UPDATE on transactions).

**Scale/Scope**: Initial MVP focusing on US-based legal entities and USD.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Precision (P1)**: All share/financial data uses `DECIMAL`. [PASSED]
- **Multi-Tenancy (P1)**: Data isolation enforced via mandatory `tenant_id` on all tables. [PASSED]
- **Immutable Ledger (P1)**: Transactions are append-only. [PASSED]
- **TDD Baseline (P1)**: 100% coverage required for `LedgerService`. [PASSED]
- **RBAC (P1)**: Explicit roles (Admin, Investor, Holder) enforced in middleware. [PASSED]

## Project Structure

### Documentation (this feature)

```text
specs/001-cap-table-saas/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   ├── ledger/      # Core immutable transaction logic
│   │   ├── tenant/      # Company metadata & isolation
│   │   ├── stakeholder/ # Profiles & RBAC
│   │   └── security/    # Grants, SAFEs, Stock classes
│   ├── common/          # Precision math, validation, middleware
│   └── main.ts
└── tests/

frontend/
├── src/
│   ├── components/      # UI components (Tailwind + Radix)
│   ├── hooks/           # Data fetching & state management
│   ├── pages/           # Admin/Stakeholder/Investor views
│   └── services/        # API clients
└── tests/
```

```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
