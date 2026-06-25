import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GoogleLogin } from '@react-oauth/google';

function PiconLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M 145.9 165.5 A 80 80 0 0 1 54.1 165.5 L 77.1 132.8 A 40 40 0 0 0 122.9 132.8 Z" fill="#f0f4f8" />
      <path d="M 54.1 165.5 A 80 80 0 0 1 54.1 34.5 L 77.1 67.2 A 40 40 0 0 0 77.1 132.8 Z" fill="#f59e0b" />
      <path d="M 54.1 34.5 A 80 80 0 0 1 145.9 34.5 L 122.9 67.2 A 40 40 0 0 0 77.1 67.2 Z" fill="#0066cc" />
    </svg>
  );
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Sign in failed');
        return;
      }
      localStorage.setItem('ct_token', data.token);
      router.push('/admin');
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Google sign-in failed');
        return;
      }
      if (data.isNew) {
        sessionStorage.setItem('google_credential', credential);
        router.push('/signup?mode=google');
      } else {
        localStorage.setItem('ct_token', data.token);
        router.push('/admin');
      }
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign In — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
        {/* Nav */}
        <nav style={{ padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e293b' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <PiconLogo size={30} />
            <span style={{ fontWeight: 700, fontSize: '18px', color: 'white' }}>CapTable</span>
          </a>
        </nav>

        {/* Form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '28px', color: 'white', margin: '0 0 8px 0' }}>Welcome back</h1>
            <p style={{ fontSize: '15px', color: '#64748b', margin: '0 0 32px 0' }}>
              No account yet?{' '}
              <a href="/signup" style={{ color: '#0066cc', textDecoration: 'none' }}>Sign up free</a>
            </p>

            {/* Google SSO */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={(res) => handleGoogleSuccess(res.credential!)}
                  onError={() => setError('Google sign-in failed')}
                  theme="filled_black"
                  shape="rectangular"
                  size="large"
                  width="440"
                  text="continue_with"
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
              <span style={{ fontSize: '13px', color: '#475569' }}>or sign in with email</span>
              <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="you@company.com"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Your password"
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ background: '#2a1215', border: '1px solid #5c2b2e', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ff8a80' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ background: loading ? '#004499' : '#0066cc', color: 'white', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '15px',
  color: 'white',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
};
