/**
 * Integration tests: LedgerService + GrantService + TenantService wired together
 * with a single shared mock Prisma. These tests verify cross-service contracts:
 *  - GrantService correctly delegates to LedgerService
 *  - Ledger entries produced by grants are reflected in balance queries
 *  - TenantService.getTotalIssuedShares aggregates what the ledger contains
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { GrantService } from '../../src/modules/grant/grant.service';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { AuditTrail } from '../../src/common/utils/audit-trail';

const T1 = 'tenant-1';
const SH1 = 'sh-1';
const SH2 = 'sh-2';
const SEC1 = 'sec-1';
const VS1 = 'vs-1';

// Shared in-memory store that simulates the database across services
const makePrisma = () => {
  const ledgerStore: any[] = [];

  const p = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: T1 }),
      create: vi.fn(),
    },
    stakeholder: {
      findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
        const map: Record<string, any> = {
          [SH1]: { id: SH1, tenantId: T1 },
          [SH2]: { id: SH2, tenantId: T1 },
        };
        return Promise.resolve(map[id] ?? null);
      }),
    },
    security: {
      findUnique: vi.fn().mockResolvedValue({ id: SEC1, tenantId: T1 }),
    },
    vestingSchedule: {
      findUnique: vi.fn().mockResolvedValue({ id: VS1, tenantId: T1 }),
    },
    grant: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: `grant-${Date.now()}`, ...data, stakeholder: {}, security: {}, vestingSchedule: {} }),
      ),
      findMany: vi.fn(),
    },
    ledgerTransaction: {
      findFirst: vi.fn().mockImplementation(({ where: { tenantId }, orderBy }) =>
        Promise.resolve(ledgerStore.filter((e) => e.tenantId === tenantId).at(-1) ?? null),
      ),
      findMany: vi.fn().mockImplementation(({ where }) => {
        let entries = ledgerStore.filter((e) => e.tenantId === where.tenantId);
        if (where.stakeholderId) entries = entries.filter((e) => e.stakeholderId === where.stakeholderId);
        if (where.securityId) entries = entries.filter((e) => e.securityId === where.securityId);
        if (where.transactionType?.in) entries = entries.filter((e) => where.transactionType.in.includes(e.transactionType));
        if (where.timestamp?.lte) entries = entries.filter((e) => e.timestamp <= where.timestamp.lte);
        return Promise.resolve(entries);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const entry = { id: `tx-${ledgerStore.length + 1}`, ...data, createdAt: new Date(), timestamp: new Date() };
        ledgerStore.push(entry);
        return Promise.resolve(entry);
      }),
    },
    _store: ledgerStore,
    withTenant: vi.fn(async (_: string, fn: (tx: any) => Promise<any>) => fn(p)),
  };
  return p;
};


describe('Integration: LedgerService + GrantService + TenantService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let ledgerService: LedgerService;
  let grantService: GrantService;
  let tenantService: TenantService;

  beforeEach(() => {
    prisma = makePrisma();
    ledgerService = new LedgerService(prisma as any);
    grantService = new GrantService(prisma as any, ledgerService);
    tenantService = new TenantService(prisma as any, ledgerService);
  });

  it('stakeholder balance increases after a grant is created', async () => {
    await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH1,
      securityId: SEC1,
      vestingScheduleId: VS1,
      quantity: '10000',
      strikePrice: '0.50',
      grantDate: '2024-01-01',
    });

    const balance = await ledgerService.getStakeholderBalance(T1, SH1, SEC1);
    expect(balance.toString()).toBe('10000');
  });

  it('tenant total issued shares grows with each grant', async () => {
    await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH1, securityId: SEC1, vestingScheduleId: VS1,
      quantity: '4000000', grantDate: '2024-01-01',
    });
    await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH2, securityId: SEC1, vestingScheduleId: VS1,
      quantity: '3000000', grantDate: '2024-01-15',
    });

    const total = await tenantService.getTotalIssuedShares(T1);
    expect(total.toString()).toBe('7000000');
  });

  it('ledger chain is valid after multiple grants', async () => {
    for (let i = 0; i < 3; i++) {
      await grantService.createGrant(T1, 'admin-user', {
        stakeholderId: SH1, securityId: SEC1, vestingScheduleId: VS1,
        quantity: '1000', grantDate: '2024-01-01',
      });
    }

    const validation = await ledgerService.validateLedgerChain(T1);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('each grant produces a ledger entry with a valid hash chain link', async () => {
    const result1 = await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH1, securityId: SEC1, vestingScheduleId: VS1,
      quantity: '5000', grantDate: '2024-01-01',
    });
    const result2 = await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH2, securityId: SEC1, vestingScheduleId: VS1,
      quantity: '3000', grantDate: '2024-02-01',
    });

    // tx2 should reference tx1's chainHash as its previousRowHash
    expect(result2.ledgerEntry.previousRowHash).toBe(result1.ledgerEntry.chainHash);
  });

  it('balances for different stakeholders are independent', async () => {
    await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH1, securityId: SEC1, vestingScheduleId: VS1,
      quantity: '8000', grantDate: '2024-01-01',
    });
    await grantService.createGrant(T1, 'admin-user', {
      stakeholderId: SH2, securityId: SEC1, vestingScheduleId: VS1,
      quantity: '2000', grantDate: '2024-01-01',
    });

    const balance1 = await ledgerService.getStakeholderBalance(T1, SH1, SEC1);
    const balance2 = await ledgerService.getStakeholderBalance(T1, SH2, SEC1);
    expect(balance1.toString()).toBe('8000');
    expect(balance2.toString()).toBe('2000');
  });

  it('historical balance (asOf) excludes transactions after the cutoff date', async () => {
    // First grant on Jan 1
    await ledgerService.recordTransaction({
      tenantId: T1, transactionType: 'ISSUANCE',
      stakeholderId: SH1, securityId: SEC1, quantity: '5000',
    });

    // Directly insert a future entry via ledger store manipulation
    const futureDate = new Date('2099-12-31');
    prisma._store.push({
      id: 'tx-future', tenantId: T1, stakeholderId: SH1, securityId: SEC1,
      transactionType: 'ISSUANCE', quantity: new Decimal('1000'),
      timestamp: futureDate, createdAt: futureDate,
    });

    // Balance as of today should not include the future entry
    const asOf = new Date();
    const balance = await ledgerService.getStakeholderBalance(T1, SH1, SEC1, asOf);
    expect(balance.toString()).toBe('5000');
  });
});
