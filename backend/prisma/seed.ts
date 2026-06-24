import { PrismaClient, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ── Hashing helpers ───────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// Maintains the rolling chain state across all ledger inserts.
let prevChainHash: string | null = null;

function buildHashes(txData: Record<string, unknown>): {
  dataHash: string;
  previousRowHash: string | null;
  chainHash: string;
} {
  const dataHash = sha256(JSON.stringify(txData));
  const previousRowHash = prevChainHash;
  const chainHash = sha256(dataHash + (prevChainHash ?? ''));
  prevChainHash = chainHash;
  return { dataHash, previousRowHash, chainHash };
}

// ── Date constants ────────────────────────────────────────────────────────────

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const FOUNDED        = d('2024-06-24'); // exactly 2 years ago
const SEED_CLOSE     = d('2024-08-15');
const ALICE_START    = d('2024-09-01');
const BOB_START      = d('2024-12-01');
const CAROL_START    = d('2025-03-01');
const ALICE_CLIFF    = d('2025-09-01'); // 12 months after Alice start
const BOB_CLIFF      = d('2025-12-01'); // 12 months after Bob start
const CAROL_CLIFF    = d('2026-03-01'); // 12 months after Carol start
const TODAY          = d('2026-06-24');

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding Acme, Inc. cap table...\n');

  // ── Wipe existing data (reverse FK order) ─────────────────────────────────
  await prisma.capTableSnapshot.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.grant.deleteMany();
  await prisma.vestingSchedule.deleteMany();
  await prisma.equityPool.deleteMany();
  await prisma.security.deleteMany();
  await prisma.stakeholder.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  console.log('  ✓ Cleared existing data');

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Acme, Inc.',
      authorizedShares: '10000000',   // 10 M authorized shares
      parValue:         '0.0001',     // $0.0001 par value
      createdAt:        FOUNDED,
    },
  });
  const tid = tenant.id;
  console.log(`  ✓ Tenant: ${tenant.name} (${tid})`);

  // ── Admin user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password', 12);
  await prisma.user.create({
    data: {
      email:        'gwoodroof@gmail.com',
      passwordHash,
      role:         'ADMIN',
      tenantId:     tid,
      createdAt:    FOUNDED,
    },
  });
  console.log('  ✓ User: gwoodroof@gmail.com (ADMIN)');

  await prisma.user.create({
    data: {
      email:        'sarah.kim@angel.vc',
      passwordHash,
      role:         'INVESTOR',
      tenantId:     tid,
      createdAt:    SEED_CLOSE,
    },
  });
  console.log('  ✓ User: sarah.kim@angel.vc (INVESTOR)');

  await prisma.user.create({
    data: {
      email:        'alice.chen@acmeinc.com',
      passwordHash,
      role:         'STAKEHOLDER',
      tenantId:     tid,
      createdAt:    ALICE_START,
    },
  });
  console.log('  ✓ User: alice.chen@acmeinc.com (STAKEHOLDER)');

  // ── Securities ────────────────────────────────────────────────────────────
  const commonStock = await prisma.security.create({
    data: {
      type:      'COMMON_STOCK',
      name:      'Common Stock',
      tenantId:  tid,
      createdAt: FOUNDED,
    },
  });

  const preferredStock = await prisma.security.create({
    data: {
      type:      'PREFERRED_STOCK',
      name:      'Series Seed Preferred',
      tenantId:  tid,
      createdAt: SEED_CLOSE,
    },
  });

  const stockOption = await prisma.security.create({
    data: {
      type:      'OPTION',
      name:      '2024 Stock Option Plan',
      tenantId:  tid,
      createdAt: ALICE_START,
    },
  });
  console.log('  ✓ Securities: Common, Series Seed Preferred, Options');

  // ── Equity pool ───────────────────────────────────────────────────────────
  await prisma.equityPool.create({
    data: {
      name:             '2024 Equity Incentive Plan',
      authorizedShares: '1500000',  // 1.5 M option pool
      tenantId:         tid,
      createdAt:        ALICE_START,
    },
  });
  console.log('  ✓ Equity pool: 1,500,000 shares');

  // ── Vesting schedule ──────────────────────────────────────────────────────
  const vestSched = await prisma.vestingSchedule.create({
    data: {
      name:                 '4-Year Vest, 1-Year Cliff',
      cliffMonths:          12,
      vestingDurationMonths: 48,
      vestingFrequency:     'MONTHLY',
      tenantId:             tid,
      createdAt:            FOUNDED,
    },
  });
  console.log('  ✓ Vesting schedule: 4yr/1yr cliff, monthly');

  // ── Stakeholders ──────────────────────────────────────────────────────────
  const gary = await prisma.stakeholder.create({
    data: {
      name:      'Gary Woodroof',
      email:     'gwoodroof@gmail.com',
      type:      'INDIVIDUAL',
      tenantId:  tid,
      createdAt: FOUNDED,
    },
  });

  const alice = await prisma.stakeholder.create({
    data: {
      name:      'Alice Chen',
      email:     'alice.chen@acmeinc.com',
      type:      'INDIVIDUAL',
      tenantId:  tid,
      createdAt: ALICE_START,
    },
  });

  const bob = await prisma.stakeholder.create({
    data: {
      name:      'Bob Martinez',
      email:     'bob.martinez@acmeinc.com',
      type:      'INDIVIDUAL',
      tenantId:  tid,
      createdAt: BOB_START,
    },
  });

  const carol = await prisma.stakeholder.create({
    data: {
      name:      'Carol Singh',
      email:     'carol.singh@acmeinc.com',
      type:      'INDIVIDUAL',
      tenantId:  tid,
      createdAt: CAROL_START,
    },
  });

  const redpoint = await prisma.stakeholder.create({
    data: {
      name:      'Redpoint Ventures',
      // no email — entity investor
      type:      'ENTITY',
      tenantId:  tid,
      createdAt: SEED_CLOSE,
    },
  });

  const sarahKim = await prisma.stakeholder.create({
    data: {
      name:      'Sarah Kim',
      email:     'sarah.kim@angel.vc',
      type:      'INDIVIDUAL',
      tenantId:  tid,
      createdAt: SEED_CLOSE,
    },
  });
  console.log('  ✓ Stakeholders: Gary, Alice, Bob, Carol, Redpoint, Sarah Kim');

  // ── Grants ────────────────────────────────────────────────────────────────
  // Gary — 5,000,000 common shares, 4yr/1yr cliff from founding
  await prisma.grant.create({
    data: {
      stakeholderId:     gary.id,
      securityId:        commonStock.id,
      quantity:          '5000000',
      grantDate:         FOUNDED,
      boardApprovalDate: FOUNDED,
      vestingScheduleId: vestSched.id,
      tenantId:          tid,
      createdAt:         FOUNDED,
    },
  });

  // Alice — 250,000 options @ $0.10, VP Engineering
  await prisma.grant.create({
    data: {
      stakeholderId:     alice.id,
      securityId:        stockOption.id,
      quantity:          '250000',
      strikePrice:       '0.10',
      grantDate:         ALICE_START,
      boardApprovalDate: ALICE_START,
      vestingScheduleId: vestSched.id,
      tenantId:          tid,
      createdAt:         ALICE_START,
    },
  });

  // Bob — 150,000 options @ $0.10, Lead Designer
  await prisma.grant.create({
    data: {
      stakeholderId:     bob.id,
      securityId:        stockOption.id,
      quantity:          '150000',
      strikePrice:       '0.10',
      grantDate:         BOB_START,
      boardApprovalDate: BOB_START,
      vestingScheduleId: vestSched.id,
      tenantId:          tid,
      createdAt:         BOB_START,
    },
  });

  // Carol — 100,000 options @ $0.10, Head of Sales
  await prisma.grant.create({
    data: {
      stakeholderId:     carol.id,
      securityId:        stockOption.id,
      quantity:          '100000',
      strikePrice:       '0.10',
      grantDate:         CAROL_START,
      boardApprovalDate: CAROL_START,
      vestingScheduleId: vestSched.id,
      tenantId:          tid,
      createdAt:         CAROL_START,
    },
  });
  console.log('  ✓ Grants: Gary 5M common, Alice 250K opts, Bob 150K opts, Carol 100K opts');

  // ── Ledger transactions ───────────────────────────────────────────────────
  // Helper that appends one entry to the chain.
  async function ledger(params: {
    type:         TransactionType;
    stakeholder:  { id: string };
    security:     { id: string };
    quantity:     string;
    price?:       string;
    timestamp:    Date;
  }) {
    const raw = {
      tenantId:        tid,
      transactionType: params.type,
      stakeholderId:   params.stakeholder.id,
      securityId:      params.security.id,
      quantity:        params.quantity,
      pricePerShare:   params.price ?? null,
      timestamp:       params.timestamp.toISOString(),
    };
    const { dataHash, previousRowHash, chainHash } = buildHashes(raw);
    await prisma.ledgerTransaction.create({
      data: {
        tenantId:        tid,
        transactionType: params.type,
        stakeholderId:   params.stakeholder.id,
        securityId:      params.security.id,
        quantity:        params.quantity,
        pricePerShare:   params.price ?? null,
        timestamp:       params.timestamp,
        dataHash,
        previousRowHash,
        chainHash,
        createdAt:       params.timestamp,
      },
    });
  }

  // ── Issuances ─────────────────────────────────────────────────────────────
  // Jun 24 2024 — Gary's founding shares
  await ledger({
    type:       'ISSUANCE',
    stakeholder: gary,
    security:   commonStock,
    quantity:   '5000000',
    price:      '0.0001',   // par value
    timestamp:  FOUNDED,
  });

  // Aug 15 2024 — Series Seed: Redpoint $1.5M @ $1.00/share → 1,500,000 shares
  await ledger({
    type:       'ISSUANCE',
    stakeholder: redpoint,
    security:   preferredStock,
    quantity:   '1500000',
    price:      '1.00',
    timestamp:  SEED_CLOSE,
  });

  // Aug 15 2024 — Series Seed: Sarah Kim $500K @ $1.00/share → 500,000 shares
  await ledger({
    type:       'ISSUANCE',
    stakeholder: sarahKim,
    security:   preferredStock,
    quantity:   '500000',
    price:      '1.00',
    timestamp:  SEED_CLOSE,
  });

  // Sep 1 2024 — Alice options grant
  await ledger({
    type:       'ISSUANCE',
    stakeholder: alice,
    security:   stockOption,
    quantity:   '250000',
    price:      '0.10',
    timestamp:  ALICE_START,
  });

  // Dec 1 2024 — Bob options grant
  await ledger({
    type:       'ISSUANCE',
    stakeholder: bob,
    security:   stockOption,
    quantity:   '150000',
    price:      '0.10',
    timestamp:  BOB_START,
  });

  // Mar 1 2025 — Carol options grant
  await ledger({
    type:       'ISSUANCE',
    stakeholder: carol,
    security:   stockOption,
    quantity:   '100000',
    price:      '0.10',
    timestamp:  CAROL_START,
  });

  console.log('  ✓ Ledger: 6 issuances recorded');

  // ── Vesting events ────────────────────────────────────────────────────────
  //
  // Alice: 250,000 options, 4yr/1yr cliff from Sep 2024
  //   Cliff vest (Sep 2025):    250,000 × 12/48 = 62,500
  //   Monthly thereafter:       250,000 / 48   = 5,208.33 → use 5,208
  //   Months vested post-cliff (Oct 2025–Jun 2026): 9
  //
  await ledger({
    type:       'VEST',
    stakeholder: alice,
    security:   stockOption,
    quantity:   '62500',
    timestamp:  ALICE_CLIFF,
  });
  for (let m = 1; m <= 9; m++) {
    const ts = new Date(ALICE_CLIFF);
    ts.setUTCMonth(ts.getUTCMonth() + m);
    await ledger({ type: 'VEST', stakeholder: alice, security: stockOption, quantity: '5208', timestamp: ts });
  }
  // Alice total vested: 62,500 + 9×5,208 = 109,372 / 250,000

  //
  // Bob: 150,000 options, 4yr/1yr cliff from Dec 2024
  //   Cliff vest (Dec 2025):    150,000 × 12/48 = 37,500
  //   Monthly thereafter:       150,000 / 48   = 3,125 exactly
  //   Months post-cliff (Jan–Jun 2026): 6
  //
  await ledger({
    type:       'VEST',
    stakeholder: bob,
    security:   stockOption,
    quantity:   '37500',
    timestamp:  BOB_CLIFF,
  });
  for (let m = 1; m <= 6; m++) {
    const ts = new Date(BOB_CLIFF);
    ts.setUTCMonth(ts.getUTCMonth() + m);
    await ledger({ type: 'VEST', stakeholder: bob, security: stockOption, quantity: '3125', timestamp: ts });
  }
  // Bob total vested: 37,500 + 6×3,125 = 56,250 / 150,000

  //
  // Carol: 100,000 options, 4yr/1yr cliff from Mar 2025
  //   Cliff vest (Mar 2026):    100,000 × 12/48 = 25,000
  //   Monthly thereafter:       100,000 / 48   = 2,083.33 → use 2,083
  //   Months post-cliff (Apr–Jun 2026): 3
  //
  await ledger({
    type:       'VEST',
    stakeholder: carol,
    security:   stockOption,
    quantity:   '25000',
    timestamp:  CAROL_CLIFF,
  });
  for (let m = 1; m <= 3; m++) {
    const ts = new Date(CAROL_CLIFF);
    ts.setUTCMonth(ts.getUTCMonth() + m);
    await ledger({ type: 'VEST', stakeholder: carol, security: stockOption, quantity: '2083', timestamp: ts });
  }
  // Carol total vested: 25,000 + 3×2,083 = 31,249 / 100,000

  console.log('  ✓ Ledger: vesting events recorded');
  console.log(`            Alice  vested: 109,372 / 250,000 (43.7%)`);
  console.log(`            Bob    vested:  56,250 / 150,000 (37.5%)`);
  console.log(`            Carol  vested:  31,249 / 100,000 (31.2%)`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Cap table summary (as of June 2026) ─────────────────────────');
  console.log('  Authorized shares:  10,000,000');
  console.log('  Outstanding (basic):  7,000,000  (5M common + 2M Series Seed preferred)');
  console.log('  Fully diluted:        7,500,000  (+ 500K granted options)');
  console.log('');
  console.log('  Gary Woodroof   5,000,000 common       66.7% FD');
  console.log('  Redpoint Vent.  1,500,000 Series Seed  20.0% FD');
  console.log('  Sarah Kim         500,000 Series Seed   6.7% FD');
  console.log('  Alice Chen        250,000 options        3.3% FD');
  console.log('  Bob Martinez      150,000 options        2.0% FD');
  console.log('  Carol Singh       100,000 options        1.3% FD');
  console.log('  Option pool (unalloc.) 1,000,000 reserved');
  console.log('');
  console.log('  Series Seed: $2M raised  |  $4M pre-money  |  $6M post-money');
  console.log('────────────────────────────────────────────────────────────────\n');
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
