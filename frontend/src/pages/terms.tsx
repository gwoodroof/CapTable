import React from 'react';
import Head from 'next/head';

function PiconLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M 145.9 165.5 A 80 80 0 0 1 54.1 165.5 L 77.1 132.8 A 40 40 0 0 0 122.9 132.8 Z" fill="#1e293b" />
      <path d="M 54.1 165.5 A 80 80 0 0 1 54.1 34.5 L 77.1 67.2 A 40 40 0 0 0 77.1 132.8 Z" fill="#f59e0b" />
      <path d="M 54.1 34.5 A 80 80 0 0 1 145.9 34.5 L 122.9 67.2 A 40 40 0 0 0 77.1 67.2 Z" fill="#0066cc" />
    </svg>
  );
}

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — CapTable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
          <h1 style={h1}>Terms of Service</h1>
          <p style={lead}>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the CapTable platform and related services provided
            by Consort Labs, Inc. (&ldquo;Consort Labs,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). By creating an account or using the
            service, you agree to be bound by these Terms. If you are accepting on behalf of a company or other legal entity, you represent
            that you have authority to bind that entity.
          </p>

          <Section title="1. Description of Service">
            <p style={p}>
              CapTable is a multi-tenant, cloud-based equity management platform that enables companies to record, track, and analyze
              their capitalization tables, equity grants, vesting schedules, and related transactions. The service is provided as
              software-as-a-service (SaaS) and is accessed via web browser.
            </p>
            <p style={p}>
              CapTable is a record-keeping and organizational tool. It does not constitute legal, financial, tax, or investment advice.
              You are solely responsible for ensuring the accuracy of the information you enter and for consulting qualified professionals
              regarding any legal or financial decisions.
            </p>
          </Section>

          <Section title="2. Account Registration">
            <p style={p}>
              To use CapTable, you must create an account by providing a valid email address, a company name, and either a password or
              a linked Google account. You agree to provide accurate, current, and complete information and to keep it updated.
            </p>
            <p style={p}>
              You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your
              account. Notify us immediately at <a href="mailto:security@consortlabs.com" style={link}>security@consortlabs.com</a> if
              you suspect unauthorized access to your account.
            </p>
            <p style={p}>
              One account corresponds to one tenant organization. You may not create accounts on behalf of others without their
              knowledge or share account credentials with people outside your organization.
            </p>
          </Section>

          <Section title="3. Acceptable Use">
            <p style={p}>You agree not to use CapTable to:</p>
            <ul style={ul}>
              <li>Enter false, fraudulent, or misleading equity or ownership information</li>
              <li>Attempt to access another tenant&rsquo;s data or circumvent multi-tenant isolation controls</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code of the platform</li>
              <li>Probe, scan, or test the vulnerability of any system or network without written authorization</li>
              <li>Introduce malware, viruses, or other malicious code</li>
              <li>Use the service in any manner that violates applicable law or regulation, including securities laws</li>
              <li>Resell, sublicense, or otherwise commercialize access to the platform without our written consent</li>
            </ul>
            <p style={p}>
              We reserve the right to suspend or terminate any account that we reasonably believe is in violation of these Terms,
              without prior notice where necessary to protect the platform or other users.
            </p>
          </Section>

          <Section title="4. Subscription and Payment">
            <p style={p}>
              CapTable may offer free and paid subscription tiers. The features available under each tier are described on our pricing
              page. By subscribing to a paid plan, you authorize Consort Labs to charge your payment method on a recurring basis at the
              rate in effect at the time of purchase.
            </p>
            <p style={p}>
              All fees are non-refundable except as required by applicable law or as expressly stated in a written agreement. We may
              change our pricing at any time with at least 30 days&rsquo; notice. Continued use of the paid plan after a price change
              constitutes acceptance of the new price.
            </p>
            <p style={p}>
              If payment fails, we may downgrade or suspend your account after a reasonable grace period. You remain responsible for
              any amounts owed.
            </p>
          </Section>

          <Section title="5. Your Data">
            <p style={p}>
              You retain all rights to the cap table data and other content you submit to CapTable (&ldquo;Customer Data&rdquo;). You grant
              Consort Labs a limited, non-exclusive license to store, process, and display your Customer Data solely to provide the
              service to you.
            </p>
            <p style={p}>
              We will not access your Customer Data except to provide and support the service, to comply with legal obligations, or
              with your explicit permission. We implement strict tenant isolation so that no other organization can access your data.
            </p>
            <p style={p}>
              You are responsible for the accuracy and legality of the Customer Data you submit. We are not responsible for errors
              in your cap table that result from inaccurate input.
            </p>
          </Section>

          <Section title="6. Intellectual Property">
            <p style={p}>
              The CapTable platform — including its software, design, trademarks, and documentation — is the exclusive property of
              Consort Labs and is protected by copyright, trademark, and other intellectual property laws. These Terms do not grant
              you any right, title, or interest in the platform beyond the limited license to use the service as described here.
            </p>
            <p style={p}>
              If you submit feedback, suggestions, or ideas about CapTable, you grant Consort Labs a perpetual, irrevocable,
              royalty-free license to use that feedback for any purpose without obligation to you.
            </p>
          </Section>

          <Section title="7. Confidentiality">
            <p style={p}>
              Each party agrees to keep the other party&rsquo;s confidential information — including non-public technical, financial, or
              business information — strictly confidential, using at least the same degree of care it uses to protect its own
              confidential information, but no less than reasonable care. This obligation does not apply to information that is
              publicly available, independently developed, or required to be disclosed by law.
            </p>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            <p style={p}>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND. TO THE FULLEST EXTENT PERMITTED
              BY LAW, CONSORT LABS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
              OR FREE OF HARMFUL COMPONENTS, OR THAT ANY DEFECTS WILL BE CORRECTED.
            </p>
            <p style={p}>
              CAPTABLE IS NOT A LICENSED SECURITIES, LEGAL, OR FINANCIAL ADVISOR. NOTHING IN THE SERVICE CONSTITUTES LEGAL OR
              FINANCIAL ADVICE, AND YOU SHOULD SEEK QUALIFIED PROFESSIONAL GUIDANCE FOR ALL SUCH MATTERS.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p style={p}>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CONSORT LABS, ITS OFFICERS, DIRECTORS, EMPLOYEES,
              OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING LOSS OF
              PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION — ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO
              USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p style={p}>
              IN NO EVENT SHALL CONSORT LABS&rsquo;S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE
              TERMS OR THE SERVICE EXCEED THE GREATER OF (A) THE FEES YOU PAID TO CONSORT LABS IN THE TWELVE MONTHS PRECEDING THE
              CLAIM OR (B) ONE HUNDRED DOLLARS (USD $100).
            </p>
            <p style={p}>
              SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO THE ABOVE LIMITATIONS MAY NOT
              APPLY TO YOU.
            </p>
          </Section>

          <Section title="10. Indemnification">
            <p style={p}>
              You agree to indemnify, defend, and hold harmless Consort Labs and its officers, directors, employees, and agents from
              and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys&rsquo; fees) arising out
              of or in any way connected with: (a) your access to or use of the service; (b) your Customer Data; (c) your violation
              of these Terms; or (d) your violation of any applicable law or the rights of any third party.
            </p>
          </Section>

          <Section title="11. Termination">
            <p style={p}>
              You may cancel your account at any time through the account settings page. Upon cancellation, your right to access the
              service will terminate at the end of your current billing period.
            </p>
            <p style={p}>
              We may suspend or terminate your account immediately if you breach these Terms, if required by law, or if we discontinue
              the service. Upon termination, we will make your Customer Data available for export for 30 days, after which it will be
              deleted in accordance with our Privacy Policy.
            </p>
            <p style={p}>
              Sections 5 (Your Data — license grants survive termination with respect to any residual data during the export window),
              6, 7, 8, 9, 10, and 12 survive termination.
            </p>
          </Section>

          <Section title="12. Governing Law and Disputes">
            <p style={p}>
              These Terms are governed by and construed in accordance with the laws of the State of Delaware, without regard to its
              conflict-of-law principles. Any dispute arising out of or relating to these Terms or the service shall be resolved
              exclusively by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration
              Rules, except that either party may seek injunctive or other equitable relief in any court of competent jurisdiction to
              prevent actual or threatened infringement of intellectual property rights.
            </p>
            <p style={p}>
              You waive any right to participate in a class-action lawsuit or class-wide arbitration against Consort Labs.
            </p>
          </Section>

          <Section title="13. Changes to These Terms">
            <p style={p}>
              We may revise these Terms from time to time. When we make material changes, we will update the effective date above and
              notify you by email or in-app notice at least 14 days before the changes take effect. Your continued use of the service
              after the effective date constitutes acceptance of the revised Terms. If you do not agree to the revised Terms, you must
              stop using the service and cancel your account before the effective date.
            </p>
          </Section>

          <Section title="14. General">
            <p style={p}>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Consort Labs with respect
              to the service and supersede all prior agreements. If any provision of these Terms is found to be unenforceable, the
              remaining provisions will continue in full force. Our failure to enforce any right or provision is not a waiver of that
              right. You may not assign these Terms without our prior written consent; we may assign them freely.
            </p>
          </Section>

          <Section title="15. Contact Us">
            <p style={p}>
              Consort Labs, Inc.<br />
              Legal inquiries: <a href="mailto:legal@consortlabs.com" style={link}>legal@consortlabs.com</a><br />
              Website: <a href="https://consortlabs.com" target="_blank" rel="noopener noreferrer" style={link}>consortlabs.com</a>
            </p>
          </Section>
        </main>

        {/* Footer */}
        <footer style={{ background: '#0f172a', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', color: '#475569', margin: 0 }}>
            &copy; {new Date().getFullYear()} Consort Labs &middot;{' '}
            <a href="https://consortlabs.com" target="_blank" rel="noopener noreferrer" style={{ color: '#475569' }}>consortlabs.com</a>
            {' '}&middot;{' '}
            <a href="/privacy" style={{ color: '#475569' }}>Privacy</a>
            {' '}&middot;{' '}
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
