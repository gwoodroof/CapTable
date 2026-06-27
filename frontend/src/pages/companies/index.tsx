import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AlphaBadge from '../../components/AlphaBadge';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const RELEASE_NOTES_SHEET_ID = '1Ht3pQQUXwt7-r0PY1G0Xdxobb-baFWO3yayC_l8nFsU';

interface ReleaseNote {
  date: string;
  notes: string;
}

function cellStr(cell: { v?: unknown; f?: string } | null | undefined): string {
  if (!cell) return '';
  if (typeof cell.f === 'string') return cell.f;
  if (typeof cell.v === 'string') return cell.v;
  return '';
}

async function fetchReleaseNotesFromSheet(): Promise<ReleaseNote[]> {
  const url = `https://docs.google.com/spreadsheets/d/${RELEASE_NOTES_SHEET_ID}/gviz/tq?tqx=out:json`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(jsonStr);
  return (data.table?.rows ?? [])
    .map((row: { c: Array<{ v?: unknown; f?: string } | null> }) => ({
      date: cellStr(row.c?.[0]),
      notes: cellStr(row.c?.[1]),
    }))
    .filter((r: ReleaseNote) => r.date || r.notes);
}

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
  iconUrl?: string | null;
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
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[] | null>(null);
  const [releaseNotesLoading, setReleaseNotesLoading] = useState(false);
  const [releaseNotesError, setReleaseNotesError] = useState('');
  const [userInfoOpen, setUserInfoOpen] = useState(false);
  const [userInfoName, setUserInfoName] = useState('');
  const [userInfoEmail, setUserInfoEmail] = useState('');
  const [userInfoSaving, setUserInfoSaving] = useState(false);
  const [userInfoError, setUserInfoError] = useState('');
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
  const [form, setForm] = useState({ name: '', authorizedShares: '10000000', parValue: '0.0001' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState<'shares' | 'par' | null>(null);

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

    setDisplayName((payload.name as string) || (payload.email as string));
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

  function openReleaseNotes() {
    setUserMenuOpen(false);
    setReleaseNotesOpen(true);
    if (releaseNotes !== null) return;
    setReleaseNotesLoading(true);
    setReleaseNotesError('');
    fetchReleaseNotesFromSheet()
      .then(setReleaseNotes)
      .catch(() => setReleaseNotesError('Failed to load release notes.'))
      .finally(() => setReleaseNotesLoading(false));
  }

  function signOut() {
    localStorage.removeItem('ct_token');
    router.push('/login');
  }

  function openUserInfo() {
    setUserMenuOpen(false);
    const token = localStorage.getItem('ct_token');
    if (token) {
      try {
        const payload = decodeJwt(token);
        setUserInfoName((payload?.name as string) ?? '');
        setUserInfoEmail((payload?.email as string) ?? '');
      } catch {}
    }
    setUserInfoError('');
    setUserInfoOpen(true);
  }

  async function saveUserInfo(e: React.FormEvent) {
    e.preventDefault();
    setUserInfoSaving(true);
    setUserInfoError('');
    const token = localStorage.getItem('ct_token');
    if (!token) { setUserInfoSaving(false); return; }
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: userInfoName }),
      });
      const data = await res.json();
      if (!res.ok) { setUserInfoError(data.message || 'Failed to update profile'); return; }
      localStorage.setItem('ct_token', data.token);
      const updated = decodeJwt(data.token);
      if (updated) setDisplayName((updated.name as string) || (updated.email as string));
      setUserInfoOpen(false);
    } catch {
      setUserInfoError('Could not connect to server');
    } finally {
      setUserInfoSaving(false);
    }
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
    setForm({ name: '', authorizedShares: '10000000', parValue: '0.0001' });
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
          <AlphaBadge />
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
              {displayName}
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
                <button
                  onClick={openUserInfo}
                  data-testid="user-info-menu-item"
                  style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#94a3b8', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  User Info
                </button>
                <div style={{ borderTop: '1px solid #334155' }} />
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
                  onClick={openReleaseNotes}
                  data-testid="release-notes-menu-item"
                  style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#94a3b8', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  Release Notes
                </button>
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
                    {c.iconUrl ? (
                      <img
                        src={c.iconUrl}
                        alt={`${c.name} icon`}
                        width={42}
                        height={42}
                        style={{ borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#0066cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'white', flexShrink: 0, userSelect: 'none' }}>
                        {c.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
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

      {/* User Info modal */}
      {userInfoOpen && (
        <div
          data-testid="user-info-backdrop"
          onClick={() => !userInfoSaving && setUserInfoOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif" }}
        >
          <div
            data-testid="user-info-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', width: '420px', maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #334155' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'white' }}>User Info</h2>
              <button
                data-testid="user-info-close"
                onClick={() => !userInfoSaving && setUserInfoOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: "'Outfit', sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
              >×</button>
            </div>
            <form onSubmit={saveUserInfo} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={userInfoLabelStyle}>Email</label>
                <input
                  type="email"
                  value={userInfoEmail}
                  readOnly
                  data-testid="user-info-email"
                  style={{ ...userInfoInputStyle, color: '#64748b', cursor: 'default' }}
                />
              </div>
              <div>
                <label style={userInfoLabelStyle}>Display Name</label>
                <input
                  type="text"
                  value={userInfoName}
                  onChange={(e) => setUserInfoName(e.target.value)}
                  placeholder="First Last"
                  data-testid="user-info-name"
                  style={userInfoInputStyle}
                  autoFocus
                />
              </div>
              {userInfoError && (
                <div style={{ background: '#2a1215', border: '1px solid #5c2b2e', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ff8a80' }}>
                  {userInfoError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => !userInfoSaving && setUserInfoOpen(false)}
                  disabled={userInfoSaving}
                  style={{ flex: 1, background: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '10px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: userInfoSaving ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userInfoSaving}
                  data-testid="user-info-save"
                  style={{ flex: 2, background: userInfoSaving ? '#004499' : '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: userInfoSaving ? 'not-allowed' : 'pointer' }}
                >
                  {userInfoSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Notes modal */}
      {releaseNotesOpen && (
        <div
          data-testid="release-notes-backdrop"
          onClick={() => setReleaseNotesOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif" }}
        >
          <div
            data-testid="release-notes-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', width: '560px', maxWidth: '90vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'white' }}>Release Notes</h2>
              <button
                data-testid="release-notes-close"
                onClick={() => setReleaseNotesOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: "'Outfit', sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
              >×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 24px 24px' }}>
              {releaseNotesLoading && <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 }}>Loading…</p>}
              {releaseNotesError && <p style={{ color: '#ff8a80', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 }}>{releaseNotesError}</p>}
              {releaseNotes && releaseNotes.length === 0 && <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 }}>No release notes yet.</p>}
              {releaseNotes && releaseNotes.map((item, i) => (
                <div key={i} style={{ padding: '16px 0', borderBottom: i < releaseNotes.length - 1 ? '1px solid #0f172a' : 'none' }}>
                  <p style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, margin: '0 0 6px 0' }}>{item.date}</p>
                  <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>Authorized Shares *</span>
                    <div
                      data-tooltip="shares"
                      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={() => setTooltipVisible('shares')}
                      onMouseLeave={() => setTooltipVisible(null)}
                    >
                      <InfoIcon />
                      {tooltipVisible === 'shares' && (
                        <div style={tooltipStyle}>
                          The total number of shares a company is legally permitted to issue. Most early-stage startups authorize <strong>10,000,000 shares</strong> — this gives flexibility to issue stock to founders, employees, and investors without revisiting the cap table structure too soon.
                        </div>
                      )}
                    </div>
                  </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>Par Value *</span>
                    <div
                      data-tooltip="par"
                      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={() => setTooltipVisible('par')}
                      onMouseLeave={() => setTooltipVisible(null)}
                    >
                      <InfoIcon />
                      {tooltipVisible === 'par' && (
                        <div style={{ ...tooltipStyle, right: 0, left: 'auto' }}>
                          The nominal minimum price per share set in the company&apos;s charter. Most startups use <strong>$0.0001</strong> — a very low value that keeps Delaware franchise taxes minimal while satisfying legal requirements.
                        </div>
                      )}
                    </div>
                  </div>
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

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  left: 0,
  zIndex: 100,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '12px',
  color: '#cbd5e1',
  lineHeight: '1.5',
  width: '220px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  pointerEvents: 'none',
};

const userInfoLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const userInfoInputStyle: React.CSSProperties = {
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

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'help', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
