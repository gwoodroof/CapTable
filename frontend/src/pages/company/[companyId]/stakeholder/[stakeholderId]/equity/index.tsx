import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import CompanyNav from '../../../../../../components/CompanyNav';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { format, addMonths } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const SECURITY_TYPE_COLORS: Record<string, string> = {
  COMMON_STOCK: '#0066cc',
  PREFERRED_STOCK: '#7c3aed',
  OPTION: '#f59e0b',
  SAFE: '#10b981',
  CONVERTIBLE_NOTE: '#06b6d4',
  WARRANT: '#f97316',
};

interface Stakeholder {
  id: string;
  name: string;
  email: string | null;
  type: string;
  createdAt: string;
}

interface Balance {
  security: { id: string; type: string; name: string | null };
  issued: number;
  vested: number;
  exercised: number;
  cancelled: number;
  transferred: number;
  net: number;
}

interface VestingSchedule {
  name: string;
  cliffMonths: number;
  vestingDurationMonths: number;
  vestingFrequency: string;
}

interface Grant {
  id: string;
  quantity: string;
  strikePrice: string | null;
  grantDate: string;
  boardApprovalDate: string | null;
  security: { type: string; name: string | null };
  vestingSchedule: VestingSchedule;
}

interface Summary {
  stakeholder: Stakeholder;
  balances: Balance[];
  grants: Grant[];
}

interface ChartPoint {
  label: string;
  earned: number | null;
  scheduled: number;
}

interface ProjectedData {
  points: ChartPoint[];
  grantLabels: string[];
  todayLabel: string;
  totalProjected: number;
  vestedToDate: number;
}

