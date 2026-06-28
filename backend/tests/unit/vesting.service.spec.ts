import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { computeVestingEvents, VestingService } from '../../src/modules/grant/vesting.service';

function makeGrant(opts: {
  grantDate: string;
  quantity: number;
  cliffMonths: number;
  vestingDurationMonths: number;
  vestingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
}) {
  return {
    grantDate: new Date(opts.grantDate),
    quantity: new Decimal(opts.quantity),
    vestingSchedule: {
      cliffMonths: opts.cliffMonths,
      vestingDurationMonths: opts.vestingDurationMonths,
      vestingFrequency: opts.vestingFrequency,
    },
  };
}

describe('computeVestingEvents', () => {
  describe('4-year monthly with 1-year cliff', () => {
    const grant = makeGrant({
      grantDate: '2020-01-01',
      quantity: 1200,
      cliffMonths: 12,
      vestingDurationMonths: 48,
      vestingFrequency: 'MONTHLY',
    });
    const events = computeVestingEvents(grant);

    it('produces 37 events (1 cliff + 36 monthly)', () => {
      expect(events).toHaveLength(37);
    });

    it('cliff event is at 12 months with 300 shares', () => {
      const cliff = events.find((e) => e.periodIndex === 0)!;
      expect(cliff.date).toEqual(new Date('2021-01-01'));
      expect(cliff.quantity.toNumber()).toBe(300);
    });

    it('second event is 1 month after cliff with 25 shares', () => {
      const second = events.find((e) => e.periodIndex === 1)!;
      expect(second.date).toEqual(new Date('2021-02-01'));
      expect(second.quantity.toNumber()).toBe(25);
    });

    it('total quantity across all events equals the grant quantity', () => {
      const total = events.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
      expect(total.toNumber()).toBe(1200);
    });

    it('all events are on or after the cliff date', () => {
      const cliffDate = new Date('2021-01-01');
      events.forEach((e) => {
        expect(e.date >= cliffDate).toBe(true);
      });
    });
  });

  describe('4-year monthly with no cliff', () => {
    const grant = makeGrant({
      grantDate: '2020-01-01',
      quantity: 4800,
      cliffMonths: 0,
      vestingDurationMonths: 48,
      vestingFrequency: 'MONTHLY',
    });
    const events = computeVestingEvents(grant);

    it('produces 48 events', () => {
      expect(events).toHaveLength(48);
    });

    it('first event is 1 month after grant date', () => {
      expect(events[0].date).toEqual(new Date('2020-02-01'));
    });

    it('each event vests exactly 100 shares', () => {
      events.forEach((e) => expect(e.quantity.toNumber()).toBe(100));
    });

    it('total equals grant quantity', () => {
      const total = events.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
      expect(total.toNumber()).toBe(4800);
    });
  });

  describe('4-year quarterly with 1-year cliff', () => {
    const grant = makeGrant({
      grantDate: '2020-01-01',
      quantity: 1600,
      cliffMonths: 12,
      vestingDurationMonths: 48,
      vestingFrequency: 'QUARTERLY',
    });
    const events = computeVestingEvents(grant);

    it('produces 13 events (1 cliff + 12 quarterly)', () => {
      expect(events).toHaveLength(13);
    });

    it('cliff event aggregates 4 quarters into 400 shares', () => {
      const cliff = events[0];
      expect(cliff.periodIndex).toBe(0);
      expect(cliff.quantity.toNumber()).toBe(400);
    });

    it('total equals grant quantity', () => {
      const total = events.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
      expect(total.toNumber()).toBe(1600);
    });
  });

  describe('events filtered by date in materialize', () => {
    const grant = makeGrant({
      grantDate: '2020-01-01',
      quantity: 1200,
      cliffMonths: 12,
      vestingDurationMonths: 48,
      vestingFrequency: 'MONTHLY',
    });
    const events = computeVestingEvents(grant);

    it('events before cliff are not present', () => {
      const cliffDate = new Date('2021-01-01');
      events.forEach((e) => expect(e.date < cliffDate).toBe(false));
    });

    it('can filter to only events on or before a given date', () => {
      const asOf = new Date('2021-03-01'); // 2 months after cliff
      const due = events.filter((e) => e.date <= asOf);
      expect(due).toHaveLength(3); // cliff + Jan + Feb post-cliff
    });
  });

  describe('rounding: non-divisible quantities', () => {
    const grant = makeGrant({
      grantDate: '2020-01-01',
      quantity: 1000,
      cliffMonths: 12,
      vestingDurationMonths: 48,
      vestingFrequency: 'MONTHLY',
    });
    const events = computeVestingEvents(grant);

    it('total still equals grant quantity exactly', () => {
      const total = events.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
      expect(total.toNumber()).toBe(1000);
    });
  });
});

