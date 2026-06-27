# Cap Table Management SaaS

> Multi-tenant equity management platform with immutable ledger, strict multi-tenancy, and financial precision.

## 📋 Project Overview

CapTable is a SaaS platform for managing company equity. It enforces:

- **Immutable Ledger**: All equity events recorded in append-only transactions with cryptographic integrity
- **Strict Multi-Tenancy**: Row-level security and query-level tenant scoping at the database layer
- **Financial Precision**: Arbitrary-precision math using `decimal.js` to eliminate floating-point errors
- **RBAC**: Role-based access control (Admin, Investor, Stakeholder)
- **Row Level Security (RLS)**: Redundant layers of security to prevent data leakage
- **Auditability**: Complete transaction history suitable for compliance verification

## 🏗️ Architecture

### Backend (NestJS + PostgreSQL + Prisma)

### Frontend (Next.js + Tailwind CSS)

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