import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StakeholderRoot() {
  const router = useRouter();
  const { companyId, stakeholderId } = router.query as { companyId?: string; stakeholderId?: string };
  useEffect(() => {
    if (companyId && stakeholderId) {
      router.replace(`/company/${companyId}/stakeholder/${stakeholderId}/equity`);
    }
  }, [companyId, stakeholderId, router]);
  return null;
}
