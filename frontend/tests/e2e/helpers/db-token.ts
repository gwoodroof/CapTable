/**
 * Reads the email verification token directly from the PendingRegistration table.
 *
 * Used instead of polling maildrop.cc while the Postmark account is in sandbox mode
 * (sandbox mode restricts delivery to @getcaptable.com recipients only). Once the
 * Postmark account is fully approved, tests can switch to getVerificationLink() from
 * helpers/maildrop.ts to test the actual email-delivery path.
 */
import { Client } from 'pg';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function getVerificationLinkFromDb(
  email: string,
  { timeoutMs = 10_000, intervalMs = 500 } = {},
): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await client.query<{ token: string }>(
        'SELECT token FROM "PendingRegistration" WHERE email = $1',
        [email],
      );
      if (res.rows.length > 0) {
        return `${FRONTEND_URL}/auth/verify-email?token=${res.rows[0].token}`;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`No PendingRegistration record found for ${email} within ${timeoutMs}ms`);
  } finally {
    await client.end();
  }
}
