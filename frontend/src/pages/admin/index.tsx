import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
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

interface Tenant {
  id: string;
  name: string;
  authorizedShares: string;
  parValue: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  quantity: string;
  pricePerShare: string | null;
  timestamp: string;
  createdAt: string;
  dataHash: string;
  previousRowHash: string | null;
  chainHash: string;
  initiatedBy: string | null;
  stakeholder?: { id: string; name: string; email: string | null; type: string };
  security?: { id: string; type: string; name: string | null };
}

interface LedgerReport {
  transactionCount: number;
  transactions: Transaction[];
}

function formatNumber(val: string | number) {
  return Number(val).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ct_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    const payload = decodeJwt(token);
    if (!payload) {
      router.replace('/login');
      return;
    }

    const tenantId = payload.tenantId as string;
    setEmail(payload.email as string);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/tenants/${tenantId}`, { headers }).then((r) => r.json()),
      fetch(`${API}/ledger/${tenantId}/report`, { headers }).then((r) => r.json()),
    ])
      .then(([tenantData, reportData]) => {
        setTenant(tenantData);
        setReport(reportData);
      })
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, [router]);

  function signOut() {
    localStorage.removeItem('ct_token');
    router.push('/login');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b', fontFamily: "'Outfit', sans-serif", fontSize: '16px' }}>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#ff8a80', fontFamily: "'Outfit', sans-serif", fontSize: '16px' }}>{error}</span>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{tenant?.name ?? 'Dashboard'} — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        {/* Nav */}
        <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PiconLogo size={28} />
          <span style={{ fontWeight: 700, fontSize: '18px', color: 'white' }}>CapTable</span>
          {tenant && (
            <span style={{ fontSize: '13px', color: '#475569', marginLeft: '4px' }}>/ {tenant.name}</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>{email}</span>
            <button
              onClick={signOut}
              style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', padding: '6px 14px', fontSize: '13px', fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>
          {/* Page title + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: 0 }}>Cap Table Dashboard</h1>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => router.push('/admin/investments/new')}
                style={{ background: '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '10px 20px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
              >
                + Add Investment
              </button>
              <button
                onClick={() => router.push('/admin/grants/new')}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '10px 20px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
              >
                + Grant Options
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            <div style={cardStyle}>
              <p style={cardLabel}>COMPANY</p>
              <p style={{ ...cardValue, fontSize: '22px' }}>{tenant?.name ?? '—'}</p>
              <p style={cardSub}>Since {tenant ? formatDate(tenant.createdAt) : '—'}</p>
            </div>
            <div style={cardStyle}>
              <p style={cardLabel}>AUTHORIZED SHARES</p>
              <p style={cardValue}>{tenant ? formatNumber(tenant.authorizedShares) : '—'}</p>
              <p style={cardSub}>Par value ${tenant ? Number(tenant.parValue).toFixed(4) : '—'}</p>
            </div>
            <div style={{ ...cardStyle, borderLeftColor: '#f59e0b' }}>
              <p style={cardLabel}>LEDGER ENTRIES</p>
              <p style={{ ...cardValue, color: '#f59e0b' }}>{report?.transactionCount ?? 0}</p>
              <p style={cardSub}>All-time transactions</p>
            </div>
          </div>

          {/* Ledger table */}
          <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155' }}>
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'white' }}>Ledger Transactions</h2>
            </div>
            {!report?.transactions?.length ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                No transactions recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      {['Date', 'Type', 'Stakeholder', 'Security', 'Quantity', 'Price/Share'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.transactions ?? []).map((tx, i) => (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        style={{ borderBottom: i < (report?.transactions?.length ?? 0) - 1 ? '1px solid #1e293b' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,102,204,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                      >
                        <td style={cell}>{formatDate(tx.timestamp)}</td>
                        <td style={cell}>
                          <span style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color: '#94a3b8' }}>
                            {tx.transactionType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={cell}>
                          <div
                            onClick={(e) => { e.stopPropagation(); if (tx.stakeholder?.id) router.push(`/admin/stakeholders/${tx.stakeholder.id}`); }}
                            style={{ color: 'white', fontWeight: 500, textDecoration: 'underline', textDecorationColor: '#475569', textUnderlineOffset: '3px', cursor: 'pointer', display: 'inline' }}
                          >
                            {tx.stakeholder?.name ?? '—'}
                          </div>
                          {tx.stakeholder?.type && <div style={{ fontSize: '11px', color: '#475569' }}>{tx.stakeholder.type}</div>}
                        </td>
                        <td style={cell}>{tx.security?.name ?? tx.security?.type ?? '—'}</td>
                        <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(tx.quantity)}</td>
                        <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                          {tx.pricePerShare ? `$${Number(tx.pricePerShare).toFixed(4)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction detail modal */}
      {selectedTx && (
        <div
          onClick={() => setSelectedTx(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                  {selectedTx.transactionType.replace(/_/g, ' ')}
                </span>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#475569' }}>{formatDate(selectedTx.timestamp)}</p>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '24px' }}>
              <Section title="Stakeholder">
                <Row label="Name" value={selectedTx.stakeholder?.name ?? '—'} />
                <Row label="Email" value={selectedTx.stakeholder?.email ?? '—'} />
                <Row label="Type" value={selectedTx.stakeholder?.type ?? '—'} />
                <Row label="ID" value={selectedTx.stakeholder?.id ?? '—'} mono />
              </Section>

              <Section title="Security">
                <Row label="Name" value={selectedTx.security?.name ?? '—'} />
                <Row label="Type" value={selectedTx.security?.type?.replace(/_/g, ' ') ?? '—'} />
                <Row label="ID" value={selectedTx.security?.id ?? '—'} mono />
              </Section>

              <Section title="Transaction">
                <Row label="Quantity" value={formatNumber(selectedTx.quantity)} />
                <Row label="Price / Share" value={selectedTx.pricePerShare ? `$${Number(selectedTx.pricePerShare).toFixed(4)}` : '—'} />
                <Row label="Timestamp" value={new Date(selectedTx.timestamp).toLocaleString()} />
                <Row label="Recorded At" value={new Date(selectedTx.createdAt).toLocaleString()} />
                <Row label="Initiated By" value={selectedTx.initiatedBy ?? '—'} mono />
              </Section>

              <Section title="Audit Trail">
                <Row label="Transaction ID" value={selectedTx.id} mono />
                <Row label="Data Hash" value={selectedTx.dataHash} mono truncate />
                <Row label="Prev Row Hash" value={selectedTx.previousRowHash ?? '(genesis)'} mono truncate />
                <Row label="Chain Hash" value={selectedTx.chainHash} mono truncate />
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px 0' }}>{title}</p>
      <div style={{ background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', borderBottom: '1px solid #1e293b', gap: '16px' }}>
      <span style={{ fontSize: '12px', color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: truncate ? 'break-all' : 'normal', maxWidth: truncate ? '300px' : 'none' }}>
        {value}
      </span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid #334155',
  borderLeft: '4px solid #0066cc',
  padding: '24px',
};

const cardLabel: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '0 0 8px 0',
  fontWeight: 600,
};

const cardValue: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: '#0066cc',
  margin: '0 0 8px 0',
};

const cardSub: React.CSSProperties = {
  fontSize: '12px',
  color: '#475569',
  margin: 0,
};

const cell: React.CSSProperties = {
  padding: '12px 16px',
  color: '#94a3b8',
  verticalAlign: 'middle',
};
