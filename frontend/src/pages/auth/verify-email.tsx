import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function VerifyEmail() {
  const router = useRouter();

  useEffect(() => {
    const { token } = router.query;
    if (typeof token === 'string' && token) {
      // Navigate the browser to the backend endpoint, which verifies the token
      // and redirects back to /auth/verified?token=<jwt>.
      window.location.href = `${API}/auth/verify-email?token=${token}`;
    }
  }, [router.query]);

  return (
    <>
      <Head>
        <title>Verifying your email… — CapTable</title>
      </Head>
      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '15px' }}>Verifying your email…</p>
      </div>
    </>
  );
}
