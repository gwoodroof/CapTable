import React, { useEffect, useRef, useState } from 'react';
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

interface StakeholderItem {
  id: string;
  name: string;
  email: string | null;
  type: string;
}

interface GrantOffboardingPreview {
  grantId: string;
  grantDate: string;
  securityId: string;
  securityName: string;
  securityType: string;
  stakeholderId: string;
  totalGranted: number;
  vestedBeforeTermination: number;
  overVestedToReverse: number;
  netVested: number;
  acceleratedShares: number;
  vestEntriesAfterTermination: { id: string; quantity: number; timestamp: string }[];
}

interface OffboardingPreview {
  stakeholder: { id: string; name: string; email: string | null };
  grants: GrantOffboardingPreview[];
  totals: {
    totalGranted: number;
    vestedBeforeTermination: number;
    overVestedToReverse: number;
    acceleratedShares: number;
  };
  ptepDeadline: string;
}

interface SellerHolding {
  securityId: string;
  securityName: string;
  securityType: string;
  balance: string;
}

interface BuyoutPreviewResult {
  seller: { id: string; name: string; email: string | null };
  buyer: { id: string; name: string; email: string | null };
  security: { id: string; type: string; name: string | null };
  sellerBalance: string;
  quantity: string;
  pricePerShare: string;
  totalConsideration: string;
  sellerIssuances: { id: string; timestamp: string; quantity: string; pricePerShare: string | null }[];
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

const TERMINATION_TYPES = [
  { value: 'VOLUNTARY', label: 'Voluntary Resignation' },
  { value: 'INVOLUNTARY', label: 'Involuntary (Termination)' },
  { value: 'DISABILITY', label: 'Disability' },
  { value: 'DEATH', label: 'Death' },
  { value: 'RETIREMENT', label: 'Retirement' },
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Offboarding wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Buyout wizard state
  const [buyoutOpen, setBuyoutOpen] = useState(false);
  const [buyoutStep, setBuyoutStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [bAllStakeholders, setBAllStakeholders] = useState<StakeholderItem[]>([]);
  const [bSellerId, setBSellerId] = useState('');
  const [bSellerHoldings, setBSellerHoldings] = useState<SellerHolding[]>([]);
  const [bHoldingsLoading, setBHoldingsLoading] = useState(false);
  const [bSecurityId, setBSecurityId] = useState('');
  const [bQuantity, setBQuantity] = useState('');
  const [bPricePerShare, setBPricePerShare] = useState('');
  const [bBuyerId, setBBuyerId] = useState('');
  const [buyoutPreview, setBuyoutPreview] = useState<BuyoutPreviewResult | null>(null);
  const [bPreviewLoading, setBPreviewLoading] = useState(false);
  const [bPreviewError, setBPreviewError] = useState('');
  const [bSubmitting, setBSubmitting] = useState(false);
  const [bSubmitError, setBSubmitError] = useState('');
  const [bSubmitDone, setBSubmitDone] = useState(false);
  const [stakeholders, setStakeholders] = useState<StakeholderItem[]>([]);
  const [wStakeholderId, setWStakeholderId] = useState('');
  const [wTerminationDate, setWTerminationDate] = useState('');
  const [wTerminationType, setWTerminationType] = useState('VOLUNTARY');
  const [wPtepOverride, setWPtepOverride] = useState(false);
  const [wPtepDays, setWPtepDays] = useState(90);
  const [wApplyAcceleration, setWApplyAcceleration] = useState(false);
  const [wAccelMethod, setWAccelMethod] = useState<'shares' | 'months'>('shares');
  const [wAccelValue, setWAccelValue] = useState('');
  const [preview, setPreview] = useState<OffboardingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitDone, setSubmitDone] = useState(false);

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

    // Materialize any due vesting entries first, then load the report
    fetch(`${API}/grants/run-vesting`, { method: 'POST', headers })
      .catch(() => {}) // non-blocking; a failure here must never block the ledger view
      .finally(() => {
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
      });
  }, [companyId, router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    if (actionsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsOpen]);

