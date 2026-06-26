import { useEffect } from 'react';
import { useRouter } from 'next/router';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// Redirect /admin/grants/new → /company/{tenantId}/grants/new
export default function GrantsRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    const tenantId = payload?.tenantId as string | undefined;
    router.replace(tenantId ? `/company/${tenantId}/grants/new` : '/companies');
  }, [router]);

  return null;
}
