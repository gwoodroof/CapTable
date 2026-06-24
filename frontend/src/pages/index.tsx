import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Cap Table - Multi-tenant Equity Management SaaS</title>
        <meta name="description" content="Precise, auditable cap table management for modern companies" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-brand-dark to-brand-dark/90">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center">
            {/* Brand Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-brand-primary via-brand-accent to-brand-light flex items-center justify-center">
                <span className="text-3xl font-bold text-white">CT</span>
              </div>
            </div>

            <h1 className="text-5xl font-bold text-white mb-4">Cap Table</h1>
            <p className="text-xl text-gray-300 mb-8">
              Precise, auditable equity management for modern companies
            </p>
            <p className="text-gray-400 mb-12 max-w-2xl mx-auto">
              Built for founders and CFOs. Multi-tenant SaaS with immutable ledger tracking,
              strict multi-tenancy, and financial precision.
            </p>

            <div className="flex gap-4 justify-center">
              <a href="/admin" className="btn btn-primary">
                Admin Dashboard
              </a>
              <a href="/holder" className="btn btn-secondary">
                Holder Portal
              </a>
            </div>
          </div>

          {/* Feature Grid */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card p-6">
              <h3 className="text-xl font-bold text-brand-primary mb-2">Immutable Ledger</h3>
              <p className="text-gray-600">Every equity event is recorded in an append-only ledger with cryptographic integrity checks.</p>
            </div>

            <div className="card p-6">
              <h3 className="text-xl font-bold text-brand-accent mb-2">Multi-Tenant Safe</h3>
              <p className="text-gray-600">Strict data isolation at the database layer prevents horizontal privilege escalation.</p>
            </div>

            <div className="card p-6">
              <h3 className="text-xl font-bold text-brand-primary mb-2">Financial Precision</h3>
              <p className="text-gray-600">All calculations use arbitrary precision math. No floating-point errors, ever.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
