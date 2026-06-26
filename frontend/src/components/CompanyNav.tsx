import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const RELEASE_NOTES_SHEET_ID = '1Ht3pQQUXwt7-r0PY1G0Xdxobb-baFWO3yayC_l8nFsU';

function PiconLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M 145.9 165.5 A 80 80 0 0 1 54.1 165.5 L 77.1 132.8 A 40 40 0 0 0 122.9 132.8 Z" fill="#f0f4f8" />
      <path d="M 54.1 165.5 A 80 80 0 0 1 54.1 34.5 L 77.1 67.2 A 40 40 0 0 0 77.1 132.8 Z" fill="#f59e0b" />
      <path d="M 54.1 34.5 A 80 80 0 0 1 145.9 34.5 L 122.9 67.2 A 40 40 0 0 0 77.1 67.2 Z" fill="#0066cc" />
    </svg>
  );
}

interface Company {
  id: string;
  name: string;
  iconUrl?: string | null;
}

interface ReleaseNote {
  date: string;
  notes: string;
}

interface Props {
  companyId: string;
  companyName?: string;
  email: string;
  subtitle?: string;
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

export default function CompanyNav({ companyId, companyName, email, subtitle }: Props) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[] | null>(null);
  const [releaseNotesLoading, setReleaseNotesLoading] = useState(false);
  const [releaseNotesError, setReleaseNotesError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ct_token');
    if (!token) return;
    fetch(`${API}/tenants`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setCompanies(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  function openUserMenu() {
    if (userMenuCloseTimer.current) clearTimeout(userMenuCloseTimer.current);
    setUserMenuOpen(true);
  }

  function scheduleCloseUserMenu() {
    userMenuCloseTimer.current = setTimeout(() => setUserMenuOpen(false), 150);
  }

  async function switchCompany(id: string) {
    setOpen(false);
    if (id === companyId) return;
    const token = localStorage.getItem('ct_token');
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch(`${API}/auth/switch-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ct_token', data.token);
        const payload: Record<string, unknown> | null = (() => {
          try { return JSON.parse(atob(data.token.split('.')[1])); } catch { return null; }
        })();
        const dest = payload?.role === 'ADMIN' ? 'cap_table' : 'equity';
        router.push(`/company/${id}/${dest}`);
        return;
      }
    } catch {}
    router.push(`/company/${id}/equity`);
  }

  function signOut() {
    localStorage.removeItem('ct_token');
    router.push('/login');
  }

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

  function closeReleaseNotes() {
    setReleaseNotesOpen(false);
  }

  const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    fontSize: '13px',
    color: '#94a3b8',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
  };

  return (
    <>
      <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: "'Outfit', sans-serif" }}>
        <PiconLogo size={28} />
        <button
          onClick={() => router.push('/companies')}
          style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '14px', fontFamily: "'Outfit', sans-serif", cursor: 'pointer', padding: 0 }}
        >
          My Companies
        </button>
        <span style={{ color: '#334155' }}>/</span>

        {/* Company switcher dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              background: open ? '#1e293b' : 'transparent',
              border: open ? '1px solid #334155' : '1px solid transparent',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
              cursor: 'pointer',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {companyName || companies.find((c) => c.id === companyId)?.name || '…'}
            <span style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>▾</span>
          </button>

          {open && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                minWidth: '220px',
                zIndex: 100,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {companies.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>Loading…</div>
              ) : (
                companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => switchCompany(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: c.id === companyId ? '#0f172a' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      padding: '10px 16px',
                      fontSize: '13px',
                      color: c.id === companyId ? '#0066cc' : '#94a3b8',
                      fontFamily: "'Outfit', sans-serif",
                      cursor: 'pointer',
                      fontWeight: c.id === companyId ? 700 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (c.id !== companyId) e.currentTarget.style.background = '#0f172a';
                    }}
                    onMouseLeave={(e) => {
                      if (c.id !== companyId) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.id === companyId && <span style={{ fontSize: '11px', flexShrink: 0, marginLeft: '8px' }}>✓</span>}
                  </button>
                ))
              )}
              <div style={{ borderTop: '1px solid #334155', padding: '4px' }}>
                <button
                  onClick={() => { setOpen(false); router.push('/companies'); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#475569',
                    fontFamily: "'Outfit', sans-serif",
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; }}
                >
                  + All companies
                </button>
              </div>
            </div>
          )}
        </div>

        {(() => {
          const company = companies.find((c) => c.id === companyId);
          const icon = company?.iconUrl;
          const displayName = companyName || company?.name || '';
          const initial = displayName.trim().charAt(0).toUpperCase();
          if (icon) {
            return (
              <img
                src={icon}
                alt="Company icon"
                width={28}
                height={28}
                style={{ borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
              />
            );
          }
          if (initial) {
            return (
              <div
                data-testid="company-monogram"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  background: '#0066cc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'white',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {initial}
              </div>
            );
          }
          return null;
        })()}

        {subtitle && (
          <>
            <span style={{ color: '#334155' }}>/</span>
            <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{subtitle}</span>
          </>
        )}

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
              }}
            >
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
                style={menuItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                Release Notes
              </button>
              <div style={{ borderTop: '1px solid #334155' }} />
              <button
                onClick={signOut}
                style={menuItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Release Notes Modal */}
      {releaseNotesOpen && (
        <div
          data-testid="release-notes-backdrop"
          onClick={closeReleaseNotes}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <div
            data-testid="release-notes-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '560px',
              maxWidth: '90vw',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'white' }}>Release Notes</h2>
              <button
                data-testid="release-notes-close"
                onClick={closeReleaseNotes}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: "'Outfit', sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '8px 24px 24px' }}>
              {releaseNotesLoading && (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 }}>Loading…</p>
              )}
              {releaseNotesError && (
                <p style={{ color: '#ff8a80', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 }}>{releaseNotesError}</p>
              )}
              {releaseNotes && releaseNotes.length === 0 && (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '32px 0', margin: 0 }}>No release notes yet.</p>
              )}
              {releaseNotes && releaseNotes.map((item, i) => (
                <div
                  key={i}
                  style={{ padding: '16px 0', borderBottom: i < releaseNotes.length - 1 ? '1px solid #0f172a' : 'none' }}
                >
                  <p style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, margin: '0 0 6px 0' }}>
                    {item.date}
                  </p>
                  <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                    {item.notes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
