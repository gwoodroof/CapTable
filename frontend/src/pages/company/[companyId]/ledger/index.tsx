import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import CompanyNav from '../../../../components/CompanyNav';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
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

const ADMIN_TABS = (companyId: string) => [
  { label: 'Equity', href: `/company/${companyId}/equity` },
  { label: 'Ledger', href: `/company/${companyId}/ledger` },
  { label: 'Cap Table', href: `/company/${companyId}/cap_table` },
  { label: 'Stakeholders', href: `/company/${companyId}/stakeholders` },
  { label: 'Company Info', href: `/company/${companyId}/company_info` },
];

export default function LedgerPage() {
  const router = useRouter();
  const { companyId } = router.query as { companyId?: string };

  const [tenantName, setTenantName] = useState('');
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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

    setDisplayName((payload.name as string) || (payload.email as string));
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/tenants/${companyId}`, { headers }).then((r) => r.json()),
      fetch(`${API}/ledger/${companyId}/report`, { headers }).then((r) => r.json()),
    ])
      .then(([tenantData, reportData]) => {
        setTenantName(tenantData?.name ?? '');
        setReport(reportData);
      })
      .catch(() => setError('Failed to load ledger data'))
      .finally(() => setLoading(false));
  }, [companyId, router]);

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

  const tabs = ADMIN_TABS(companyId!);

  return (
    <>
      <Head>
        <title>Ledger — {tenantName || 'CapTable'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <CompanyNav companyId={companyId!} companyName={tenantName} displayName={displayName} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: 0 }}>Cap Table Dashboard</h1>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: '32px', gap: 0 }}>
            {tabs.map(({ label, href }) => {
              const active = label === 'Ledger';
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

          {/* Ledger table */}
          <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'white' }}>Ledger Transactions</h2>
              {report && (
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  {report.transactionCount} {report.transactionCount === 1 ? 'entry' : 'entries'}
                </span>
              )}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tx.stakeholder?.id) router.push(`/company/${companyId}/stakeholder/${tx.stakeholder.id}/equity`);
                            }}
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

const cell: React.CSSProperties = {
  padding: '12px 16px',
  color: '#94a3b8',
  verticalAlign: 'middle',
};
