import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function PiconLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M 145.9 165.5 A 80 80 0 0 1 54.1 165.5 L 77.1 132.8 A 40 40 0 0 0 122.9 132.8 Z" fill="#f0f4f8" />
      <path d="M 54.1 165.5 A 80 80 0 0 1 54.1 34.5 L 77.1 67.2 A 40 40 0 0 0 77.1 132.8 Z" fill="#f59e0b" />
      <path d="M 54.1 34.5 A 80 80 0 0 1 145.9 34.5 L 122.9 67.2 A 40 40 0 0 0 77.1 67.2 Z" fill="#0066cc" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  );
}

interface Company {
  id: string;
  name: string;
  authorizedShares: string;
  parValue: string;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNumber(val: string | number) {
  return Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function Companies() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openUserMenu() {
    if (userMenuCloseTimer.current) clearTimeout(userMenuCloseTimer.current);
    setUserMenuOpen(true);
  }

  function scheduleCloseUserMenu() {
    userMenuCloseTimer.current = setTimeout(() => setUserMenuOpen(false), 150);
  }

  // Create company modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', authorizedShares: '', parValue: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    if (!payload) { router.replace('/login'); return; }

    setEmail(payload.email as string);
    const headers = { Authorization: `Bearer ${token}` };
    const tenantId = payload.tenantId as string | undefined;

    fetch(`${API}/tenants`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCompanies(data);
        } else if (tenantId) {
          return fetch(`${API}/tenants/${tenantId}`, { headers }).then((r) => r.ok ? r.json() : null);
        }
      })
      .then((single) => {
        if (single && !Array.isArray(single)) {
          setCompanies([single]);
        }
      })
      .catch(() => setError('Failed to load companies'))
      .finally(() => setLoading(false));
  }, [router]);

  function signOut() {
    localStorage.removeItem('ct_token');
    router.push('/login');
  }

  async function selectCompany(id: string) {
    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    try {
      const res = await fetch(`${API}/auth/switch-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ct_token', data.token);
        const payload = decodeJwt(data.token);
        const dest = payload?.role === 'ADMIN' ? 'cap_table' : 'equity';
        router.push(`/company/${id}/${dest}`);
        return;
      }
    } catch {}
    router.push(`/company/${id}/equity`);
  }

  function openModal() {
    setForm({ name: '', authorizedShares: '', parValue: '' });
    setCreateError('');
    setShowModal(true);
  }

  function closeModal() {
    if (creating) return;
    setShowModal(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }

    const shares = Number(form.authorizedShares);
    const par = Number(form.parValue);
    if (!form.name.trim()) { setCreateError('Company name is required'); setCreating(false); return; }
    if (isNaN(shares) || shares <= 0) { setCreateError('Authorized shares must be a positive number'); setCreating(false); return; }
    if (isNaN(par) || par <= 0) { setCreateError('Par value must be a positive number'); setCreating(false); return; }

    try {
      const res = await fetch(`${API}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name.trim(), authorizedShares: form.authorizedShares, parValue: form.parValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.message || 'Failed to create company');
        return;
      }

      // Store the new JWT scoped to the new company, then navigate into it
      localStorage.setItem('ct_token', data.token);
      router.push(`/company/${data.tenant.id}/cap_table`);
    } catch {
      setCreateError('Could not connect to server');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Head>
        <title>My Companies — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        {/* Nav */}
        <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PiconLogo size={28} />
          <span style={{ fontWeight: 700, fontSize: '18px', color: 'white' }}>CapTable</span>
          <div
            ref={userMenuRef}
            onMouseEnter={openUserMenu}
            onMouseLeave={scheduleCloseUserMenu}
            style={{ marginLeft: 'auto', position: 'relative' }}
          >
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 500, fontFamily: "'Outfit', sans-serif", cursor: 'pointer', padding: '4px 0' }}
            >
              {email}
            </button>

            {userMenuOpen && (
              <div
                onMouseEnter={openUserMenu}
                onMouseLeave={scheduleCloseUserMenu}
                style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                minWidth: '180px',
                zIndex: 100,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <a
                  href="mailto:support@getcaptable.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', padding: '10px 16px', fontSize: '13px', color: '#94a3b8', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  Contact Support
                </a>
                <div style={{ borderTop: '1px solid #334155' }} />
                <button
                  onClick={signOut}
                  style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#94a3b8', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </nav>

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: '0 0 6px 0' }}>My Companies</h1>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>Companies where you hold a membership</p>
            </div>
            <button
              onClick={openModal}
              style={{ background: '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '10px 20px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
            >
              + Create Company
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569', fontSize: '15px' }}>Loading…</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#ff8a80', fontSize: '15px' }}>{error}</div>
          ) : companies.length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '64px 32px', textAlign: 'center' }}>
              <div style={{ color: '#334155', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <BuildingIcon />
              </div>
              <p style={{ fontWeight: 700, fontSize: '18px', color: 'white', margin: '0 0 8px 0' }}>No companies yet</p>
              <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 28px 0' }}>Create your first company to start managing your cap table.</p>
              <button
                onClick={openModal}
                style={{ background: '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '12px 24px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
              >
                Create your first company
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCompany(c.id)}
                  style={{ background: '#1e293b', border: '1px solid #334155', borderLeft: '4px solid #0066cc', borderRadius: '12px', padding: '28px 24px', textAlign: 'left', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0066cc')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px', color: '#0066cc', flexShrink: 0 }}>
                      <BuildingIcon />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '17px', color: 'white', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </p>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px 0' }}>Since {formatDate(c.createdAt)}</p>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 2px 0', fontWeight: 600 }}>Authorized</p>
                          <p style={{ fontSize: '15px', fontWeight: 700, color: '#0066cc', margin: 0 }}>{formatNumber(c.authorizedShares)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 2px 0', fontWeight: 600 }}>Par Value</p>
                          <p style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', margin: 0 }}>${Number(c.parValue).toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Company modal */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '480px' }}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '17px', color: 'white', margin: 0 }}>Create a new company</p>
                <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>You will be the Admin of this company.</p>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleCreate} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Company Name *</label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Authorized Shares *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.authorizedShares}
                    onChange={(e) => setForm((f) => ({ ...f, authorizedShares: e.target.value }))}
                    placeholder="e.g. 10000000"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Par Value *</label>
                  <input
                    required
                    type="number"
                    min="0.000001"
                    step="any"
                    value={form.parValue}
                    onChange={(e) => setForm((f) => ({ ...f, parValue: e.target.value }))}
                    placeholder="e.g. 0.0001"
                    style={inputStyle}
                  />
                </div>
              </div>

              {createError && (
                <div style={{ background: '#2a1215', border: '1px solid #5c2b2e', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ff8a80' }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  style={{ flex: 1, background: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '12px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: creating ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ flex: 2, background: creating ? '#004499' : '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '12px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: creating ? 'not-allowed' : 'pointer' }}
                >
                  {creating ? 'Creating…' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: 'white',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
};
