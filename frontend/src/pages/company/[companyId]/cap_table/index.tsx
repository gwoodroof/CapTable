import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  security?: { id: string; type: string; name: string | null };
}

interface LedgerReport {
  transactionCount: number;
  transactions: Transaction[];
}

interface PieSlice {
  type: string;
  label: string;
  value: number;
}

const SECURITY_TYPE_COLORS: Record<string, string> = {
  COMMON_STOCK: '#0066cc',
  PREFERRED_STOCK: '#7c3aed',
  OPTION: '#f59e0b',
  SAFE: '#10b981',
  CONVERTIBLE_NOTE: '#06b6d4',
  WARRANT: '#f97316',
};

const SECURITY_TYPE_LABELS: Record<string, string> = {
  COMMON_STOCK: 'Common Stock',
  PREFERRED_STOCK: 'Preferred Stock',
  OPTION: 'Options',
  SAFE: 'SAFEs',
  CONVERTIBLE_NOTE: 'Convertible Notes',
  WARRANT: 'Warrants',
};

function formatSecurityType(type: string): string {
  return SECURITY_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

function computeOwnershipSlices(transactions: Transaction[]): PieSlice[] {
  const net: Record<string, number> = {};
  for (const tx of transactions) {
    const type = tx.security?.type ?? 'UNKNOWN';
    if (!(type in net)) net[type] = 0;
    const qty = Number(tx.quantity);
    if (tx.transactionType === 'ISSUANCE') net[type] += qty;
    else if (tx.transactionType === 'CANCELLATION') net[type] -= qty;
  }
  return Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({ type, label: formatSecurityType(type), value }))
    .sort((a, b) => b.value - a.value);
}

function formatNumber(val: string | number) {
  return Number(val).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PieSlice; value: number }> }) {
  if (!active || !payload?.length) return null;
  const { label, value } = payload[0].payload;
  const total = payload[0].value; // recharts passes value as the slice value
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontFamily: "'Outfit', sans-serif" }}>
      <p style={{ margin: 0, color: 'white', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>{formatNumber(total)} shares</p>
    </div>
  );
}

const ADMIN_TABS = (companyId: string) => [
  { label: 'Equity', href: `/company/${companyId}/equity` },
  { label: 'Ledger', href: `/company/${companyId}/ledger` },
  { label: 'Cap Table', href: `/company/${companyId}/cap_table` },
  { label: 'Stakeholders', href: `/company/${companyId}/stakeholders` },
  { label: 'Company Info', href: `/company/${companyId}/company_info` },
];

export default function CapTableDashboard() {
  const router = useRouter();
  const { companyId } = router.query as { companyId?: string };

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        setTenant(tenantData);
        setReport(reportData);
      })
      .catch(() => setError('Failed to load dashboard data'))
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

  const slices = computeOwnershipSlices(report?.transactions ?? []);
  const totalIssued = slices.reduce((s, p) => s + p.value, 0);
  const tabs = ADMIN_TABS(companyId!);

  return (
    <>
      <Head>
        <title>{tenant?.name ?? 'Dashboard'} — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <CompanyNav companyId={companyId!} companyName={tenant?.name ?? ''} displayName={displayName} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>
          {/* Page title + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: 0 }}>Cap Table Dashboard</h1>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => router.push(`/company/${companyId}/investments/new`)}
                style={{ background: '#0066cc', border: 'none', borderRadius: '8px', color: 'white', padding: '10px 20px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
              >
                + Add Investment
              </button>
              <button
                onClick={() => router.push(`/company/${companyId}/grants/new`)}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', padding: '10px 20px', fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer' }}
              >
                + Grant Options
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: '32px', gap: 0 }}>
            {tabs.map(({ label, href }) => {
              const active = label === 'Cap Table';
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
              <p style={cardLabel}>TOTAL ISSUED</p>
              <p style={{ ...cardValue, color: '#f59e0b' }}>{formatNumber(totalIssued)}</p>
              <p style={cardSub}>Net shares across all security types</p>
            </div>
          </div>

          {/* Pie chart */}
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '24px' }}>
            <h2 style={{ margin: '0 0 24px 0', fontWeight: 700, fontSize: '16px', color: 'white' }}>
              Ownership by Security Type
            </h2>

            {slices.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                No issued shares recorded yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={0}
                    >
                      {slices.map((slice) => (
                        <Cell
                          key={slice.type}
                          fill={SECURITY_TYPE_COLORS[slice.type] ?? '#64748b'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Custom legend / breakdown table */}
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {slices.map((slice) => {
                    const pct = totalIssued > 0 ? ((slice.value / totalIssued) * 100).toFixed(1) : '0.0';
                    const color = SECURITY_TYPE_COLORS[slice.type] ?? '#64748b';
                    return (
                      <div
                        key={slice.type}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #0f172a' }}
                      >
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: '#94a3b8', flex: 1 }}>{slice.label}</span>
                        <span style={{ fontSize: '13px', color: 'white', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {formatNumber(slice.value)}
                        </span>
                        <span style={{ fontSize: '13px', color: '#475569', fontVariantNumeric: 'tabular-nums', minWidth: '52px', textAlign: 'right' }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
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
