# Data Model: Cap Table Management SaaS

## Overview
The system uses a relational PostgreSQL schema with a focus on an append-only ledger for all equity-altering events. Strict multi-tenancy is enforced via a `tenant_id` on every table.

## Core Entities

### Tenants
Stores company metadata.
- `id`: UUID (Primary Key)
- `name`: String — not unique; two tenants may share the same display name. Identity is always by `id`.
- `website`: String (Nullable) — optional company website URL.
- `icon_url`: String (Nullable) — optional URL to a square company icon, displayed at 28×28px in the nav bar.
- `authorized_shares`: NUMERIC(24, 12)
- `par_value`: NUMERIC(20, 10)
- `created_at`: Timestamp

### Users
Authenticated identities. NOT tied to a single tenant — company membership and role are tracked via `CompanyMembership`.
- `id`: UUID (PK)
- `email`: String (Unique)
- `email_verified`: Boolean
- `password_hash`: String (Nullable — null for Google SSO users)
- `created_at`: Timestamp

### CompanyMembership
Join table linking a User to a Tenant with a per-company role.
- `id`: UUID (PK)
- `user_id`: UUID (FK to Users)
- `tenant_id`: UUID (FK to Tenants)
- `role`: Enum (ADMIN, STAKEHOLDER)
- `created_at`: Timestamp
- UNIQUE constraint on (`user_id`, `tenant_id`)

### CompanyInvitation
Pending and historical invitations to join a company.
- `id`: UUID (PK)
- `tenant_id`: UUID (FK to Tenants)
- `invitee_email`: String
- `token`: String (Unique, 32-byte hex, 7-day TTL)
- `status`: Enum (PENDING, ACCEPTED, EXPIRED)
- `expires_at`: Timestamp
- `created_at`: Timestamp
- UNIQUE constraint on (`tenant_id`, `invitee_email`) where `status = PENDING` (enforced via partial index)

### Stakeholders
Profiles of equity holders (can be individuals or entities).
- `id`: UUID (PK)
- `name`: String
- `email`: String (Nullable)
- `type`: Enum (INDIVIDUAL, ENTITY)
- `tenant_id`: UUID (FK to Tenants)

### Equity Pools
Allocations for employee stock options.
- `id`: UUID (PK)
- `name`: String
- `authorized_shares`: NUMERIC(24, 12)
- `tenant_id`: UUID (FK to Tenants)

### Securities
Definitions of equity instruments.
- `id`: UUID (PK)
- `type`: Enum (COMMON_STOCK, PREFERRED_STOCK, OPTION, SAFE)
- `tenant_id`: UUID (FK to Tenants)

### Vesting Schedules
Templates for releasing shares over time.
- `id`: UUID (PK)
- `name`: String
- `cliff_months`: Integer
- `vesting_duration_months`: Integer
- `vesting_frequency`: Enum (MONTHLY, QUARTERLY, ANNUALLY)
- `tenant_id`: UUID (FK to Tenants)

---

## The Ledger (Source of Truth)

### Ledger Transactions
Every equity event MUST be recorded here.
- `id`: UUID (PK)
- `tenant_id`: UUID (FK to Tenants)
- `transaction_type`: Enum (ISSUANCE, TRANSFER, VEST, EXERCISE, CANCELLATION)
- `stakeholder_id`: UUID (FK to Stakeholders)
- `security_id`: UUID (FK to Securities)
- `quantity`: NUMERIC(24, 12)
- `price_per_share`: NUMERIC(20, 10) (Nullable)
- `timestamp`: Timestamp (UTC)
- `data_hash`: TEXT (SHA-256 of row data)
- `previous_row_hash`: TEXT (Hash of the previous entry for this tenant)
- `chain_hash`: TEXT (SHA-256 of data_hash + previous_row_hash)

---

## Relational Integrity & Multi-Tenancy
- **Tenant Isolation**: Every query MUST include `WHERE tenant_id = current_tenant_id`. The tenant ID is resolved from the authenticated user's `CompanyMembership` for the requested company, not from a field on the `User` record.
- **Invitation Gate**: Before inserting a `LedgerTransaction` for a stakeholder, the backend MUST verify that a `CompanyInvitation` with status `ACCEPTED` (or at minimum `PENDING`) exists for that stakeholder's email in the same `tenant_id`.
- **Atomic Transactions**: Complex operations (e.g., EXERCISE) must run in a single DB transaction:
  1. Check vested amount from Ledger.
  2. Record EXERCISE in Ledger (reduces option balance).
  3. Record ISSUANCE in Ledger (increases common stock balance).
- **Constraints**:
  - `ledger_transactions` is append-only (No DELETE/UPDATE).
  - Foreign keys ensure all transactions map to valid stakeholders and securities.
