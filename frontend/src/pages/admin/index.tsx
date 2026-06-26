import { useEffect } from 'react';
import { useRouter } from 'next/router';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// Redirect /admin → /company/{tenantId} using the JWT's embedded tenantId,
// or fall back to /companies if no tenantId is available.
export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    const tenantId = payload?.tenantId as string | undefined;
    router.replace(tenantId ? `/company/${tenantId}` : '/companies');
  }, [router]);

  return null;
}
