import React from 'react';
import Head from 'next/head';

function PiconLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M 145.9 165.5 A 80 80 0 0 1 54.1 165.5 L 77.1 132.8 A 40 40 0 0 0 122.9 132.8 Z" fill="#f0f4f8" />
      <path d="M 54.1 165.5 A 80 80 0 0 1 54.1 34.5 L 77.1 67.2 A 40 40 0 0 0 77.1 132.8 Z" fill="#f59e0b" />
      <path d="M 54.1 34.5 A 80 80 0 0 1 145.9 34.5 L 122.9 67.2 A 40 40 0 0 0 77.1 67.2 Z" fill="#0066cc" />
    </svg>
  );
}

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', background: '#f8f9fb', display: 'flex', flexDirection: 'column' }}>
        {/* Nav */}
        <nav style={{ background: '#0f172a', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <PiconLogo size={34} />
            <span style={{ fontWeight: 700, fontSize: '20px', color: 'white' }}>CapTable</span>
          </a>
        </nav>

        {/* Content */}
        <main style={{ flex: 1, maxWidth: '760px', margin: '0 auto', padding: '64px 32px 80px', width: '100%' }}>
          <p style={meta}>Effective June 24, 2026</p>
          <h1 style={h1}>Privacy Policy</h1>
          <p style={lead}>
            Consort Labs, Inc. (&ldquo;Consort Labs,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the
            CapTable platform. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our
            service. Please read it carefully. By using CapTable you agree to the practices described here.
          </p>

          <Section title="1. Information We Collect">
            <p style={p}><strong>Account information.</strong> When you register, we collect your name, email address, company name, and a hashed credential (password or Google OAuth token). We never store plaintext passwords.</p>
            <p style={p}><strong>Cap table data.</strong> We store the equity and ownership information you enter — stakeholders, share classes, transactions, grants, vesting schedules, and related financial data. This data belongs to you and is processed solely to provide the service.</p>
            <p style={p}><strong>Usage and log data.</strong> We automatically collect server logs, IP addresses, browser type, referring URLs, and timestamps of actions taken within the platform. These help us maintain security, diagnose issues, and improve reliability.</p>
            <p style={p}><strong>Cookies and local storage.</strong> We use a session token stored in your browser&rsquo;s local storage to keep you signed in. We do not use third-party advertising cookies or tracking pixels.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p style={p}>We use the information we collect to:</p>
            <ul style={ul}>
              <li>Provide, operate, and maintain the CapTable platform</li>
              <li>Authenticate users and enforce tenant data isolation</li>
              <li>Respond to support requests and communicate service updates</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
              <li>Analyze aggregate, anonymized usage patterns to improve the product</li>
            </ul>
            <p style={p}>We do not sell your personal information or your cap table data to any third party, ever.</p>
          </Section>

          <Section title="3. Data Sharing and Disclosure">
            <p style={p}>We share information only in the following limited circumstances:</p>
            <ul style={ul}>
              <li><strong>Service providers.</strong> We engage sub-processors (cloud hosting, email delivery, error monitoring) who process data on our behalf under confidentiality obligations and our instructions.</li>
              <li><strong>Legal requirements.</strong> We may disclose information if required by law, regulation, court order, or governmental authority, or to protect the rights, property, or safety of Consort Labs, our customers, or the public.</li>
              <li><strong>Business transfers.</strong> In the event of a merger, acquisition, or sale of all or substantially all of our assets, your information may be transferred. We will notify you before your data is subject to a materially different privacy policy.</li>
              <li><strong>With your consent.</strong> We may share information for any other purpose with your explicit consent.</li>
            </ul>
          </Section>

          <Section title="4. Data Security">
            <p style={p}>
              CapTable is built with security as a first-class requirement. Tenant data is strictly isolated at the database layer; no query touches another organization&rsquo;s records. All data is encrypted in transit (TLS 1.2+) and at rest. Our ledger is append-only with cryptographic chaining, making unauthorized modification detectable.
            </p>
            <p style={p}>
              No method of transmission or storage is 100% secure. We maintain industry-standard controls and will notify you without undue delay in the event of a breach that affects your personal data.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p style={p}>
              We retain your account and cap table data for as long as your account is active or as needed to provide the service. If you close your account, we will delete or anonymize your personal data within 90 days, except where we are required to retain it for legal, tax, or regulatory purposes.
            </p>
            <p style={p}>
              Ledger transaction records may be retained in anonymized form for longer periods for audit and integrity purposes.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p style={p}>Depending on your jurisdiction, you may have the right to:</p>
            <ul style={ul}>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your personal data (subject to legal retention obligations)</li>
              <li>Export your cap table data in a portable format</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p style={p}>To exercise any of these rights, contact us at <a href="mailto:privacy@consortlabs.com" style={link}>privacy@consortlabs.com</a>. We will respond within 30 days.</p>
          </Section>

          <Section title="7. Cookies">
            <p style={p}>
              We use a single first-party session token stored in <code style={code}>localStorage</code> to authenticate your requests. We do not set third-party cookies or use cross-site tracking. You may clear your browser&rsquo;s local storage at any time, which will sign you out.
            </p>
          </Section>

          <Section title="8. Children&rsquo;s Privacy">
            <p style={p}>
              CapTable is a professional tool intended for use by adults in a business context. We do not knowingly collect personal information from anyone under 16 years of age. If you believe a minor has provided us information, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p style={p}>
              We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date above and notify you by email or via an in-app notice at least 14 days before the change takes effect. Continued use of CapTable after the effective date constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p style={p}>
              Consort Labs, Inc.<br />
              Privacy inquiries: <a href="mailto:privacy@consortlabs.com" style={link}>privacy@consortlabs.com</a><br />
              Website: <a href="https://consortlabs.com" target="_blank" rel="noopener noreferrer" style={link}>consortlabs.com</a>
            </p>
          </Section>
        </main>

        {/* Footer */}
        <footer style={{ background: '#0f172a', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', color: '#475569', margin: 0 }}>
            &copy; {new Date().getFullYear()} Consort Labs &middot;{' '}
            <a href="https://consortlabs.com" target="_blank" rel="noopener noreferrer" style={{ color: '#475569' }}>consortlabs.com</a>
          </p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', color: '#475569', margin: 0, display: 'flex', gap: '20px' }}>
            <a href="/privacy" style={{ color: '#475569' }}>Privacy</a>
            <a href="/terms" style={{ color: '#475569' }}>Terms</a>
          </p>
        </footer>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: '48px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const h1: React.CSSProperties = {
  fontSize: '38px',
  fontWeight: 800,
  color: '#0f172a',
  margin: '12px 0 24px',
  lineHeight: 1.2,
};

const meta: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0 0 4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontWeight: 600,
};

const lead: React.CSSProperties = {
  fontSize: '16px',
  color: '#475569',
  lineHeight: 1.75,
  margin: '0 0 8px',
};

const p: React.CSSProperties = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: 1.75,
  margin: '0 0 14px',
};

const ul: React.CSSProperties = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: 1.75,
  margin: '0 0 14px',
  paddingLeft: '24px',
};

const link: React.CSSProperties = {
  color: '#0066cc',
  textDecoration: 'none',
};

const code: React.CSSProperties = {
  fontFamily: 'monospace',
  background: '#f0f4f8',
  padding: '1px 5px',
  borderRadius: '4px',
  fontSize: '13px',
  color: '#334155',
};
