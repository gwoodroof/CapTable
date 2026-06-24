# Research Findings: Cap Table Management SaaS

## 1. Multi-Tenant Isolation & JWT Binding

### Decision
Use JWT custom claims for `tenant_id` combined with NestJS Interceptors and PostgreSQL Row-Level Security (RLS) for defense-in-depth.

### Rationale
- **JWT**: Binding `tenant_id` to the token prevents users from spoofing IDs in request bodies or params.
- **Middleware/Interceptor**: Automatically extracts `tenant_id` and attaches it to the request context (using `AsyncLocalStorage`).
- **Postgres RLS**: Provides a final safety net at the data layer, ensuring that even if a developer forgets a `WHERE` clause, the database will block cross-tenant access.

### Alternatives Considered
- **Shared DB with Query Filtering**: Easier to implement but higher risk of developer error leading to data leaks.

---

## 2. Immutable Ledger & Audit Trace

### Decision
Implement hash-chaining in the `ledger_transactions` table using a `previous_row_hash` column and SHA-256.

### Rationale
- **Integrity**: Ensures any modification to historical data is immediately detectable.
- **Auditability**: Provides a cryptographic proof of the transaction sequence, critical for legal and financial audits.

---

## 3. Data Precision (Financial Math)

### Decision
Use PostgreSQL `NUMERIC(24, 12)` for shares and `decimal.js` in the application layer.

### Rationale
- **Scale**: 12 decimal places handle edge cases like fractional shares in large rounds.
- **Library**: JavaScript's native `Number` is floating-point; `decimal.js` ensures arbitrary precision math.

---

## 4. Architectural Patterns

### Decision
NestJS with Domain-Driven Design (DDD) principles: Thin Controllers -> Domain Services -> Repository Pattern.

### Rationale
- **Isolation**: Keeps business logic (e.g., vesting calculations) separate from transport (API) and persistence (ORM).
- **Atomicity**: Complex transactions (like an option exercise) are managed within a single database transaction boundary in the service layer.
