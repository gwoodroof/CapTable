import React, { useState, useEffect } from 'react';
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

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

interface Stakeholder {
  id: string;
  name: string;
  email: string | null;
  type: string;
}

export default function NewGrant() {
  const router = useRouter();

  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [selectedStakeholderId, setSelectedStakeholderId] = useState<string>('');
  const [form, setForm] = useState({
    employeeName: '',
    employeeEmail: '',
    securityName: 'Stock Options',
    quantity: '',
    strikePrice: '',
    grantDate: todayISO(),
    boardApprovalDate: '',
    cliffMonths: '12',
    vestingDurationMonths: '48',
    vestingFrequency: 'MONTHLY',
    poolName: '',
    poolShares: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ct_token');
    if (!token) return;
    fetch(`${API}/stakeholders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then(setStakeholders)
      .catch(() => {});
  }, []);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isNewEmployee = selectedStakeholderId === '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    if (!payload) { router.replace('/login'); return; }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    try {
      // 1. Resolve stakeholder — use existing or create new
      let stakeholderId: string;
      if (!isNewEmployee) {
        stakeholderId = selectedStakeholderId;
      } else {
        const shRes = await fetch(`${API}/stakeholders`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: form.employeeName, email: form.employeeEmail || undefined, type: 'INDIVIDUAL' }),
        });
        if (!shRes.ok) {
          const err = await shRes.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to create employee stakeholder');
        }
        const sh = await shRes.json();
        stakeholderId = sh.id;
      }

      // 2. Create OPTION security
      const secRes = await fetch(`${API}/securities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: form.securityName, type: 'OPTION' }),
      });
      if (!secRes.ok) {
        const err = await secRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create security');
      }
      const security = await secRes.json();

      // 3. Create equity pool (if specified)
      if (form.poolName.trim()) {
        const poolRes = await fetch(`${API}/pools`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: form.poolName, authorizedShares: form.poolShares || '0' }),
        });
        if (!poolRes.ok) {
          const err = await poolRes.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to create equity pool');
        }
      }

      // 4. Create vesting schedule
      const vestRes = await fetch(`${API}/vesting-schedules`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: `${Number(form.vestingDurationMonths) / 12}yr vest / ${form.cliffMonths}mo cliff`,
          cliffMonths: parseInt(form.cliffMonths),
          vestingDurationMonths: parseInt(form.vestingDurationMonths),
          vestingFrequency: form.vestingFrequency,
        }),
      });
      if (!vestRes.ok) {
        const err = await vestRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create vesting schedule');
      }
      const vestingSchedule = await vestRes.json();

      // 5. Create grant (also records ISSUANCE in ledger)
      const grantRes = await fetch(`${API}/grants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stakeholderId,
          securityId: security.id,
          vestingScheduleId: vestingSchedule.id,
          quantity: form.quantity,
          strikePrice: form.strikePrice || undefined,
          grantDate: new Date(form.grantDate).toISOString(),
          boardApprovalDate: form.boardApprovalDate ? new Date(form.boardApprovalDate).toISOString() : undefined,
        }),
      });
      if (!grantRes.ok) {
        const err = await grantRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create grant');
      }

      router.push('/admin?success=grant');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedStakeholder = stakeholders.find((s) => s.id === selectedStakeholderId);

  return (
    <>
      <Head>
        <title>Grant Options — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '14px', fontFamily: "'Outfit', sans-serif", cursor: 'pointer', padding: 0 }}
          >
            ← Dashboard
          </button>
          <span style={{ color: '#334155' }}>/</span>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'white' }}>Grant Options</span>
        </nav>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 32px' }}>
          <h1 style={{ fontWeight: 800, fontSize: '24px', color: 'white', margin: '0 0 8px 0' }}>Grant Stock Options</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 40px 0' }}>
            Select an existing employee or add a new one, then configure the grant terms.
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', color: '#fca5a5', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Employee */}
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Employee</h2>

              <div style={fieldRow}>
                <label style={labelStyle}>Select existing employee</label>
                <select
                  value={selectedStakeholderId}
                  onChange={(e) => setSelectedStakeholderId(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' as const, color: selectedStakeholderId ? 'white' : '#64748b' }}
                >
                  <option value="">— Add new employee —</option>
                  {stakeholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.email ? ` (${s.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show read-only summary for existing, or editable fields for new */}
              {!isNewEmployee && selectedStakeholder ? (
                <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{selectedStakeholder.name}</span>
                  {selectedStakeholder.email && <span style={{ color: '#64748b', fontSize: '13px' }}>{selectedStakeholder.email}</span>}
                  <span style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{selectedStakeholder.type}</span>
                </div>
              ) : (
                <>
                  <div style={fieldRow}>
                    <label style={labelStyle}>Full Name *</label>
                    <input
                      required={isNewEmployee}
                      value={form.employeeName}
                      onChange={(e) => set('employeeName', e.target.value)}
                      placeholder="e.g. Jane Smith"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ ...fieldRow, marginBottom: 0 }}>
                    <label style={labelStyle}>Email</label>
                    <input
                      type="email"
                      value={form.employeeEmail}
                      onChange={(e) => set('employeeEmail', e.target.value)}
                      placeholder="jane@company.com"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
            </section>

            {/* Grant Details */}
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Grant Details</h2>
              <div style={fieldRow}>
                <label style={labelStyle}>Security / Plan Name *</label>
                <input
                  required
                  value={form.securityName}
                  onChange={(e) => set('securityName', e.target.value)}
                  placeholder="e.g. Stock Options"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={fieldRow}>
                  <label style={labelStyle}>Number of Options *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                    placeholder="e.g. 10000"
                    style={inputStyle}
                  />
                </div>
                <div style={fieldRow}>
                  <label style={labelStyle}>Strike Price (per share)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.strikePrice}
                    onChange={(e) => set('strikePrice', e.target.value)}
                    placeholder="e.g. 0.10"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={fieldRow}>
                  <label style={labelStyle}>Grant Date *</label>
                  <input
                    required
                    type="date"
                    value={form.grantDate}
                    onChange={(e) => set('grantDate', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldRow, marginBottom: 0 }}>
                  <label style={labelStyle}>Board Approval Date</label>
                  <input
                    type="date"
                    value={form.boardApprovalDate}
                    onChange={(e) => set('boardApprovalDate', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </section>

            {/* Vesting Schedule */}
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Vesting Schedule</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={fieldRow}>
                  <label style={labelStyle}>Cliff (months) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.cliffMonths}
                    onChange={(e) => set('cliffMonths', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldRow, marginBottom: 0 }}>
                  <label style={labelStyle}>Total Duration (months) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.vestingDurationMonths}
                    onChange={(e) => set('vestingDurationMonths', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ ...fieldRow, marginBottom: 0 }}>
                <label style={labelStyle}>Vesting Frequency *</label>
                <select
                  value={form.vestingFrequency}
                  onChange={(e) => set('vestingFrequency', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' as const }}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>
            </section>

            {/* Equity Pool (optional) */}
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>
                Equity Pool{' '}
                <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none', fontSize: '12px' }}>(optional)</span>
              </h2>
              <div style={fieldRow}>
                <label style={labelStyle}>Pool Name</label>
                <input
                  value={form.poolName}
                  onChange={(e) => set('poolName', e.target.value)}
                  placeholder="e.g. 2026 Equity Incentive Plan"
                  style={inputStyle}
                />
              </div>
              {form.poolName.trim() && (
                <div style={{ ...fieldRow, marginBottom: 0 }}>
                  <label style={labelStyle}>Pool Authorized Shares</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.poolShares}
                    onChange={(e) => set('poolShares', e.target.value)}
                    placeholder="e.g. 5000000"
                    style={inputStyle}
                  />
                </div>
              )}
            </section>

            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', background: submitting ? '#1e3a5f' : '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '14px', fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '8px' }}
            >
              {submitting ? 'Recording…' : 'Issue Grant'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const sectionStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '20px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '0 0 20px 0',
};

const fieldRow: React.CSSProperties = {
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  color: '#94a3b8',
  marginBottom: '6px',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: 'white',
  padding: '10px 12px',
  fontSize: '14px',
  fontFamily: "'Outfit', sans-serif",
  boxSizing: 'border-box',
  outline: 'none',
};
