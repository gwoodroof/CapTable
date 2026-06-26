-- PostgreSQL Row-Level Security: defence-in-depth for all tenant-scoped data tables.
-- Apply after `prisma db push` with: psql $DATABASE_URL -f prisma/rls.sql
-- Safe to re-run (DROP POLICY IF EXISTS before CREATE).

-- ============================================================
-- Stakeholder
-- ============================================================
ALTER TABLE "Stakeholder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stakeholder" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stakeholder_tenant ON "Stakeholder";
CREATE POLICY stakeholder_tenant ON "Stakeholder"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- Security
-- ============================================================
ALTER TABLE "Security" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Security" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_tenant ON "Security";
CREATE POLICY security_tenant ON "Security"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- EquityPool
-- ============================================================
ALTER TABLE "EquityPool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquityPool" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equitypool_tenant ON "EquityPool";
CREATE POLICY equitypool_tenant ON "EquityPool"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- VestingSchedule
-- ============================================================
ALTER TABLE "VestingSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VestingSchedule" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vestingschedule_tenant ON "VestingSchedule";
CREATE POLICY vestingschedule_tenant ON "VestingSchedule"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- Grant
-- ============================================================
ALTER TABLE "Grant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Grant" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_tenant ON "Grant";
CREATE POLICY grant_tenant ON "Grant"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- LedgerTransaction
-- ============================================================
ALTER TABLE "LedgerTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerTransaction" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_tenant ON "LedgerTransaction";
CREATE POLICY ledger_tenant ON "LedgerTransaction"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
