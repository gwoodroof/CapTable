import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Verified() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { token } = router.query;
    if (typeof token === 'string' && token) {
      localStorage.setItem('ct_token', token);
      router.replace('/companies');
    }
  }, [router.isReady, router.query, router]);

  return (
    <>
      <Head>
        <title>Verifying… — CapTable</title>
      </Head>
      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '15px' }}>Verifying your email…</p>
      </div>
    </>
  );
}