describe('offboarding vesting calculations', () => {
  const grant = makeGrant({
    grantDate: '2020-01-01',
    quantity: 1200,
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'MONTHLY',
  });
  const events = computeVestingEvents(grant);

  it('terminatedAt filters out events after termination date', () => {
    const terminationDate = new Date('2022-01-01'); // exactly 2 years in
    const vestable = events.filter((e) => e.date <= terminationDate);
    // cliff at 12m + 12 monthly events = 13 total
    expect(vestable).toHaveLength(13);
  });

  it('shares vested at termination date are correctly summed', () => {
    const terminationDate = new Date('2022-01-01');
    const vestable = events.filter((e) => e.date <= terminationDate);
    const total = vestable.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
    // 300 cliff + 12*25 = 600
    expect(total.toNumber()).toBe(600);
  });

  it('over-vested events (after termination) are correctly identified', () => {
    const terminationDate = new Date('2022-01-01');
    // Simulate 2 VEST entries that were auto-created after termination date
    const materializedAfter = events.filter((e) => e.date > terminationDate).slice(0, 2);
    expect(materializedAfter).toHaveLength(2);
    const overVested = materializedAfter.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
    expect(overVested.toNumber()).toBe(50); // 2 × 25
  });

  describe('acceleration: months method', () => {
    it('computes additional shares in the next 6 months after termination', () => {
      const terminationDate = new Date('2022-01-01');
      const cutoff = new Date('2022-07-01'); // + 6 months
      const accelerated = events.filter((e) => e.date > terminationDate && e.date <= cutoff);
      // months Feb–Jul 2022 = 6 events × 25 = 150
      expect(accelerated).toHaveLength(6);
      const total = accelerated.reduce((sum, e) => sum.plus(e.quantity), new Decimal(0));
      expect(total.toNumber()).toBe(150);
    });
  });

  describe('acceleration: after full cliff', () => {
    it('cliff event is not double-counted in post-termination acceleration', () => {
      const terminationDate = new Date('2020-06-01'); // before cliff
      const cutoff = new Date('2021-06-01'); // + 12 months
      // All events before termination (none, since cliff is Jan 2021)
      const vested = events.filter((e) => e.date <= terminationDate);
      expect(vested).toHaveLength(0);
      // Acceleration: cliff fires Jan 2021 which is after termination (Jun 2020) and within cutoff (Jun 2021)
      const accelerated = events.filter((e) => e.date > terminationDate && e.date <= cutoff);
      // cliff (Jan 2021) + Feb–Jun 2021 = 6 events
      expect(accelerated).toHaveLength(6);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VestingService.exerciseCounts & exerciseCommit
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-1';
const GRANT_ID = 'grant-1';
const STAKEHOLDER_ID = 'sh-1';
const OPTION_SECURITY_ID = 'sec-option';
const ISSUANCE_SECURITY_ID = 'sec-common';

const mockGrant = {
  id: GRANT_ID,
  tenantId: TENANT_ID,
  stakeholderId: STAKEHOLDER_ID,
  securityId: OPTION_SECURITY_ID,
  quantity: new Decimal(1200),
  strikePrice: new Decimal(0.5),
  grantDate: new Date('2020-01-01'),
  terminatedAt: null,
  stakeholder: { id: STAKEHOLDER_ID, name: 'Alice', email: 'alice@example.com' },
  security: { id: OPTION_SECURITY_ID, type: 'OPTION', name: 'Options' },
  vestingSchedule: {
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'MONTHLY',
  },
};

const makePrisma = () => {
  const p = {
    grant: { findUnique: vi.fn() },
    ledgerTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    withTenant: vi.fn(async (_: string, fn: (tx: any) => Promise<any>) => fn(p)),
  };
  return p;
};

const makeLedgerService = () => ({
  recordTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
});

describe('VestingService.exerciseCounts', () => {
  let service: VestingService;
  let prisma: ReturnType<typeof makePrisma>;
  let ledgerSvc: ReturnType<typeof makeLedgerService>;

  beforeEach(() => {
    prisma = makePrisma();
    ledgerSvc = makeLedgerService();
    service = new VestingService(prisma as any, ledgerSvc as any);
    prisma.grant.findUnique.mockResolvedValue(mockGrant);
  });

  it('returns totalVested = 0 before cliff', async () => {
    // As of 2020-06-01 (before 12-month cliff) nothing has vested
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2020-06-01'));
    expect(result.totalVested).toBe(0);
    expect(result.exercisable).toBe(0);
  });

  it('returns totalVested = 300 (cliff only) at exactly 12 months', async () => {
    // Cliff fires at 2021-01-01 with 300 shares (12/48 * 1200)
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2021-01-01'));
    expect(result.totalVested).toBe(300);
    expect(result.exercisable).toBe(300);
  });

  it('subtracts already-exercised from exercisable', async () => {
    prisma.ledgerTransaction.findMany.mockResolvedValue([
      { quantity: new Decimal(100) },
      { quantity: new Decimal(50) },
    ]);
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2021-01-01'));
    expect(result.totalVested).toBe(300);
    expect(result.alreadyExercised).toBe(150);
    expect(result.exercisable).toBe(150);
  });

  it('exercisable is never negative', async () => {
    prisma.ledgerTransaction.findMany.mockResolvedValue([
      { quantity: new Decimal(999) },
    ]);
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2021-01-01'));
    expect(result.exercisable).toBe(0);
  });

  it('caps vesting at terminatedAt if earlier than asOfDate', async () => {
    prisma.grant.findUnique.mockResolvedValue({
      ...mockGrant,
      terminatedAt: new Date('2021-01-01'), // terminated at cliff date
    });
    // Ask for date well after termination
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2023-01-01'));
    // Only cliff vesting applies: 300 shares
    expect(result.totalVested).toBe(300);
  });

  it('throws BadRequestException when grant is not found', async () => {
    prisma.grant.findUnique.mockResolvedValue(null);
    await expect(service.exerciseCounts(TENANT_ID, GRANT_ID, new Date())).rejects.toThrow(BadRequestException);
  });

  it('returns grant metadata including strikePrice', async () => {
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2021-01-01'));
    expect(result.grant.strikePrice).toBe('0.5');
    expect(result.grant.stakeholderName).toBe('Alice');
    expect(result.grant.securityName).toBe('Options');
  });

  it('exercisable is exact (no float drift) for non-divisible grant quantity', async () => {
    // 1000 shares over 48 months monthly → 20.833... per period; float summation would drift
    prisma.grant.findUnique.mockResolvedValue({
      ...mockGrant,
      quantity: new Decimal(1000),
      vestingSchedule: { cliffMonths: 0, vestingDurationMonths: 48, vestingFrequency: 'MONTHLY' },
    });
    // As-of after all 48 periods (2024-01-01)
    const result = await service.exerciseCounts(TENANT_ID, GRANT_ID, new Date('2024-02-01'));
    // The full grant quantity must be exercisable, not 999.9999...
    expect(result.totalVested).toBe(1000);
    expect(result.exercisable).toBe(1000);
  });
});

describe('VestingService.exerciseCommit', () => {
  let service: VestingService;
  let prisma: ReturnType<typeof makePrisma>;
  let ledgerSvc: ReturnType<typeof makeLedgerService>;

  beforeEach(() => {
    prisma = makePrisma();
    ledgerSvc = makeLedgerService();
    service = new VestingService(prisma as any, ledgerSvc as any);
    prisma.grant.findUnique.mockResolvedValue(mockGrant);
    prisma.ledgerTransaction.findMany.mockResolvedValue([]);
  });

  it('calls recordTransaction twice (EXERCISE + ISSUANCE) on success', async () => {
    await service.exerciseCommit(TENANT_ID, 'admin-1', {
      grantId: GRANT_ID,
      asOfDate: new Date('2021-01-01'),
      quantity: '100',
      issuanceSecurityId: ISSUANCE_SECURITY_ID,
    });
    expect(ledgerSvc.recordTransaction).toHaveBeenCalledTimes(2);
    const [first, second] = ledgerSvc.recordTransaction.mock.calls;
    expect(first[0].transactionType).toBe('EXERCISE');
    expect(first[0].securityId).toBe(OPTION_SECURITY_ID);
    expect(first[0].quantity).toBe('100');
    expect(second[0].transactionType).toBe('ISSUANCE');
    expect(second[0].securityId).toBe(ISSUANCE_SECURITY_ID);
    expect(second[0].quantity).toBe('100');
  });

  it('includes strikePrice as pricePerShare on the EXERCISE entry', async () => {
    await service.exerciseCommit(TENANT_ID, 'admin-1', {
      grantId: GRANT_ID,
      asOfDate: new Date('2021-01-01'),
      quantity: '50',
      issuanceSecurityId: ISSUANCE_SECURITY_ID,
    });
    const [exerciseCall] = ledgerSvc.recordTransaction.mock.calls;
    expect(exerciseCall[0].pricePerShare).toBe('0.5');
  });

  it('throws BadRequestException when quantity exceeds exercisable', async () => {
    await expect(
      service.exerciseCommit(TENANT_ID, 'admin-1', {
        grantId: GRANT_ID,
        asOfDate: new Date('2021-01-01'),
        quantity: '9999',
        issuanceSecurityId: ISSUANCE_SECURITY_ID,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when quantity is zero', async () => {
    await expect(
      service.exerciseCommit(TENANT_ID, 'admin-1', {
        grantId: GRANT_ID,
        asOfDate: new Date('2021-01-01'),
        quantity: '0',
        issuanceSecurityId: ISSUANCE_SECURITY_ID,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