function buildProjectedVestingData(grants: Grant[]): ProjectedData | null {
  const optionGrants = grants.filter((g) => g.security.type === 'OPTION');
  if (!optionGrants.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events: Array<{ date: Date; delta: number }> = [];

  for (const grant of optionGrants) {
    const grantDate = new Date(grant.grantDate);
    const totalQty = Number(grant.quantity);
    const { cliffMonths, vestingDurationMonths, vestingFrequency } = grant.vestingSchedule;

    events.push({ date: grantDate, delta: 0 });

    const cliffDate = addMonths(grantDate, cliffMonths);
    const cliffQty = Math.round((totalQty * cliffMonths) / vestingDurationMonths);
    events.push({ date: cliffDate, delta: cliffQty });

    const remainingQty = totalQty - cliffQty;
    const remainingMonths = vestingDurationMonths - cliffMonths;
    const periodMonths = vestingFrequency === 'MONTHLY' ? 1 : vestingFrequency === 'QUARTERLY' ? 3 : 12;
    const numPeriods = Math.round(remainingMonths / periodMonths);
    if (numPeriods > 0) {
      const perPeriod = Math.round(remainingQty / numPeriods);
      for (let i = 1; i <= numPeriods; i++) {
        const vestDate = addMonths(cliffDate, i * periodMonths);
        const qty = i === numPeriods ? remainingQty - perPeriod * (numPeriods - 1) : perPeriod;
        events.push({ date: vestDate, delta: qty });
      }
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const todayLabel = format(today, 'MMM yyyy');
  const hasTodayTick = events.some((ev) => format(ev.date, 'MMM yyyy') === todayLabel);
  if (!hasTodayTick) {
    events.push({ date: today, delta: 0 });
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  let cumulative = 0;
  let vestedToDate = 0;
  const points: ChartPoint[] = [];

  for (const ev of events) {
    cumulative += ev.delta;
    const isPast = ev.date <= today;
    if (isPast) vestedToDate = cumulative;
    points.push({
      label: format(ev.date, 'MMM yyyy'),
      earned: isPast ? cumulative : null,
      scheduled: cumulative,
    });
  }

  return {
    points,
    grantLabels: optionGrants.map((g) => format(new Date(g.grantDate), 'MMM yyyy')),
    todayLabel,
    totalProjected: cumulative,
    vestedToDate,
  };
}

function VestTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isFuture = d.earned === null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontFamily: "'Outfit', sans-serif" }}>
      <p style={{ color: '#64748b', margin: '0 0 4px 0' }}>{d.label}</p>
      <p style={{ color: isFuture ? '#94a3b8' : '#f59e0b', margin: 0, fontWeight: 600 }}>
        {fmt(d.scheduled)} {isFuture ? 'projected' : 'vested'}
      </p>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 2px 0', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  );
}

export default function StakeholderEquity() {
  const router = useRouter();
  const { companyId, stakeholderId } = router.query as { companyId?: string; stakeholderId?: string };

  const [summary, setSummary] = useState<Summary | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!stakeholderId) return;
    const token = localStorage.getItem('ct_token');
    if (!token) { router.replace('/login'); return; }
    const payload = decodeJwt(token);
    if (!payload) { router.replace('/login'); return; }
    if (payload.role !== 'ADMIN') {
      router.replace(`/company/${companyId}/equity`);
      return;
    }
    setDisplayName((payload.name as string) || (payload.email as string));

    fetch(`${API}/stakeholders/${stakeholderId}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load stakeholder');
        return r.json();
      })
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [stakeholderId, companyId, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b', fontFamily: "'Outfit', sans-serif", fontSize: '16px' }}>Loading…</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#ff8a80', fontFamily: "'Outfit', sans-serif", fontSize: '16px' }}>{error || 'Not found'}</span>
      </div>
    );
  }

  const { stakeholder, balances, grants } = summary;
  const hasOptions = balances.some((b) => b.security.type === 'OPTION');
  const chartResult = hasOptions ? buildProjectedVestingData(grants) : null;

  return (
    <>
      <Head>
        <title>{stakeholder.name} — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <CompanyNav companyId={companyId!} displayName={displayName} subtitle={stakeholder.name} />

        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 32px' }}>
          {/* Stakeholder header */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
              <h1 style={{ fontWeight: 800, fontSize: '28px', color: 'white', margin: 0 }}>{stakeholder.name}</h1>
              <span style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '2px 10px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                {stakeholder.type}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {stakeholder.email && <span style={{ fontSize: '14px', color: '#64748b' }}>{stakeholder.email}</span>}
              <span style={{ fontSize: '14px', color: '#475569' }}>Added {fmtDate(stakeholder.createdAt)}</span>
            </div>
          </div>

          {/* Holdings */}
          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px 0' }}>Holdings</h2>
            {balances.length === 0 ? (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                No holdings recorded yet.
              </div>
            ) : (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      {['Security', 'Type', 'Issued', 'Vested', 'Exercised', 'Net Balance'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b, i) => {
                      const color = SECURITY_TYPE_COLORS[b.security.type] ?? '#94a3b8';
                      return (
                        <tr key={b.security.id} style={{ borderBottom: i < balances.length - 1 ? '1px solid #0f172a' : 'none' }}>
                          <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500 }}>{b.security.name ?? '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#0f172a', border: `1px solid ${color}33`, borderRadius: '4px', padding: '2px 8px', fontSize: '12px', color }}>
                              {b.security.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.issued)}</td>
                          <td style={{ padding: '12px 16px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{b.vested > 0 ? fmt(b.vested) : '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{b.exercised > 0 ? fmt(b.exercised) : '—'}</td>
                          <td style={{ padding: '12px 16px', color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '15px' }}>{fmt(b.net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Grants table */}
          {grants.length > 0 && (
            <section style={{ marginBottom: '36px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px 0' }}>Grants</h2>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      {['Security', 'Quantity', 'Strike', 'Grant Date', 'Board Approval', 'Vesting'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g, i) => (
                      <tr key={g.id} style={{ borderBottom: i < grants.length - 1 ? '1px solid #0f172a' : 'none' }}>
                        <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500 }}>{g.security.name ?? g.security.type.replace(/_/g, ' ')}</td>
                        <td style={{ padding: '12px 16px', color: '#f59e0b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(g.quantity))}</td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{g.strikePrice ? `$${Number(g.strikePrice).toFixed(4)}` : '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{fmtDate(g.grantDate)}</td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{g.boardApprovalDate ? fmtDate(g.boardApprovalDate) : '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                          {g.vestingSchedule.cliffMonths}mo cliff / {g.vestingSchedule.vestingDurationMonths}mo{' '}
                          <span style={{ color: '#475569' }}>({g.vestingSchedule.vestingFrequency.toLowerCase()})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Vesting chart */}
          {hasOptions && chartResult && chartResult.points.length > 0 && (
            <section>
              <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px 0' }}>Vesting Timeline</h2>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px 16px 16px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', paddingLeft: '8px', flexWrap: 'wrap' }}>
                  <Chip label="Total Projected" value={fmt(chartResult.totalProjected)} color="#f59e0b" />
                  <Chip label="Vested to Date" value={fmt(chartResult.vestedToDate)} color="#10b981" />
                  <Chip label="Remaining" value={fmt(Math.max(0, chartResult.totalProjected - chartResult.vestedToDate))} color="#64748b" />
                  <Chip
                    label="% Vested"
                    value={chartResult.totalProjected > 0 ? `${((chartResult.vestedToDate / chartResult.totalProjected) * 100).toFixed(1)}%` : '0%'}
                    color="#0066cc"
                  />
                </div>

                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartResult.points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="earnedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="scheduledGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 11, fontFamily: "'Outfit', sans-serif" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                      tick={{ fill: '#64748b', fontSize: 11, fontFamily: "'Outfit', sans-serif" }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip content={<VestTooltip />} />
                    {chartResult.grantLabels.map((label) => (
                      <ReferenceLine
                        key={label}
                        x={label}
                        stroke="#0066cc"
                        strokeDasharray="4 3"
                        label={{ value: 'Grant', fill: '#0066cc', fontSize: 10, fontFamily: "'Outfit', sans-serif" }}
                      />
                    ))}
                    <ReferenceLine
                      x={chartResult.todayLabel}
                      stroke="#0066cc"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      label={{ value: 'Today', fill: '#0066cc', fontSize: 10, fontFamily: "'Outfit', sans-serif", position: 'top' }}
                    />
                    <Area type="stepAfter" dataKey="scheduled" stroke="#475569" strokeWidth={1} strokeDasharray="4 3" fill="url(#scheduledGrad)" dot={false} activeDot={false} connectNulls />
                    <Area type="stepAfter" dataKey="earned" stroke="#f59e0b" strokeWidth={2} fill="url(#earnedGrad)" dot={false} activeDot={{ r: 4, fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2 }} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>

                <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#475569', textAlign: 'center' }}>
                  Amber = earned · grey dashed = scheduled future vesting · blue dashed = grant date / today
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
