import { useEffect } from 'react';
import { useRouter } from 'next/router';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function CompanyRoot() {
  const router = useRouter();
  const { companyId } = router.query as { companyId?: string };
  useEffect(() => {
    if (!companyId) return;
    const token = localStorage.getItem('ct_token');
    const payload = token ? decodeJwt(token) : null;
    const target = payload?.role === 'ADMIN' ? 'cap_table' : 'equity';
    router.replace(`/company/${companyId}/${target}`);
  }, [companyId, router]);
  return null;
}
