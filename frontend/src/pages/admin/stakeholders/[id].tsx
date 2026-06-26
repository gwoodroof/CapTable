import { useEffect } from 'react';
import { useRouter } from 'next/router';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// Redirect /admin/stakeholders/{id} → /company/{tenantId}/stakeholder/{id}
export default function StakeholderRedirect() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    const tenantId = payload?.tenantId as string | undefined;
    router.replace(tenantId ? `/company/${tenantId}/stakeholder/${id}` : '/companies');
  }, [id, router]);

  return null;
}
