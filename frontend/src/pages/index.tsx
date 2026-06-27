import React, { useState } from 'react';
import Head from 'next/head';

// Donut "C" logo. Outer r=80, inner r=40, gap faces right (305°→55° CW = 110°).
// Segment boundaries at 55°, 125°, 235°, 305° (SVG: 0°=east, CW positive).
// Each annular sector: M outer-start A outer-arc L inner-end A inner-arc(CCW) Z
function PiconLogo({ size = 40, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const bottomColor = variant === 'light' ? '#f0f4f8' : '#1e293b';
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      {/* Bottom segment: 55°→125° CW, 70° arc */}
      <path d="M 145.9 165.5 A 80 80 0 0 1 54.1 165.5 L 77.1 132.8 A 40 40 0 0 0 122.9 132.8 Z" fill={bottomColor} />
      {/* Amber segment: 125°→235° CW, 110° arc */}
      <path d="M 54.1 165.5 A 80 80 0 0 1 54.1 34.5 L 77.1 67.2 A 40 40 0 0 0 77.1 132.8 Z" fill="#f59e0b" />
      {/* Blue segment: 235°→305° CW, 70° arc */}
      <path d="M 54.1 34.5 A 80 80 0 0 1 145.9 34.5 L 122.9 67.2 A 40 40 0 0 0 77.1 67.2 Z" fill="#0066cc" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function PrecisionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="12" y2="14" />
    </svg>
  );
}

const styles = {
  body: {
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
    background: '#f8f9fb',
    minHeight: '100vh',
    margin: 0,
  } as React.CSSProperties,
  nav: {
    background: '#0f172a',
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    height: '64px',
  } as React.CSSProperties,
  navBrand: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '20px',
    color: 'white',
  } as React.CSSProperties,
  alphaBadgeWrap: {
    display: 'inline-block',
    position: 'relative' as const,
    marginLeft: '8px',
    verticalAlign: 'middle',
    top: '-1px',
  } as React.CSSProperties,
  alphaBadge: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.4)',
    borderRadius: '4px',
    padding: '1px 6px',
    lineHeight: '16px',
    cursor: 'default',
  } as React.CSSProperties,
  alphaTooltip: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: '0',
    background: '#1e293b',
    border: '1px solid rgba(245,158,11,0.4)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#e2e8f0',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  } as React.CSSProperties,
  navSub: {
    marginLeft: 'auto',
    fontSize: '13px',
    color: '#64748b',
  } as React.CSSProperties,
  hero: {
    background: '#0f172a',
    padding: '80px 32px 100px',
    textAlign: 'center',
  } as React.CSSProperties,
  heroInner: {
    maxWidth: '700px',
    margin: '0 auto',
  } as React.CSSProperties,
  heroLogoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '36px',
  } as React.CSSProperties,
  heroH1: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '52px',
    fontWeight: 800,
    color: 'white',
    marginBottom: '20px',
    lineHeight: 1.15,
    margin: '0 0 20px 0',
  } as React.CSSProperties,
  heroAccent: {
    color: '#0066cc',
  } as React.CSSProperties,
  heroLead: {
    fontSize: '18px',
    color: '#cbd5e1',
    marginBottom: '12px',
    lineHeight: 1.6,
    margin: '0 0 12px 0',
  } as React.CSSProperties,
  heroSub: {
    fontSize: '15px',
    color: '#475569',
    marginBottom: '48px',
    lineHeight: 1.6,
    margin: '0 0 48px 0',
  } as React.CSSProperties,
  ctaRow: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  btnPrimary: {
    background: '#0066cc',
    color: 'white',
    padding: '14px 28px',
    borderRadius: '8px',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 600,
    fontSize: '15px',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  btnSecondary: {
    background: '#f59e0b',
    color: 'white',
    padding: '14px 28px',
    borderRadius: '8px',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 600,
    fontSize: '15px',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  demoStrip: {
    background: '#f0f4f8',
    padding: '60px 32px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '32px',
    flexWrap: 'wrap' as const,
  },
  demoCard: {
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e0e7f1 100%)',
    padding: '28px 32px',
    borderRadius: '12px',
    borderLeft: '4px solid #0066cc',
    minWidth: '260px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  } as React.CSSProperties,
  demoLabel: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  demoValue: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '36px',
    fontWeight: 700,
    color: '#0066cc',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  } as React.CSSProperties,
  demoMeta: {
    display: 'flex',
    gap: '24px',
    fontSize: '14px',
    color: '#475569',
  } as React.CSSProperties,
  demoMetaStrong: {
    color: '#0f172a',
  } as React.CSSProperties,
  demoCardAmber: {
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    padding: '28px 32px',
    borderRadius: '12px',
    borderLeft: '4px solid #f59e0b',
    minWidth: '260px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  } as React.CSSProperties,
  demoValueAmber: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '36px',
    fontWeight: 700,
    color: '#d97706',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  } as React.CSSProperties,
  features: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '80px 32px',
  } as React.CSSProperties,
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
    gap: '24px',
  } as React.CSSProperties,
  featureCard: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    borderLeft: '4px solid #0066cc',
    padding: '28px 24px',
  } as React.CSSProperties,
  featureCardAmber: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    borderLeft: '4px solid #f59e0b',
    padding: '28px 24px',
  } as React.CSSProperties,
  featureIconWrap: {
    width: '40px',
    height: '40px',
    background: '#f0f4f8',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,
  featureIconWrapAmber: {
    width: '40px',
    height: '40px',
    background: '#fffbeb',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,
  featureTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '18px',
    color: '#0f172a',
    marginBottom: '10px',
    margin: '0 0 10px 0',
  } as React.CSSProperties,
  featureDesc: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: 1.65,
    margin: 0,
  } as React.CSSProperties,
  footer: {
    background: '#0f172a',
    padding: '32px',
  } as React.CSSProperties,
  footerText: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '13px',
    color: '#475569',
    margin: 0,
  } as React.CSSProperties,
};

