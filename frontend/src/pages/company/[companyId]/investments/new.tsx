import React, { useState } from 'react';
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

const SECURITY_TYPES = [
  { value: 'PREFERRED_STOCK', label: 'Preferred Stock' },
  { value: 'SAFE', label: 'SAFE' },
  { value: 'CONVERTIBLE_NOTE', label: 'Convertible Note' },
  { value: 'COMMON_STOCK', label: 'Common Stock' },
  { value: 'WARRANT', label: 'Warrant' },
];

export default function NewInvestment() {
  const router = useRouter();
  const { companyId } = router.query as { companyId?: string };

  const [form, setForm] = useState({
    investorName: '',
    investorEmail: '',
    investorType: 'ENTITY',
    securityName: '',
    securityType: 'PREFERRED_STOCK',
    quantity: '',
    pricePerShare: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    if (!payload) { router.replace('/login'); return; }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Use companyId from URL; fall back to JWT's tenantId for backward compatibility
    const tenantId = companyId ?? (payload.tenantId as string);

    try {
      const shRes = await fetch(`${API}/stakeholders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: form.investorName, email: form.investorEmail || undefined, type: form.investorType }),
      });
      if (!shRes.ok) {
        const err = await shRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create stakeholder');
      }
      const stakeholder = await shRes.json();

      const secRes = await fetch(`${API}/securities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: form.securityName, type: form.securityType }),
      });
      if (!secRes.ok) {
        const err = await secRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create security');
      }
      const security = await secRes.json();

      const ledgerRes = await fetch(`${API}/ledger/${tenantId}/issuance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stakeholderId: stakeholder.id,
          securityId: security.id,
          quantity: form.quantity,
          pricePerShare: form.pricePerShare || undefined,
        }),
      });
      if (!ledgerRes.ok) {
        const err = await ledgerRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to record issuance');
      }

      router.push(`/company/${companyId}?success=investment`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Add Investment — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push(`/company/${companyId}`)}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '14px', fontFamily: "'Outfit', sans-serif", cursor: 'pointer', padding: 0 }}
          >
            ← Dashboard
          </button>
          <span style={{ color: '#334155' }}>/</span>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'white' }}>Add Investment</span>
        </nav>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 32px' }}>
          <h1 style={{ fontWeight: 800, fontSize: '24px', color: 'white', margin: '0 0 8px 0' }}>Register New Investment</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 40px 0' }}>
            Creates an investor stakeholder, a security instrument, and records an issuance in the ledger.
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', color: '#fca5a5', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Investor</h2>
              <div style={fieldRow}>
                <label style={labelStyle}>Name *</label>
                <input required value={form.investorName} onChange={(e) => set('investorName', e.target.value)} placeholder="e.g. Acme Ventures LLC" style={inputStyle} />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.investorEmail} onChange={(e) => set('investorEmail', e.target.value)} placeholder="investor@example.com" style={inputStyle} />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Type *</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {(['ENTITY', 'INDIVIDUAL'] as const).map((t) => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>
                      <input type="radio" name="investorType" value={t} checked={form.investorType === t} onChange={() => set('investorType', t)} />
                      {t === 'ENTITY' ? 'Entity (fund, corp)' : 'Individual'}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Security</h2>
              <div style={fieldRow}>
                <label style={labelStyle}>Security Name *</label>
                <input required value={form.securityName} onChange={(e) => set('securityName', e.target.value)} placeholder="e.g. Series A Preferred" style={inputStyle} />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Security Type *</label>
                <select value={form.securityType} onChange={(e) => set('securityType', e.target.value)} style={{ ...inputStyle, appearance: 'none' as const }}>
                  {SECURITY_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Issuance</h2>
              <div style={fieldRow}>
                <label style={labelStyle}>Quantity (shares / units) *</label>
                <input required type="number" min="0" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="e.g. 1000000" style={inputStyle} />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Price per Share / Unit</label>
                <input type="number" min="0" step="any" value={form.pricePerShare} onChange={(e) => set('pricePerShare', e.target.value)} placeholder="e.g. 1.00" style={inputStyle} />
              </div>
            </section>

            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', background: submitting ? '#1e3a5f' : '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '14px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '8px' }}
            >
              {submitting ? 'Recording…' : 'Record Investment'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const sectionStyle: React.CSSProperties = { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', marginBottom: '20px' };
const sectionTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 20px 0' };
const fieldRow: React.CSSProperties = { marginBottom: '16px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', padding: '10px 12px', fontSize: '14px', fontFamily: "'Outfit', sans-serif", boxSizing: 'border-box', outline: 'none' };
