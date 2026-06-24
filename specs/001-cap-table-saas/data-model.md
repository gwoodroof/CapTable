# Data Model: Cap Table Management SaaS

## Overview
The system uses a relational PostgreSQL schema with a focus on an append-only ledger for all equity-altering events. Strict multi-tenancy is enforced via a `tenant_id` on every table.

## Core Entities

### Tenants
Stores company metadata.
- `id`: UUID (Primary Key)
- `name`: String
- `authorized_shares`: NUMERIC(24, 12)
- `par_value`: NUMERIC(20, 10)
- `created_at`: Timestamp

### Users
Identity management.
- `id`: UUID (PK)
- `email`: String (Unique)
- `role`: Enum (ADMIN, INVESTOR, STAKEHOLDER)
- `tenant_id`: UUID (FK to Tenants)

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
- **Tenant Isolation**: Every query MUST include `WHERE tenant_id = current_tenant_id`.
- **Atomic Transactions**: Complex operations (e.g., EXERCISE) must run in a single DB transaction:
  1. Check vested amount from Ledger.
  2. Record EXERCISE in Ledger (reduces option balance).
  3. Record ISSUANCE in Ledger (increases common stock balance).
- **Constraints**:
  - `ledger_transactions` is append-only (No DELETE/UPDATE).
  - Foreign keys ensure all transactions map to valid stakeholders and securities.
