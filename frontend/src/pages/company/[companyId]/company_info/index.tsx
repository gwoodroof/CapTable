import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import CompanyNav from '../../../../components/CompanyNav';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const MAX_ICON_BYTES = 500 * 1024;

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

interface Tenant {
  id: string;
  name: string;
  website: string | null;
  iconUrl: string | null;
  authorizedShares: string;
  parValue: string;
}

export default function CompanyInfoPage() {
  const router = useRouter();
  const { companyId } = router.query as { companyId?: string };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [iconPreview, setIconPreview] = useState(''); // base64 data URL
  const [iconFieldError, setIconFieldError] = useState('');

  useEffect(() => {
    if (!companyId) return;

    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    if (!payload) { router.replace('/login'); return; }
    if (payload.role !== 'ADMIN') {
      router.replace(`/company/${companyId}/equity`);
      return;
    }

    setEmail(payload.email as string);

    fetch(`${API}/tenants/${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Tenant | null) => {
        if (data) {
          setTenant(data);
          setName(data.name ?? '');
          setWebsite(data.website ?? '');
          setIconPreview(data.iconUrl ?? '');
        } else {
          setError('Company not found.');
        }
      })
      .catch(() => setError('Failed to load company info.'))
      .finally(() => setLoading(false));
  }, [companyId, router]);

  function handleIconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIconFieldError('');

    if (file.size > MAX_ICON_BYTES) {
      setIconFieldError('Image must be 500 KB or smaller.');
      e.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width !== img.height) {
        setIconFieldError(`Image must be square — selected image is ${img.width}×${img.height}.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => setIconPreview((ev.target?.result as string) ?? '');
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setIconFieldError('Could not read image. Please try a different file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    img.src = objectUrl;
  }

  function removeIcon() {
    setIconPreview('');
    setIconFieldError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Company name is required.'); return; }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    const token = localStorage.getItem('ct_token');
    try {
      const res = await fetch(`${API}/tenants/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: trimmedName,
          website: website.trim() || null,
          iconUrl: iconPreview || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? 'Save failed.');
      } else {
        const updated: Tenant = await res.json();
        setTenant(updated);
        setName(updated.name ?? '');
        setWebsite(updated.website ?? '');
        setIconPreview(updated.iconUrl ?? '');
        setSuccessMsg('Company info saved.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b', fontFamily: "'Outfit', sans-serif", fontSize: '16px' }}>Loading…</span>
      </div>
    );
  }

  const tabs = [
    { label: 'Equity', href: `/company/${companyId}/equity` },
    { label: 'Ledger', href: `/company/${companyId}/ledger` },
    { label: 'Cap Table', href: `/company/${companyId}/cap_table` },
    { label: 'Stakeholders', href: `/company/${companyId}/stakeholders` },
    { label: 'Company Info', href: `/company/${companyId}/company_info` },
  ];

  return (
    <>
      <Head>
        <title>Company Info — {tenant?.name ?? 'CapTable'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <CompanyNav companyId={companyId!} companyName={tenant?.name ?? ''} email={email} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: 0 }}>Cap Table Dashboard</h1>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: '32px', gap: 0 }}>
            {tabs.map(({ label, href }) => {
              const active = label === 'Company Info';
              return (
                <button
                  key={label}
                  onClick={() => router.push(href)}
                  style={{ background: 'transparent', border: 'none', borderBottom: active ? '2px solid #0066cc' : '2px solid transparent', color: active ? '#0066cc' : '#64748b', padding: '10px 20px', fontSize: '14px', fontWeight: active ? 700 : 500, fontFamily: "'Outfit', sans-serif", cursor: active ? 'default' : 'pointer', marginBottom: '-1px' }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Form */}
          <div style={{ maxWidth: '560px' }}>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Company Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="Acme Corp"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={inputStyle}
                  placeholder="https://example.com"
                />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={labelStyle}>Company Icon</label>
                <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 12px 0' }}>
                  Upload a square image (PNG, JPG, or SVG). Max 500 KB. Displayed at 28×28px in the nav bar.
                </p>

                {iconPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                    <img
                      src={iconPreview}
                      alt="Company icon"
                      width={56}
                      height={56}
                      style={{ borderRadius: '6px', objectFit: 'cover', border: '1px solid #334155', flexShrink: 0 }}
                    />
                    <div>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#64748b' }}>Current icon (shown at 56×56px)</p>
                      <button
                        type="button"
                        onClick={removeIcon}
                        style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '6px', color: '#64748b', fontSize: '12px', fontFamily: "'Outfit', sans-serif", padding: '4px 10px', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ff8a80'; e.currentTarget.style.color = '#ff8a80'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        Remove icon
                      </button>
                    </div>
                  </div>
                ) : null}

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontFamily: "'Outfit', sans-serif",
                    padding: '10px 16px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#475569'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155'; }}
                >
                  <span style={{ fontSize: '16px' }}>↑</span>
                  {iconPreview ? 'Replace image…' : 'Choose image…'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIconFile}
                    style={{ display: 'none' }}
                  />
                </label>

                {iconFieldError && (
                  <p style={{ color: '#ff8a80', fontSize: '12px', margin: '8px 0 0 0' }}>{iconFieldError}</p>
                )}
              </div>

              {error && (
                <p style={{ color: '#ff8a80', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
              )}
              {successMsg && (
                <p style={{ color: '#34d399', fontSize: '13px', marginBottom: '16px' }}>{successMsg}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? '#1e293b' : '#0066cc',
                  border: 'none',
                  borderRadius: '8px',
                  color: saving ? '#475569' : 'white',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
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
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  fontFamily: "'Outfit', sans-serif",
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};
