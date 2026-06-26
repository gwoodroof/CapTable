/**
 * User Story 4.1 — Multi-tenant isolation
 *
 * Pure API tests (no browser navigation). Creates two separate tenants via the full
 * signup + verification flow and verifies that Tenant A's JWT cannot access Tenant B's data.
 */
import { test, expect } from '@playwright/test';
import { uniqueMailbox, maildropAddress } from '../helpers/maildrop';
import { getVerificationLinkFromDb } from '../helpers/db-token';

const API = 'http://localhost:3001/api/v1';

async function createTenantViaApi(
  request: import('@playwright/test').APIRequestContext,
  companyName: string,
): Promise<{ token: string; tenantId: string }> {
  const email = maildropAddress(uniqueMailbox());

  const regRes = await request.post(`${API}/auth/register`, {
    data: { email, password: 'IsoTest1!', companyName },
  });
  expect(regRes.status()).toBe(202);

  const verifyUrl = await getVerificationLinkFromDb(email);

  // getVerificationLinkFromDb returns the FRONTEND URL (JS redirect, no HTTP 302).
  // Extract the pending token and call the BACKEND verify endpoint directly so we can
  // capture the JWT from the 302 Location header.
  const pendingToken = new URL(verifyUrl).searchParams.get('token');
  const verifyRes = await request.get(`${API}/auth/verify-email?token=${pendingToken}`, {
    maxRedirects: 0,
  });
  // Backend returns 302 with Location: .../auth/verified?token=<jwt>
  const location = verifyRes.headers()['location'] ?? '';
  const tokenMatch = location.match(/[?&]token=([^&]+)/);
  if (!tokenMatch) {
    throw new Error(`No token in Location header after verification. Location: ${location}`);
  }
  const token = tokenMatch[1];
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

  return { token, tenantId: payload.tenantId };
}

test.describe('User Story 4.1 — Multi-tenant isolation', () => {
  test("Tenant A's JWT is rejected when accessing Tenant B's tenant endpoint", async ({ request }) => {
    const [a, b] = await Promise.all([
      createTenantViaApi(request, 'Isolation Corp A'),
      createTenantViaApi(request, 'Isolation Corp B'),
    ]);

    const crossRes = await request.get(`${API}/tenants/${b.tenantId}`, {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    expect(crossRes.status()).toBe(403);
  });

  test("Tenant A's JWT is rejected when accessing Tenant B's stakeholders", async ({ request }) => {
    const [a, b] = await Promise.all([
      createTenantViaApi(request, 'Isolation Corp C'),
      createTenantViaApi(request, 'Isolation Corp D'),
    ]);

    const crossRes = await request.get(`${API}/tenants/${b.tenantId}/stakeholders`, {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    expect(crossRes.status()).toBe(403);
  });

  test("Tenant A's JWT is rejected when accessing Tenant B's ledger", async ({ request }) => {
    const [a, b] = await Promise.all([
      createTenantViaApi(request, 'Isolation Corp E'),
      createTenantViaApi(request, 'Isolation Corp F'),
    ]);

    const crossRes = await request.get(`${API}/ledger/${b.tenantId}/report`, {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    expect(crossRes.status()).toBe(403);
  });
});