export default function Home() {
  const [alphaBadgeHovered, setAlphaBadgeHovered] = useState(false);
  return (
    <>
      <Head>
        <title>CapTable — Equity Management for Founders</title>
        <meta name="description" content="Precise, auditable cap table management for modern companies" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.body}>
        {/* Nav */}
        <nav style={styles.nav}>
          <PiconLogo size={34} variant="light" />
          <span style={styles.navBrand}>CapTable
            <span
              style={styles.alphaBadgeWrap}
              onMouseEnter={() => setAlphaBadgeHovered(true)}
              onMouseLeave={() => setAlphaBadgeHovered(false)}
            >
              <span style={styles.alphaBadge}>Alpha</span>
              {alphaBadgeHovered && (
                <span style={styles.alphaTooltip}>
                  ⚠ This app is under rapid development and is currently for educational uses only.
                </span>
              )}
            </span>
          </span>
          <span style={styles.navSub}>Manage equity &amp; ownership</span>
        </nav>

        {/* Hero */}
        <section style={styles.hero}>
          <div style={styles.heroInner}>
            <div style={styles.heroLogoWrap}>
              <PiconLogo size={88} variant="light" />
            </div>
            <h1 style={styles.heroH1}>
              Equity management<br />
              <span style={styles.heroAccent}>built for founders</span>
            </h1>
            <p style={styles.heroLead}>
              Precise, auditable, open source cap table management with an immutable ledger.
            </p>
            <p style={styles.heroSub}>
              Multi-tenant SaaS with strict data isolation and financial-grade precision math.
            </p>
            <div style={styles.ctaRow}>
              <a href="/signup" style={styles.btnPrimary}>Get Started</a>
              <a href="/login" style={styles.btnSecondary}>Sign In</a>
            </div>
          </div>
        </section>

        {/* Demo Cards Strip */}
        <section style={styles.demoStrip}>
          <div style={styles.demoCard}>
            <p style={styles.demoLabel}>YOUR OWNERSHIP</p>
            <p style={styles.demoValue}>4.25%</p>
            <div style={styles.demoMeta}>
              <div><strong style={styles.demoMetaStrong}>125,000</strong> shares</div>
              <div><strong style={styles.demoMetaStrong}>2.5M</strong> outstanding</div>
            </div>
          </div>
          <div style={styles.demoCardAmber}>
            <p style={styles.demoLabel}>LAST ROUND</p>
            <p style={styles.demoValueAmber}>Series A</p>
            <div style={styles.demoMeta}>
              <div><strong style={styles.demoMetaStrong}>$8M</strong> raised</div>
              <div><strong style={styles.demoMetaStrong}>$40M</strong> post-money</div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={styles.features}>
          <div style={styles.featuresGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureIconWrap}>
                <LedgerIcon />
              </div>
              <h3 style={styles.featureTitle}>Immutable Ledger</h3>
              <p style={styles.featureDesc}>
                Every equity event is recorded in an append-only ledger with cryptographic integrity checks.
                Nothing is ever deleted or modified.
              </p>
            </div>

            <div style={styles.featureCardAmber}>
              <div style={styles.featureIconWrapAmber}>
                <ShieldIcon />
              </div>
              <h3 style={styles.featureTitle}>Multi-Tenant Safe</h3>
              <p style={styles.featureDesc}>
                Strict data isolation at the database layer prevents horizontal privilege escalation.
                Your data never touches another tenant's.
              </p>
            </div>

            <div style={styles.featureCard}>
              <div style={styles.featureIconWrap}>
                <PrecisionIcon />
              </div>
              <h3 style={styles.featureTitle}>Financial Precision</h3>
              <p style={styles.featureDesc}>
                All calculations use arbitrary precision math. No floating-point errors in equity
                percentages or share counts — ever.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ ...styles.footer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={styles.footerText}>
            &copy; {new Date().getFullYear()} Consort Labs &middot;{' '}
            <a href="https://consortlabs.com" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b' }}>consortlabs.com</a>
          </p>
          <p style={{ ...styles.footerText, display: 'flex', gap: '20px' }}>
            <a href="/privacy" style={{ color: '#64748b' }}>Privacy</a>
            <a href="/terms" style={{ color: '#64748b' }}>Terms</a>
          </p>
        </footer>
      </div>
    </>
  );
}
