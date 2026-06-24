# API Contract: v1 (Cap Table SaaS)

## Authentication
All requests MUST include a Bearer JWT in the `Authorization` header.
The JWT MUST contain:
- `sub`: User ID
- `tenant_id`: Tenant ID
- `role`: User Role (ADMIN, INVESTOR, STAKEHOLDER)

---

## Admin Endpoints

### 1. Initialize Tenant
`POST /api/v1/tenants/init`
- **Role**: ADMIN
- **Body**:
  ```json
  {
    "name": "Acme Corp",
    "authorized_shares": "10000000",
    "par_value": "0.0001"
  }
  ```

### 2. Manage Option Pools
`POST /api/v1/tenants/:tenantId/pools`
- **Role**: ADMIN
- **Body**:
  ```json
  {
    "name": "2026 Equity Incentive Plan",
    "authorized_shares": "2000000"
  }
  ```

### 3. Issue Grants
`POST /api/v1/tenants/:tenantId/grants`
- **Role**: ADMIN
- **Body**:
  ```json
  {
    "stakeholder_id": "uuid",
    "security_type": "OPTION",
    "quantity": "50000",
    "strike_price": "0.50",
    "vesting_schedule_id": "uuid",
    "grant_date": "2026-06-23",
    "board_approval_date": "2026-06-20"
  }
  ```

---

## Stakeholder Endpoints

### 1. My Dashboard
`GET /api/v1/stakeholders/me/summary`
- **Role**: STAKEHOLDER
- **Response**:
  ```json
  {
    "total_shares": "150000",
    "vested": "50000",
    "unvested": "100000",
    "exercisable": "50000",
    "grants": [...]
  }
  ```

### 2. Initiate Exercise
`POST /api/v1/stakeholders/me/exercises`
- **Role**: STAKEHOLDER
- **Body**:
  ```json
  {
    "grant_id": "uuid",
    "quantity": "10000"
  }
  ```
- **Behavior**: Queues a request for Admin approval.

---

## Shared / Audit Endpoints

### 1. Historical Cap Table
`GET /api/v1/tenants/:tenantId/ledger/report?asOf=2025-01-01`
- **Role**: ADMIN, INVESTOR (Limited)
- **Response**: A dynamic reconstruction of the cap table at the specified date.
