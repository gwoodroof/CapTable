import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../backend/.env.test') });

export default async function globalTeardown() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const usersRes = await client.query<{ id: string; tenantId: string }>(
      `SELECT id, "tenantId" FROM "User" WHERE email LIKE '%@maildrop.cc'`,
    );
    const tenantIds = usersRes.rows.map((r) => r.tenantId).filter(Boolean);

    if (tenantIds.length > 0) {
      const ids = tenantIds.map((_, i) => `$${i + 1}`).join(', ');
      // Delete in dependency order (deepest relations first)
      await client.query(`DELETE FROM "LedgerTransaction" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "Grant" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "Stakeholder" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "Security" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "VestingSchedule" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "EquityPool" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "CompanyMembership" WHERE "tenantId" IN (${ids})`, tenantIds);
      await client.query(`DELETE FROM "Tenant" WHERE id IN (${ids})`, tenantIds);
    }
    await client.query(`DELETE FROM "User" WHERE email LIKE '%@maildrop.cc'`);
    await client.query(`DELETE FROM "PendingRegistration" WHERE email LIKE '%@maildrop.cc'`);

    console.log(
      `[global-teardown] Cleaned up ${usersRes.rows.length} test user(s), ${tenantIds.length} tenant(s)`,
    );
  } finally {
    await client.end();
  }
}
