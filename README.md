# Cap Table Management SaaS

> Multi-tenant equity management platform with immutable ledger, strict multi-tenancy, and financial precision.

## 📋 Project Overview

Cap Table is a production-grade SaaS platform for managing company equity. It enforces:

- **Immutable Ledger**: All equity events recorded in append-only transactions with cryptographic integrity
- **Strict Multi-Tenancy**: Row-level security and query-level tenant scoping at the database layer
- **Financial Precision**: Arbitrary-precision math using `decimal.js` to eliminate floating-point errors
- **RBAC**: Role-based access control (Admin, Investor, Stakeholder)
- **Auditability**: Complete transaction history suitable for compliance verification

## 🏗️ Architecture

### Backend (NestJS + PostgreSQL + Prisma)
```
backend/
├── src/
│   ├── modules/
│   │   ├── ledger/          # Core immutable transaction logic
│   │   ├── tenant/          # Company metadata & isolation
│   │   ├── stakeholder/     # Profiles & RBAC
│   │   └── security/        # Grants, pools, SAFEs
│   ├── common/
│   │   ├── auth/            # JWT + Passport
│   │   ├── middleware/      # Tenant isolation
│   │   ├── guards/          # RBAC enforcement
│   │   ├── utils/           # Precision math, audit trail
│   │   └── prisma/          # Database client
│   └── main.ts
├── prisma/
│   └── schema.prisma        # Data model with multi-tenancy
└── tests/

```

### Frontend (Next.js + Tailwind CSS + Brand Identity)
```
frontend/
├── src/
│   ├── pages/
│   │   ├── admin/           # Company admin views
│   │   ├── holder/          # Employee equity views
│   │   └── index.tsx        # Landing page
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Data fetching & state
│   ├── services/            # API clients
│   └── styles/              # Tailwind + brand colors
└── tests/
```

## 🌈 Brand Identity

**Colors** (from `BrandIdentity.html`):
- Primary Blue: `#0066cc`
- Accent Amber: `#f59e0b`
- Light Background: `#f0f4f8`
- Dark Background: `#0f172a`

**Domain**: `getcaptable.com`

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20.0.0
- PostgreSQL ≥ 14
- npm ≥ 10.0.0

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/captable.git
cd captable

# Install backend dependencies
cd backend
npm install
# Configure .env
cp .env.example .env
# Run database migrations
npm run prisma:migrate
# Start development server
npm run dev

# In another terminal, install frontend dependencies
cd ../frontend
npm install
# Start frontend
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

## 📚 API Documentation

All API endpoints require JWT Bearer token with `tenant_id` binding.

### Admin Endpoints

```bash
# Initialize tenant
POST /api/v1/tenants/init
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "name": "Acme Corp",
  "authorized_shares": "10000000",
  "par_value": "0.0001"
}

# Get historical report
GET /api/v1/tenants/:tenantId/ledger/report?asOf=2026-01-15

# Validate ledger chain
GET /api/v1/tenants/:tenantId/ledger/validate
```

### Stakeholder Endpoints

```bash
# Get personal equity summary
GET /api/v1/stakeholders/me/summary
Authorization: Bearer <JWT>
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov

# E2E tests (frontend)
npm run test:e2e
```

### Ledger Service Coverage

The `LedgerService` has 100% unit test coverage verifying:
- Share calculation precision
- Hash-chain integrity
- Tenant isolation
- Transaction atomicity

## 🔐 Security

### Multi-Tenancy Enforcement
1. **JWT Binding**: `tenant_id` is embedded in JWT and non-mutable
2. **Middleware**: `TenantInterceptor` validates JWT tenant matches route param
3. **Database**: All queries include mandatory `WHERE tenant_id = ?` filter
4. **Row-Level Security**: PostgreSQL RLS as final defense

### Data Precision
- All shares use `DECIMAL(24, 12)` in PostgreSQL
- All prices use `DECIMAL(20, 10)` in PostgreSQL
- Application-layer math via `decimal.js` for arbitrary precision
- Validation prevents precision-loss mutations

### Audit Trail
- Every ledger transaction includes SHA-256 hashes
- Hash-chaining ensures any tampering is detected
- `validateLedgerChain()` can verify entire history
- Timestamps in UTC for consistency

## 📖 Development Workflow

### Phase Completion Checklist

- [x] **Phase 1**: Setup Infrastructure (6 tasks)
- [x] **Phase 2**: Foundational (Ledger, Auth) (6 tasks)
- [ ] **Phase 3**: Multi-Tenant Isolation & Roles (4 tasks)
- [ ] **Phase 4**: Company Onboarding & Founding Stock (5 tasks)
- [ ] **Phase 5**: Equity Pool Management (4 tasks)
- [ ] **Phase 6**: Grant Issuance (6 tasks)
- [ ] **Phase 7**: Stakeholder Dashboard (4 tasks)
- [ ] **Phase 8**: Exercise Workflow (4 tasks)
- [ ] **Phase 9**: Funding Round Modeling (3 tasks)
- [ ] **Phase 10**: Historical Audit (4 tasks)
- [ ] **Phase 11**: Polish & Validation (4 tasks)

See `specs/001-cap-table-saas/tasks.md` for full task list.

## 📝 Constitution & Specification

- **Constitution**: `.specify/memory/constitution.md` - Governing principles
- **Specification**: `specs/001-cap-table-saas/spec.md` - User stories & requirements
- **Plan**: `specs/001-cap-table-saas/plan.md` - Technical architecture
- **Data Model**: `specs/001-cap-table-saas/data-model.md` - Schema & relationships
- **Contracts**: `specs/001-cap-table-saas/contracts/` - API specifications
- **Research**: `specs/001-cap-table-saas/research.md` - Technical decisions

## 🤝 Contributing

All contributions follow the project constitution:
1. Every change maps to a specification requirement
2. Tests written first (TDD)
3. 100% unit test coverage for ledger services
4. Code reviewed before merge
5. Multi-tenancy checks required in all PR reviews

## 📜 License

MIT © Cap Table Contributors