  function openWizard() {
    setActionsOpen(false);
    setWizardStep(1);
    setWStakeholderId('');
    setWTerminationDate('');
    setWTerminationType('VOLUNTARY');
    setWPtepOverride(false);
    setWPtepDays(90);
    setWApplyAcceleration(false);
    setWAccelMethod('shares');
    setWAccelValue('');
    setPreview(null);
    setPreviewError('');
    setSubmitError('');
    setSubmitDone(false);
    setWizardOpen(true);

    // Fetch only options holders (stakeholders with at least one grant)
    const token = localStorage.getItem('ct_token');
    if (!token || !companyId) return;
    Promise.all([
      fetch(`${API}/stakeholders`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/grants`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([stakeholderData, grantData]: [unknown, unknown]) => {
        const allStakeholders: StakeholderItem[] = Array.isArray(stakeholderData) ? stakeholderData : [];
        const grantHolderIds = new Set(
          (Array.isArray(grantData) ? grantData : []).map((g: { stakeholderId: string }) => g.stakeholderId)
        );
        setStakeholders(allStakeholders.filter((s) => grantHolderIds.has(s.id)));
      })
      .catch(() => {});
  }

  async function fetchPreview(overrides?: Partial<{
    applyAcceleration: boolean;
    accelMethod: 'shares' | 'months';
    accelValue: string;
  }>) {
    const token = localStorage.getItem('ct_token');
    if (!token || !companyId) return;

    const applyAccel = overrides?.applyAcceleration ?? wApplyAcceleration;
    const accelMethod = overrides?.accelMethod ?? wAccelMethod;
    const accelValue = overrides?.accelValue ?? wAccelValue;

    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await fetch(`${API}/grants/offboard/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeholderId: wStakeholderId,
          terminationDate: wTerminationDate,
          terminationType: wTerminationType,
          ptepDays: wPtepOverride ? wPtepDays : 90,
          applyAcceleration: applyAccel,
          accelerationMethod: accelMethod,
          accelerationValue: applyAccel ? (Number(accelValue) || 0) : 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to load preview');
      const data = await res.json();
      setPreview(data);
    } catch (e) {
      setPreviewError('Failed to load vesting preview. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function goToStep2() {
    if (!wStakeholderId || !wTerminationDate) return;
    await fetchPreview({ applyAcceleration: false });
    setWizardStep(2);
  }

  async function goToStep5() {
    // Re-fetch preview with all params including acceleration
    await fetchPreview();
    setWizardStep(5);
  }

  async function commitOffboarding() {
    const token = localStorage.getItem('ct_token');
    if (!token || !companyId) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API}/grants/offboard/commit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeholderId: wStakeholderId,
          terminationDate: wTerminationDate,
          terminationType: wTerminationType,
          ptepDays: wPtepOverride ? wPtepDays : 90,
          applyAcceleration: wApplyAcceleration,
          accelerationMethod: wAccelMethod,
          accelerationValue: wApplyAcceleration ? (Number(wAccelValue) || 0) : 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to complete offboarding');
      setSubmitDone(true);
      // Reload the ledger after a short delay
      setTimeout(() => {
        setWizardOpen(false);
        window.location.reload();
      }, 2000);
    } catch {
      setSubmitError('Failed to apply offboarding changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function openBuyoutWizard() {
    setActionsOpen(false);
    setBuyoutStep(1);
    setBSellerId('');
    setBSellerHoldings([]);
    setBSecurityId('');
    setBQuantity('');
    setBPricePerShare('');
    setBBuyerId('');
    setBuyoutPreview(null);
    setBPreviewError('');
    setBSubmitError('');
    setBSubmitDone(false);
    setBuyoutOpen(true);

    const token = localStorage.getItem('ct_token');
    if (!token || !companyId) return;
    fetch(`${API}/stakeholders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: unknown) => setBAllStakeholders(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  async function goToBuyoutStep2() {
    const token = localStorage.getItem('ct_token');
    if (!token || !companyId || !bSellerId) return;
    setBHoldingsLoading(true);
    try {
      const res = await fetch(`${API}/ledger/${companyId}/holdings/${bSellerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data: SellerHolding[] = await res.json();
      setBSellerHoldings(data);
      if (data.length === 1) setBSecurityId(data[0].securityId);
      setBuyoutStep(2);
    } catch {
      setBSellerHoldings([]);
      setBuyoutStep(2);
    } finally {
      setBHoldingsLoading(false);
    }
  }

  async function goToBuyoutStep4() {
    const token = localStorage.getItem('ct_token');
    if (!token || !companyId) return;
    setBPreviewLoading(true);
    setBPreviewError('');
    try {
      const res = await fetch(`${API}/ledger/${companyId}/buyout/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: bSellerId, buyerId: bBuyerId, securityId: bSecurityId, quantity: bQuantity, pricePerShare: bPricePerShare }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(err.message || 'Preview failed');
      }
      setBuyoutPreview(await res.json());
      setBuyoutStep(4);
    } catch (e) {
      setBPreviewError((e as Error).message || 'Failed to load preview. Please check your inputs.');
    } finally {
      setBPreviewLoading(false);
    }
  }

  async function commitBuyout() {
    const token = localStorage.getItem('ct_token');
    if (!token || !companyId) return;
    setBSubmitting(true);
    setBSubmitError('');
    try {
      const res = await fetch(`${API}/ledger/${companyId}/buyout/commit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: bSellerId, buyerId: bBuyerId, securityId: bSecurityId, quantity: bQuantity, pricePerShare: bPricePerShare }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(err.message || 'Commit failed');
      }
      setBSubmitDone(true);
      setTimeout(() => { setBuyoutOpen(false); window.location.reload(); }, 2000);
    } catch (e) {
      setBSubmitError((e as Error).message || 'Failed to apply buyout. Please try again.');
    } finally {
      setBSubmitting(false);
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

  const tabs = ADMIN_TABS(companyId!);
  const effectivePtepDays = wPtepOverride ? wPtepDays : 90;

  return (
    <>
      <Head>
        <title>Ledger — {tenantName || 'CapTable'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <CompanyNav companyId={companyId!} companyName={tenantName} displayName={displayName} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '26px', color: 'white', margin: 0 }}>Cap Table Dashboard</h1>

            {/* Actions menu */}
            <div ref={actionsRef} style={{ position: 'relative' }}>
              <button
                data-testid="actions-menu-button"
                onClick={() => setActionsOpen((o) => !o)}
                style={{
                  background: actionsOpen ? '#1e3a5f' : '#0066cc',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Actions
                <span style={{ fontSize: '10px', marginTop: '1px' }}>{actionsOpen ? '▲' : '▾'}</span>
              </button>

              {actionsOpen && (
                <div
                  data-testid="actions-menu-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    minWidth: '200px',
                    zIndex: 100,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <button
                    data-testid="actions-add-investment"
                    onClick={() => { setActionsOpen(false); router.push(`/company/${companyId}/investments/new`); }}
                    style={dropdownItemStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    Add Investment
                  </button>
                  <div style={{ borderTop: '1px solid #334155' }} />
                  <button
                    data-testid="actions-grant-options"
                    onClick={() => { setActionsOpen(false); router.push(`/company/${companyId}/grants/new`); }}
                    style={dropdownItemStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    Grant Options
                  </button>
                  <div style={{ borderTop: '1px solid #334155' }} />
                  <button
                    data-testid="actions-offboard-options-holder"
                    onClick={openWizard}
                    style={dropdownItemStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    Offboard Options Holder
                  </button>
                  <div style={{ borderTop: '1px solid #334155' }} />
                  <button
                    data-testid="actions-investor-buyout"
                    onClick={openBuyoutWizard}
                    style={dropdownItemStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    Investor Buyout
                  </button>
                </div>
              )}
            </div>
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
              <DetailSection title="Stakeholder">
                <DetailRow label="Name" value={selectedTx.stakeholder?.name ?? '—'} />
                <DetailRow label="Email" value={selectedTx.stakeholder?.email ?? '—'} />
                <DetailRow label="Type" value={selectedTx.stakeholder?.type ?? '—'} />
                <DetailRow label="ID" value={selectedTx.stakeholder?.id ?? '—'} mono />
              </DetailSection>

              <DetailSection title="Security">
                <DetailRow label="Name" value={selectedTx.security?.name ?? '—'} />
                <DetailRow label="Type" value={selectedTx.security?.type?.replace(/_/g, ' ') ?? '—'} />
                <DetailRow label="ID" value={selectedTx.security?.id ?? '—'} mono />
              </DetailSection>

              <DetailSection title="Transaction">
                <DetailRow label="Quantity" value={formatNumber(selectedTx.quantity)} />
                <DetailRow label="Price / Share" value={selectedTx.pricePerShare ? `$${Number(selectedTx.pricePerShare).toFixed(4)}` : '—'} />
                <DetailRow label="Timestamp" value={new Date(selectedTx.timestamp).toLocaleString()} />
                <DetailRow label="Recorded At" value={new Date(selectedTx.createdAt).toLocaleString()} />
                <DetailRow label="Initiated By" value={selectedTx.initiatedBy ?? '—'} mono />
              </DetailSection>

              <DetailSection title="Audit Trail">
                <DetailRow label="Transaction ID" value={selectedTx.id} mono />
                <DetailRow label="Data Hash" value={selectedTx.dataHash} mono truncate />
                <DetailRow label="Prev Row Hash" value={selectedTx.previousRowHash ?? '(genesis)'} mono truncate />
                <DetailRow label="Chain Hash" value={selectedTx.chainHash} mono truncate />
              </DetailSection>
            </div>
          </div>
        </div>
      )}

      {/* ── Investor Buyout wizard ── */}
      {buyoutOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}>
          <div
            data-testid="buyout-wizard"
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: 'white' }}>Investor Buyout</h2>
                {!bSubmitDone && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Step {buyoutStep} of 5</p>}
              </div>
              <button onClick={() => setBuyoutOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>×</button>
            </div>

            {!bSubmitDone && (
              <div style={{ display: 'flex', gap: 0 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} style={{ flex: 1, height: '3px', background: s <= buyoutStep ? '#0066cc' : '#334155', transition: 'background 0.2s' }} />
                ))}
              </div>
            )}

            <div style={{ padding: '28px 24px', flex: 1 }}>

              {/* ── Step 1: Seller ── */}
              {buyoutStep === 1 && (
                <div data-testid="buyout-step-1">
                  <h3 style={stepTitle}>Step 1: Select Seller</h3>
                  <p style={stepDesc}>Choose the stakeholder who is selling their shares.</p>
                  <label style={labelStyle}>Seller</label>
                  <select
                    data-testid="buyout-seller-select"
                    value={bSellerId}
                    onChange={(e) => setBSellerId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— Select seller —</option>
                    {bAllStakeholders.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Step 2: Security & Shares ── */}
              {buyoutStep === 2 && (() => {
                const selectedHolding = bSellerHoldings.find((h) => h.securityId === bSecurityId);
                const maxBalance = selectedHolding ? Number(selectedHolding.balance) : 0;
                const qtyNum = Number(bQuantity);
                const qtyInvalid = bQuantity !== '' && (qtyNum <= 0 || qtyNum > maxBalance);
                const priceInvalid = bPricePerShare !== '' && Number(bPricePerShare) <= 0;
                return (
                  <div data-testid="buyout-step-2">
                    <h3 style={stepTitle}>Step 2: Security & Shares</h3>
                    <p style={stepDesc}>Select which security is being transferred, the quantity, and the sale price.</p>

                    {bHoldingsLoading ? (
                      <div style={{ color: '#64748b', padding: '16px 0' }}>Loading holdings…</div>
                    ) : bSellerHoldings.length === 0 ? (
                      <div style={{ color: '#f87171', fontSize: '13px', padding: '16px 0' }}>This stakeholder has no positive share balance.</div>
                    ) : (
                      <>
                        <label style={labelStyle}>Security</label>
                        <select
                          data-testid="buyout-security-select"
                          value={bSecurityId}
                          onChange={(e) => { setBSecurityId(e.target.value); setBQuantity(''); }}
                          style={inputStyle}
                        >
                          <option value="">— Select security —</option>
                          {bSellerHoldings.map((h) => (
                            <option key={h.securityId} value={h.securityId}>
                              {h.securityName} ({formatNumber(h.balance)} shares)
                            </option>
                          ))}
                        </select>

                        <label style={labelStyle}>
                          Shares to Transfer
                          {selectedHolding && (
                            <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none' }}> (max {formatNumber(selectedHolding.balance)})</span>
                          )}
                        </label>
                        <input
                          data-testid="buyout-quantity-input"
                          type="number"
                          min="0.000000000001"
                          step="1"
                          value={bQuantity}
                          onChange={(e) => setBQuantity(e.target.value)}
                          placeholder="e.g. 5000"
                          style={{ ...inputStyle, borderColor: qtyInvalid ? '#f87171' : '#334155' }}
                        />
                        {qtyInvalid && (
                          <p style={{ color: '#f87171', fontSize: '12px', marginTop: '-12px', marginBottom: '12px' }}>
                            {qtyNum <= 0 ? 'Quantity must be greater than zero.' : `Cannot exceed balance of ${formatNumber(selectedHolding!.balance)}.`}
                          </p>
                        )}

                        <label style={labelStyle}>Sale Price per Share ($)</label>
                        <input
                          data-testid="buyout-price-input"
                          type="number"
                          min="0.0000000001"
                          step="0.01"
                          value={bPricePerShare}
                          onChange={(e) => setBPricePerShare(e.target.value)}
                          placeholder="e.g. 1.50"
                          style={{ ...inputStyle, borderColor: priceInvalid ? '#f87171' : '#334155' }}
                        />
                        {priceInvalid && (
                          <p style={{ color: '#f87171', fontSize: '12px', marginTop: '-12px', marginBottom: '12px' }}>Price per share must be greater than zero.</p>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── Step 3: Buyer ── */}
              {buyoutStep === 3 && (
                <div data-testid="buyout-step-3">
                  <h3 style={stepTitle}>Step 3: Select Buyer</h3>
                  <p style={stepDesc}>Choose the existing stakeholder who is acquiring the shares.</p>
                  <label style={labelStyle}>Buyer</label>
                  <select
                    data-testid="buyout-buyer-select"
                    value={bBuyerId}
                    onChange={(e) => setBBuyerId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— Select buyer —</option>
                    {bAllStakeholders.filter((s) => s.id !== bSellerId).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ''}</option>
                    ))}
                  </select>
                  {bPreviewError && (
                    <div style={{ color: '#f87171', fontSize: '13px', marginTop: '8px' }}>{bPreviewError}</div>
                  )}
                </div>
              )}

              {/* ── Step 4: Cost Basis ── */}
              {buyoutStep === 4 && (
                <div data-testid="buyout-step-4">
                  <h3 style={stepTitle}>Step 4: Original Cost Basis</h3>
                  <p style={stepDesc}>
                    The seller&apos;s original share issuances for <strong style={{ color: 'white' }}>{buyoutPreview?.security.name ?? buyoutPreview?.security.type ?? ''}</strong> are shown below.
                    This information is provided for the buyer&apos;s tax and QSBS records.
                  </p>
                  {buyoutPreview && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Original Issue Date', 'Shares', 'Original Price/Share'].map((h) => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {buyoutPreview.sellerIssuances.length === 0 ? (
                            <tr><td colSpan={3} style={{ padding: '16px 10px', color: '#475569', fontSize: '13px' }}>No original issuance records found.</td></tr>
                          ) : (
                            buyoutPreview.sellerIssuances.map((iso) => (
                              <tr key={iso.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                <td style={wCell}>{formatDate(iso.timestamp)}</td>
                                <td style={{ ...wCell, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(iso.quantity)}</td>
                                <td style={{ ...wCell, fontVariantNumeric: 'tabular-nums' }}>{iso.pricePerShare ? `$${Number(iso.pricePerShare).toFixed(4)}` : '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 5: Confirmation ── */}
              {buyoutStep === 5 && (
                <div data-testid="buyout-step-5">
                  {bSubmitDone ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                      <h3 style={{ color: '#34d399', fontWeight: 700, fontSize: '20px', margin: '0 0 8px' }}>Buyout complete</h3>
                      <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Ledger has been updated. Refreshing…</p>
                    </div>
                  ) : buyoutPreview && (
                    <>
                      <h3 style={stepTitle}>Step 5: Confirm Buyout</h3>
                      <p style={stepDesc}>Review the following changes before applying them to the ledger. This action cannot be undone.</p>

                      <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Summary</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            ['Seller', buyoutPreview.seller.name],
                            ['Buyer', buyoutPreview.buyer.name],
                            ['Security', buyoutPreview.security.name ?? buyoutPreview.security.type ?? ''],
                            ['Shares Transferring', formatNumber(buyoutPreview.quantity)],
                            ['Sale Price / Share', `$${Number(buyoutPreview.pricePerShare).toFixed(4)}`],
                            ['Total Consideration', `$${Number(buyoutPreview.totalConsideration).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                          ].map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</span>
                              <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ledger Entries to Create</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', color: '#f87171' }}>CANCELLATION — {buyoutPreview.seller.name}</span>
                            <span style={{ fontSize: '13px', color: '#f87171', fontWeight: 600 }}>−{formatNumber(buyoutPreview.quantity)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', color: '#34d399' }}>ISSUANCE — {buyoutPreview.buyer.name}</span>
                            <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>+{formatNumber(buyoutPreview.quantity)}</span>
                          </div>
                        </div>
                        <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#475569' }}>
                          A stock certificate will be emailed to {buyoutPreview.buyer.email || buyoutPreview.buyer.name}.
                        </p>
                      </div>

                      {bSubmitError && (
                        <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{bSubmitError}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Wizard footer */}
            {!bSubmitDone && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setBuyoutOpen(false)} style={cancelBtnStyle}>Cancel</button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {buyoutStep > 1 && (
                    <button onClick={() => setBuyoutStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)} style={backBtnStyle}>← Back</button>
                  )}
                  {buyoutStep === 1 && (
                    <button
                      data-testid="buyout-next-step-1"
                      disabled={!bSellerId || bHoldingsLoading}
                      onClick={goToBuyoutStep2}
                      style={nextBtnStyle(!bSellerId || bHoldingsLoading)}
                    >
                      Next →
                    </button>
                  )}
                  {buyoutStep === 2 && (() => {
                    const holding = bSellerHoldings.find((h) => h.securityId === bSecurityId);
                    const maxBalance = holding ? Number(holding.balance) : 0;
                    const qtyNum = Number(bQuantity);
                    const disabled = !bSecurityId || !bQuantity || qtyNum <= 0 || qtyNum > maxBalance || !bPricePerShare || Number(bPricePerShare) <= 0;
                    return (
                      <button
                        data-testid="buyout-next-step-2"
                        disabled={disabled}
                        onClick={() => setBuyoutStep(3)}
                        style={nextBtnStyle(disabled)}
                      >
                        Next →
                      </button>
                    );
                  })()}
                  {buyoutStep === 3 && (
                    <button
                      data-testid="buyout-next-step-3"
                      disabled={!bBuyerId || bPreviewLoading}
                      onClick={goToBuyoutStep4}
                      style={nextBtnStyle(!bBuyerId || bPreviewLoading)}
                    >
                      {bPreviewLoading ? 'Loading…' : 'Next →'}
                    </button>
                  )}
                  {buyoutStep === 4 && (
                    <button
                      data-testid="buyout-next-step-4"
                      onClick={() => setBuyoutStep(5)}
                      style={nextBtnStyle(false)}
                    >
                      Review →
                    </button>
                  )}
                  {buyoutStep === 5 && buyoutPreview && (
                    <button
                      data-testid="buyout-confirm-button"
                      disabled={bSubmitting}
                      onClick={commitBuyout}
                      style={{
                        background: bSubmitting ? '#475569' : '#dc2626',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        cursor: bSubmitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {bSubmitting ? 'Applying…' : 'Confirm & Apply'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Offboarding wizard ── */}
      {wizardOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}
        >
          <div
            data-testid="offboard-wizard"
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Wizard header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: 'white' }}>Offboard Options Holder</h2>
                {!submitDone && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Step {wizardStep} of 5</p>
                )}
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
              >
                ×
              </button>
            </div>

            {/* Step progress bar */}
            {!submitDone && (
              <div style={{ display: 'flex', gap: 0 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      height: '3px',
                      background: s <= wizardStep ? '#0066cc' : '#334155',
                      transition: 'background 0.2s',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Wizard body */}
            <div style={{ padding: '28px 24px', flex: 1 }}>

              {/* ── Step 1: Termination Details ── */}
              {wizardStep === 1 && (
                <div data-testid="offboard-step-1">
                  <h3 style={stepTitle}>Step 1: Termination Details</h3>
                  <p style={stepDesc}>Select the options holder, their termination date, and reason for departure.</p>

                  <label style={labelStyle}>Options Holder</label>
                  <select
                    data-testid="offboard-options-holder-select"
                    value={wStakeholderId}
                    onChange={(e) => setWStakeholderId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— Select options holder —</option>
                    {stakeholders.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ''}</option>
                    ))}
                  </select>

                  <label style={labelStyle}>Termination Date</label>
                  <input
                    data-testid="offboard-termination-date"
                    type="date"
                    value={wTerminationDate}
                    onChange={(e) => setWTerminationDate(e.target.value)}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>Termination Type</label>
                  <select
                    data-testid="offboard-termination-type"
                    value={wTerminationType}
                    onChange={(e) => setWTerminationType(e.target.value)}
                    style={inputStyle}
                  >
                    {TERMINATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Step 2: Vesting Recalculation ── */}
              {wizardStep === 2 && (
                <div data-testid="offboard-step-2">
                  <h3 style={stepTitle}>Step 2: Vesting Recalculation</h3>
                  <p style={stepDesc}>
                    Shares vested as of <strong style={{ color: 'white' }}>{formatDate(wTerminationDate)}</strong>.
                    {(preview?.totals.overVestedToReverse ?? 0) > 0 && (
                      <> Any vesting entries recorded after the termination date will be reversed.</>
                    )}
                  </p>

                  {previewLoading && (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>Loading vesting data…</div>
                  )}
                  {previewError && (
                    <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{previewError}</div>
                  )}
                  {preview && !previewLoading && (
                    <>
                      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #334155' }}>
                              {['Security', 'Granted', 'Vested by Termination', 'To Reverse', 'Net Vested'].map((h) => (
                                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.grants.map((g) => (
                              <tr key={g.grantId} style={{ borderBottom: '1px solid #1e293b' }}>
                                <td style={wCell}>{g.securityName}</td>
                                <td style={wCell}>{formatNumber(g.totalGranted)}</td>
                                <td style={wCell}>{formatNumber(g.vestedBeforeTermination)}</td>
                                <td style={{ ...wCell, color: g.overVestedToReverse > 0 ? '#f87171' : '#64748b' }}>
                                  {g.overVestedToReverse > 0 ? `−${formatNumber(g.overVestedToReverse)}` : '—'}
                                </td>
                                <td style={{ ...wCell, color: '#34d399', fontWeight: 600 }}>{formatNumber(g.netVested)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid #334155' }}>
                              <td style={{ ...wCell, fontWeight: 700, color: 'white' }}>Total</td>
                              <td style={{ ...wCell, fontWeight: 600 }}>{formatNumber(preview.totals.totalGranted)}</td>
                              <td style={{ ...wCell, fontWeight: 600 }}>{formatNumber(preview.totals.vestedBeforeTermination)}</td>
                              <td style={{ ...wCell, color: preview.totals.overVestedToReverse > 0 ? '#f87171' : '#64748b', fontWeight: 600 }}>
                                {preview.totals.overVestedToReverse > 0 ? `−${formatNumber(preview.totals.overVestedToReverse)}` : '—'}
                              </td>
                              <td style={{ ...wCell, color: '#34d399', fontWeight: 700 }}>{formatNumber(preview.totals.vestedBeforeTermination)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {preview.grants.length === 0 && (
                        <div style={{ color: '#64748b', fontSize: '13px', padding: '16px 0' }}>
                          This stakeholder has no grants on record.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Step 3: PTEP Configuration ── */}
              {wizardStep === 3 && (
                <div data-testid="offboard-step-3">
                  <h3 style={stepTitle}>Step 3: Post-Termination Exercise Window (PTEP)</h3>
                  <p style={stepDesc}>
                    The PTEP is the window during which vested options may still be exercised after the stakeholder
                    leaves. The standard plan default is <strong style={{ color: 'white' }}>90 days</strong>.
                  </p>

                  <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', color: '#94a3b8' }}>Standard plan window (90 days)</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>
                        <input
                          data-testid="offboard-ptep-override-toggle"
                          type="checkbox"
                          checked={wPtepOverride}
                          onChange={(e) => setWPtepOverride(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#0066cc', cursor: 'pointer' }}
                        />
                        Override
                      </label>
                    </div>

                    {wPtepOverride && (
                      <div style={{ marginTop: '16px' }}>
                        <label style={labelStyle}>Custom window (days)</label>
                        <input
                          data-testid="offboard-ptep-days"
                          type="number"
                          min={1}
                          value={wPtepDays}
                          onChange={(e) => setWPtepDays(Number(e.target.value) || 90)}
                          style={inputStyle}
                        />
                      </div>
                    )}
                  </div>

                  {wTerminationDate && (
                    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        Options will expire on{' '}
                        <strong style={{ color: '#f59e0b' }}>
                          {(() => {
                            const d = new Date(wTerminationDate);
                            d.setDate(d.getDate() + effectivePtepDays);
                            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                          })()}
                        </strong>
                        {' '}({effectivePtepDays} days after termination)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 4: Acceleration ── */}
              {wizardStep === 4 && (
                <div data-testid="offboard-step-4">
                  <h3 style={stepTitle}>Step 4: Acceleration &amp; Custom Clauses</h3>
                  <p style={stepDesc}>
                    Optionally apply accelerated vesting per a severance agreement or plan provision.
                  </p>

                  <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        data-testid="offboard-acceleration-toggle"
                        type="checkbox"
                        checked={wApplyAcceleration}
                        onChange={(e) => setWApplyAcceleration(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#0066cc', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>Apply accelerated vesting</span>
                    </label>
                  </div>

                  {wApplyAcceleration && (
                    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px' }}>
                      <label style={labelStyle}>Acceleration method</label>
                      <select
                        data-testid="offboard-accel-method"
                        value={wAccelMethod}
                        onChange={(e) => setWAccelMethod(e.target.value as 'shares' | 'months')}
                        style={inputStyle}
                      >
                        <option value="shares">Flat number of additional shares</option>
                        <option value="months">Additional months of vesting</option>
                      </select>

                      <label style={{ ...labelStyle, marginTop: '14px' }}>
                        {wAccelMethod === 'shares' ? 'Number of shares' : 'Number of additional months'}
                      </label>
                      <input
                        data-testid="offboard-accel-value"
                        type="number"
                        min={0}
                        value={wAccelValue}
                        onChange={(e) => setWAccelValue(e.target.value)}
                        placeholder={wAccelMethod === 'shares' ? 'e.g. 10000' : 'e.g. 12'}
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {!wApplyAcceleration && (
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>
                      No acceleration will be applied. Stakeholder forfeits all unvested shares as of the termination date.
                    </p>
                  )}
                </div>
              )}

              {/* ── Step 5: Confirmation ── */}
              {wizardStep === 5 && (
                <div data-testid="offboard-step-5">
                  {submitDone ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                      <h3 style={{ color: '#34d399', fontWeight: 700, fontSize: '20px', margin: '0 0 8px' }}>Offboarding complete</h3>
                      <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Ledger has been updated. Refreshing…</p>
                    </div>
                  ) : (
                    <>
                      <h3 style={stepTitle}>Step 5: Confirm Changes</h3>
                      <p style={stepDesc}>Review the following changes before applying them to the ledger. This action cannot be undone.</p>

                      {previewLoading && (
                        <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>Recalculating…</div>
                      )}

                      {preview && !previewLoading && (
                        <>
                          <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stakeholder</p>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'white' }}>{preview.stakeholder.name}</p>
                            {preview.stakeholder.email && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{preview.stakeholder.email}</p>}
                          </div>

                          <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Termination</p>
                            <div style={{ display: 'flex', gap: '32px' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Date</p>
                                <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'white' }}>{formatDate(wTerminationDate)}</p>
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Type</p>
                                <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'white' }}>
                                  {TERMINATION_TYPES.find((t) => t.value === wTerminationType)?.label ?? wTerminationType}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ledger Actions</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Shares vested (retained)</span>
                                <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>{formatNumber(preview.totals.vestedBeforeTermination)}</span>
                              </div>
                              {preview.totals.overVestedToReverse > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Cancellations (over-vested reversal)</span>
                                  <span style={{ fontSize: '13px', color: '#f87171', fontWeight: 600 }}>−{formatNumber(preview.totals.overVestedToReverse)}</span>
                                </div>
                              )}
                              {preview.totals.acceleratedShares > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Accelerated vesting</span>
                                  <span style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 600 }}>+{formatNumber(preview.totals.acceleratedShares)}</span>
                                </div>
                              )}
                              <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Total shares retained</span>
                                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>
                                  {formatNumber(preview.totals.vestedBeforeTermination + preview.totals.acceleratedShares)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PTEP Deadline</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#f59e0b' }}>
                              {new Date(preview.ptepDeadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
                              Vested options must be exercised by this date ({effectivePtepDays} days after termination).
                            </p>
                          </div>

                          {submitError && (
                            <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{submitError}</div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Wizard footer */}
            {!submitDone && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setWizardOpen(false)}
                  style={cancelBtnStyle}
                >
                  Cancel
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {wizardStep > 1 && (
                    <button
                      onClick={() => setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)}
                      style={backBtnStyle}
                    >
                      ← Back
                    </button>
                  )}

                  {wizardStep < 4 && wizardStep !== 2 && (
                    <button
                      data-testid={`offboard-next-step-${wizardStep}`}
                      disabled={wizardStep === 1 && (!wStakeholderId || !wTerminationDate)}
                      onClick={() => {
                        if (wizardStep === 1) goToStep2();
                        else setWizardStep((s) => (s + 1) as 2 | 3 | 4 | 5);
                      }}
                      style={nextBtnStyle(wizardStep === 1 && (!wStakeholderId || !wTerminationDate))}
                    >
                      Next →
                    </button>
                  )}

                  {wizardStep === 2 && (
                    <button
                      data-testid="offboard-next-step-2"
                      disabled={previewLoading}
                      onClick={() => setWizardStep(3)}
                      style={nextBtnStyle(previewLoading)}
                    >
                      Next →
                    </button>
                  )}

                  {wizardStep === 4 && (
                    <button
                      data-testid="offboard-next-step-4"
                      onClick={goToStep5}
                      style={nextBtnStyle(false)}
                    >
                      Review →
                    </button>
                  )}

                  {wizardStep === 5 && !previewLoading && preview && (
                    <button
                      data-testid="offboard-confirm-button"
                      disabled={submitting}
                      onClick={commitOffboarding}
                      style={{
                        background: submitting ? '#475569' : '#dc2626',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {submitting ? 'Applying…' : 'Confirm & Apply'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px 0' }}>{title}</p>
      <div style={{ background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', borderBottom: '1px solid #1e293b', gap: '16px' }}>
      <span style={{ fontSize: '12px', color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: truncate ? 'break-all' : 'normal', maxWidth: truncate ? '300px' : 'none' }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const cell: React.CSSProperties = {
  padding: '12px 16px',
  color: '#94a3b8',
  verticalAlign: 'middle',
};

const wCell: React.CSSProperties = {
  padding: '8px 10px',
  color: '#94a3b8',
  fontSize: '13px',
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px 16px',
  fontSize: '14px',
  color: '#94a3b8',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  fontFamily: "'Outfit', sans-serif",
  cursor: 'pointer',
  fontWeight: 500,
};

const stepTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: 'white',
  margin: '0 0 8px',
};

const stepDesc: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0 0 24px',
  lineHeight: 1.6,
};

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
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  fontFamily: "'Outfit', sans-serif",
  marginBottom: '16px',
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#64748b',
  padding: '10px 16px',
  fontSize: '14px',
  fontFamily: "'Outfit', sans-serif",
  cursor: 'pointer',
};

const backBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#94a3b8',
  padding: '10px 16px',
  fontSize: '14px',
  fontFamily: "'Outfit', sans-serif",
  cursor: 'pointer',
};

function nextBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#1e293b' : '#0066cc',
    border: 'none',
    borderRadius: '8px',
    color: disabled ? '#475569' : 'white',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
