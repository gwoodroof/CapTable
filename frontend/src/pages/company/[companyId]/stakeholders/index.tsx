import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import CompanyNav from '../../../../components/CompanyNav';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

interface Membership {
  userId: string;
  role: 'ADMIN' | 'STAKEHOLDER';
}

interface StakeholderRow {
  id: string;
  name: string;
  email: string | null;
  type: 'INDIVIDUAL' | 'ENTITY' | null;
  createdAt: string;
  membership: Membership | null;
  isStakeholder: boolean;
}

function RoleBadge({ role }: { role: 'ADMIN' | 'STAKEHOLDER' }) {
  const isAdmin = role === 'ADMIN';
  return (
    <span style={{
      background: isAdmin ? 'rgba(0,102,204,0.12)' : '#0f172a',
      border: `1px solid ${isAdmin ? '#0066cc' : '#334155'}`,
      borderRadius: '4px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 600,
      color: isAdmin ? '#0066cc' : '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {role}
    </span>
  );
}

export default function StakeholdersList() {
  const router = useRouter();
  const { companyId } = router.query as { companyId?: string };

  const [stakeholders, setStakeholders] = useState<StakeholderRow[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    setIsAdmin(true);

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/tenants/${companyId}`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/tenants/${companyId}/stakeholders`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([tenant, list]) => {
        if (tenant?.name) setTenantName(tenant.name);
        setStakeholders(Array.isArray(list) ? list : []);
      })
      .catch(() => setError('Failed to load stakeholders'))
      .finally(() => setLoading(false));
  }, [companyId, router]);

  async function makeAdmin(userId: string) {
    const token = localStorage.getItem('ct_token');
    if (!token) return;
    setUpdatingId(userId);
    try {
      const res = await fetch(`${API}/tenants/${companyId}/memberships/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      if (res.ok) {
        setStakeholders((prev) =>
          prev.map((s) =>
            s.membership?.userId === userId
              ? { ...s, membership: { userId, role: 'ADMIN' } }
              : s,
          ),
        );
      }
    } finally {
      setUpdatingId(null);
    }
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
        <title>Stakeholders — {tenantName || 'CapTable'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <CompanyNav companyId={companyId!} companyName={tenantName} displayName={displayName} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>
          {/* Page title */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: 0 }}>Cap Table Dashboard</h1>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: '32px', gap: 0 }}>
            {[
              { label: 'Equity', href: `/company/${companyId}/equity` },
              { label: 'Ledger', href: `/company/${companyId}/ledger` },
              { label: 'Cap Table', href: `/company/${companyId}/cap_table` },
              { label: 'Stakeholders', href: `/company/${companyId}/stakeholders` },
              { label: 'Company Info', href: `/company/${companyId}/company_info` },
            ].map(({ label, href }) => {
              const active = label === 'Stakeholders';
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

          {/* Stakeholders table */}
          <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'white' }}>
                Stakeholders
                <span style={{ marginLeft: '8px', fontSize: '13px', color: '#475569', fontWeight: 400 }}>({stakeholders.length})</span>
              </h2>
            </div>

            {stakeholders.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                No stakeholders yet. Add them from the Cap Table tab.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      {['Name', 'Email', 'Type', 'Platform Role', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stakeholders.map((s, i) => (
                      <tr
                        key={s.id}
                        style={{ borderBottom: i < stakeholders.length - 1 ? '1px solid #0f172a' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                      >
                        <td style={cell}>
                          {s.isStakeholder ? (
                            <button
                              onClick={() => router.push(`/company/${companyId}/stakeholder/${s.id}/equity`)}
                              style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 600, fontSize: '14px', fontFamily: "'Outfit', sans-serif", cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: '#475569', textUnderlineOffset: '3px' }}
                            >
                              {s.name}
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontWeight: 500 }}>{s.name}</span>
                          )}
                        </td>
                        <td style={{ ...cell, color: '#64748b' }}>{s.email ?? <span style={{ color: '#334155' }}>—</span>}</td>
                        <td style={cell}>
                          {s.type ? (
                            <span style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#94a3b8' }}>
                              {s.type === 'INDIVIDUAL' ? 'Individual' : 'Entity'}
                            </span>
                          ) : (
                            <span style={{ color: '#334155' }}>—</span>
                          )}
                        </td>
                        <td style={cell}>
                          {s.membership ? <RoleBadge role={s.membership.role} /> : <span style={{ color: '#334155', fontSize: '13px' }}>No account</span>}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          {isAdmin && s.membership?.role === 'STAKEHOLDER' && (
                            <button
                              onClick={() => makeAdmin(s.membership!.userId)}
                              disabled={updatingId === s.membership!.userId}
                              style={{
                                background: 'transparent',
                                border: '1px solid #0066cc',
                                borderRadius: '6px',
                                color: updatingId === s.membership!.userId ? '#334155' : '#0066cc',
                                padding: '5px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                fontFamily: "'Outfit', sans-serif",
                                cursor: updatingId === s.membership!.userId ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {updatingId === s.membership!.userId ? 'Updating…' : 'Make Admin'}
                            </button>
                          )}
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
    </>
  );
}

const cell: React.CSSProperties = {
  padding: '12px 16px',
  color: '#94a3b8',
  verticalAlign: 'middle',
};
