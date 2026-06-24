<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles: 
- User and Equity Accuracy (expanded for Data Precision)
- Data Safety and Compliance (expanded for Multi-Tenancy and RBAC)
- Incremental Delivery with Test Evidence (expanded for TDD and 100% Coverage)
Added sections: 
- Core Philosophy & System Archetype (Immutable Ledger, Multi-Tenancy)
- Architectural Intent & Tech Stack (Domain Isolation, RBAC)
- Technical Standards (Naming, Validation, Library Governance)
Removed sections: none
Templates reviewed:
- .specify/templates/plan-template.md ✅ reviewed
- .specify/templates/spec-template.md ✅ reviewed
- .specify/templates/tasks-template.md ✅ reviewed
Follow-up TODOs: none
-->

# CapTable Constitution

This document serves as the absolute source of truth for all downstream engineering, architectural constraints, and code generation for the Cap Table Management SaaS.

## Core Principles

### 1. User and Equity Accuracy & Data Precision
Every ownership record, transaction, and cap table calculation MUST be precise, auditable, and reconciled before publication.
- **Data Precision:** All financial numbers, stock quantities, and strike prices MUST use precise data types (e.g., Decimal, BigInt) to avoid floating-point issues.
- All financial and ownership data MUST be validated against source documents.
- Mistakes in equity positions are treated as critical defects.

### 2. Data Safety, Multi-Tenancy & RBAC
Ownership data MUST be protected by enforcement of least privilege, secure storage, and compliance-ready auditability.
- **Strict Multi-Tenancy:** Data isolation between different company accounts MUST be enforced at the data layer to prevent horizontal privilege escalation.
- **Role-Based Access Control (RBAC):** A strict permission hierarchy MUST be enforced:
  - **Company Admins/Legal Counsel:** Full Read/Write.
  - **Investors:** Aggregate overview + explicit fund holdings only.
  - **Employees/Option Holders:** View-only access strictly limited to their own individual grants.
- Sensitive shareholder, issuance, and valuation data MUST be encrypted at rest and in transit.

### 3. Incremental Delivery with TDD Baseline
Work MUST be delivered in small, independently verifiable increments with 100% test evidence for ledger-altering transactions.
- **TDD Baseline:** Every ledger-altering transaction service MUST have 100% unit test coverage, explicitly checking for mathematical precision and regressions.
- Each feature slice MUST include a clear test plan and failing tests before implementation.
- User stories MUST be shippable independently and validated with acceptance criteria.

### 4. Clear Contracts & Validation-First
Interfaces, data models, and business rules MUST be explicit, versioned, and traceable.
- **Validation-First:** All incoming payloads MUST pass strict validation (schema and business logic) before any processing occurs.
- Every change MUST map to a user scenario or requirement statement.
- Contracts between components MUST be documented and enforced through tests or schema validation.

### 5. Simple, Maintainable Product Experience
We MUST minimize unnecessary complexity and prioritize clarity for users and maintainers.
- Solutions MUST favor understandable workflows over clever optimizations.
- Technical decisions MUST be justified by measurable value or reduced operational risk.

## Core Philosophy & System Archetype
- **Security-First & Audit-Ready:** The system deals with sensitive financial and legal equity data. Security, privacy, and precision are non-negotiable.
- **Immutable Ledger Design:** All transactions (issuances, grants, vests, exercises, cancellations) MUST be handled via an append-only transaction ledger pattern. Direct mutations of historical equity records are strictly forbidden.

## Architectural Intent & Tech Stack
- **Backend Architecture:** Backend logic MUST be restricted to a clear, isolated service/domain layer. API controllers/handlers MUST be kept light.
- **Library & Dependency Governance:** Third-party libraries MUST be limited to verified, maintained packages for critical functions (e.g., math extensions, auth, encryption).
- **Banned Practices:** 
  - Inline raw database queries in UI components.
  - Manual parsing of sensitive JWTs without library verification.

## Technical Standards
- **Naming Conventions:**
  - `camelCase` for JSON keys and transport objects.
  - `PascalCase` for structural classes and models.
  - Descriptive naming for transaction types (e.g., `IssueStockTransaction`, `ExecuteOptionExercise`).
- **Auditability:** All record modifications MUST preserve a traceable history suitable for compliance verification.

## Governance
This constitution is the source of truth for project practices, and it supersedes informal conventions where they conflict.
- Amendments to this document MUST be documented, reviewed, and versioned.
- Changes to the constitution MUST include a short rationale, the impacted sections, and any follow-up tasks.
- The constitution MUST be revisited whenever project goals, compliance needs, or risk posture change substantially.

**Version**: 1.1.0 | **Ratified**: 2026-06-23 | **Last Amended**: 2026-06-23
