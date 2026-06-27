import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import Decimal from 'decimal.js';

export interface VestingEvent {
  periodIndex: number;
  date: Date;
  quantity: Decimal;
}

/**
 * Adds `months` calendar months to a Date, preserving the day-of-month where possible.
 * Mirrors the behaviour of date-fns addMonths without importing the package.
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // If the day overflowed (e.g. Jan 31 + 1 month → Mar 3), roll back to last day of intended month
  const expected = ((targetMonth % 12) + 12) % 12;
  if (result.getMonth() !== expected) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

/**
 * Compute the ordered list of vesting events for a grant.
 *
 * Returns events with periodIndex 0, 1, 2, … where:
 *   - periodIndex 0 = the cliff batch (all periods up to and including the cliff, aggregated)
 *   - periodIndex 1..N = post-cliff individual period vests
 *
 * If cliffMonths === 0 there is no cliff batch; events start at periodIndex 0 for period 1.
 */
export function computeVestingEvents(grant: {
  grantDate: Date;
  quantity: Decimal;
  vestingSchedule: {
    cliffMonths: number;
    vestingDurationMonths: number;
    vestingFrequency: string;
  };
}): VestingEvent[] {
  const { grantDate, quantity, vestingSchedule } = grant;
  const { cliffMonths, vestingDurationMonths, vestingFrequency } = vestingSchedule;

  const periodMonths = vestingFrequency === 'MONTHLY' ? 1 : vestingFrequency === 'QUARTERLY' ? 3 : 12;
  const totalPeriods = Math.floor(vestingDurationMonths / periodMonths);

  if (totalPeriods === 0) return [];

  const baseQty = quantity.div(totalPeriods);
  const cliffDate = addMonths(grantDate, cliffMonths);

  // Accumulate periods into groups: those on/before cliffDate are batched together
  const groups: { date: Date; quantity: Decimal }[] = [];
  let cliffAccum = new Decimal(0);
  let runningTotal = new Decimal(0);

  for (let p = 1; p <= totalPeriods; p++) {
    const scheduledDate = addMonths(grantDate, p * periodMonths);
    const isLast = p === totalPeriods;
    // Adjust last period for rounding error
    const qty = isLast ? quantity.minus(runningTotal) : baseQty;
    runningTotal = runningTotal.plus(qty);

    if (scheduledDate <= cliffDate) {
      cliffAccum = cliffAccum.plus(qty);
    } else {
      groups.push({ date: scheduledDate, quantity: qty });
    }
  }

  const events: VestingEvent[] = [];

  if (cliffMonths > 0 && cliffAccum.gt(0)) {
    events.push({ periodIndex: 0, date: cliffDate, quantity: cliffAccum });
  }

  for (const g of groups) {
    events.push({ periodIndex: events.length, date: g.date, quantity: g.quantity });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offboarding types
// ─────────────────────────────────────────────────────────────────────────────

export interface GrantOffboardingPreview {
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

export interface OffboardingPreview {
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

export interface OffboardingInput {
  stakeholderId: string;
  terminationDate: Date;
  terminationType: string;
  ptepDays: number;
  applyAcceleration: boolean;
  accelerationMethod: 'shares' | 'months';
  accelerationValue: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class VestingService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  /**
   * Materialize all due vesting entries (up to `now`) for every grant in the tenant.
   * Idempotent: skips any (grantId, vestingPeriodIndex) pair already in the ledger.
   * Skips events that fall after a grant's terminatedAt date.
   * Returns the count of newly created VEST entries.
   */
  async materializeVestings(tenantId: string, now: Date = new Date()): Promise<number> {
    const grants = await this.prisma.withTenant(tenantId, (tx) =>
      tx.grant.findMany({
        where: { tenantId },
        include: { vestingSchedule: true },
      }),
    );

    let created = 0;

    for (const grant of grants) {
      const events = computeVestingEvents({
        grantDate: grant.grantDate,
        quantity: grant.quantity as Decimal,
        vestingSchedule: {
          cliffMonths: grant.vestingSchedule.cliffMonths,
          vestingDurationMonths: grant.vestingSchedule.vestingDurationMonths,
          vestingFrequency: grant.vestingSchedule.vestingFrequency,
        },
      });

      // Get already-recorded vest period indices for this grant
      const existing = await this.prisma.withTenant(tenantId, (tx) =>
        tx.ledgerTransaction.findMany({
          where: { tenantId, grantId: grant.id, transactionType: 'VEST' },
          select: { vestingPeriodIndex: true },
        }),
      );
      const recordedIndices = new Set(existing.map((e) => e.vestingPeriodIndex));

      for (const event of events) {
        if (event.date > now) continue; // not due yet
        // Respect grant termination: skip events scheduled after the termination date
        if (grant.terminatedAt && event.date > grant.terminatedAt) continue;
        if (recordedIndices.has(event.periodIndex)) continue; // already recorded

        await this.ledgerService.recordTransaction({
          tenantId,
          transactionType: 'VEST',
          stakeholderId: grant.stakeholderId,
          securityId: grant.securityId,
          quantity: event.quantity,
          grantId: grant.id,
          vestingPeriodIndex: event.periodIndex,
          timestamp: event.date,
        });
        created++;
      }
    }

    return created;
  }

  /**
   * Returns a preview of the offboarding changes without writing to the database.
   */
  async previewOffboarding(tenantId: string, input: OffboardingInput): Promise<OffboardingPreview> {
    const { stakeholderId, terminationDate, ptepDays, applyAcceleration, accelerationMethod, accelerationValue } = input;

    const stakeholder = await this.prisma.withTenant(tenantId, (tx) =>
      tx.stakeholder.findUnique({ where: { id: stakeholderId } }),
    );
    if (!stakeholder || stakeholder.tenantId !== tenantId) {
      throw new Error('Stakeholder not found');
    }

    const grants = await this.prisma.withTenant(tenantId, (tx) =>
      tx.grant.findMany({
        where: { tenantId, stakeholderId },
        include: { vestingSchedule: true, security: true },
      }),
    );

    const grantPreviews: GrantOffboardingPreview[] = [];
    const now = new Date();

    for (const grant of grants) {
      // Compute vesting schedule directly — don't rely on materialized ledger entries
      const allEvents = computeVestingEvents({
        grantDate: grant.grantDate,
        quantity: grant.quantity as Decimal,
        vestingSchedule: {
          cliffMonths: grant.vestingSchedule.cliffMonths,
          vestingDurationMonths: grant.vestingSchedule.vestingDurationMonths,
          vestingFrequency: grant.vestingSchedule.vestingFrequency,
        },
      });

      // Shares vested on or before the termination date (per schedule; capped at today)
      const vestBefore = allEvents
        .filter((ev) => ev.date <= terminationDate && ev.date <= now)
        .reduce((sum, ev) => sum + ev.quantity.toNumber(), 0);

      // Already-materialized VEST ledger entries recorded AFTER the termination date — these need reversal
      const vestAfterEntries = await this.prisma.withTenant(tenantId, (tx) =>
        tx.ledgerTransaction.findMany({
          where: { tenantId, grantId: grant.id, transactionType: 'VEST', timestamp: { gt: terminationDate } },
          orderBy: { timestamp: 'asc' },
        }),
      );
      const overVested = vestAfterEntries.reduce((sum, e) => sum + Number(e.quantity), 0);

      // Compute acceleration for this grant
      let acceleratedShares = 0;
      if (applyAcceleration) {
        if (accelerationMethod === 'shares') {
          // Distribute flat shares proportionally across grants by grant quantity
          const totalGranted = grants.reduce((s, g) => s + Number(g.quantity), 0);
          acceleratedShares = totalGranted > 0
            ? (accelerationValue * Number(grant.quantity)) / totalGranted
            : 0;
        } else {
          // months: sum vesting events after terminationDate and within accelerationValue months
          const cutoff = addMonths(terminationDate, accelerationValue);
          acceleratedShares = allEvents
            .filter((ev) => ev.date > terminationDate && ev.date <= cutoff)
            .reduce((sum, ev) => sum + ev.quantity.toNumber(), 0);
        }
      }

      grantPreviews.push({
        grantId: grant.id,
        grantDate: grant.grantDate.toISOString(),
        securityId: grant.securityId,
        securityName: grant.security.name ?? grant.security.type,
        securityType: grant.security.type,
        stakeholderId: grant.stakeholderId,
        totalGranted: Number(grant.quantity),
        vestedBeforeTermination: vestBefore,
        overVestedToReverse: overVested,
        netVested: vestBefore,
        acceleratedShares,
        vestEntriesAfterTermination: vestAfterEntries.map((e) => ({
          id: e.id,
          quantity: Number(e.quantity),
          timestamp: e.timestamp.toISOString(),
        })),
      });
    }

    const totals = grantPreviews.reduce(
      (acc, g) => ({
        totalGranted: acc.totalGranted + g.totalGranted,
        vestedBeforeTermination: acc.vestedBeforeTermination + g.vestedBeforeTermination,
        overVestedToReverse: acc.overVestedToReverse + g.overVestedToReverse,
        acceleratedShares: acc.acceleratedShares + g.acceleratedShares,
      }),
      { totalGranted: 0, vestedBeforeTermination: 0, overVestedToReverse: 0, acceleratedShares: 0 },
    );

    const ptepDeadline = new Date(terminationDate);
    ptepDeadline.setDate(ptepDeadline.getDate() + ptepDays);

    return {
      stakeholder: { id: stakeholder.id, name: stakeholder.name, email: stakeholder.email },
      grants: grantPreviews,
      totals,
      ptepDeadline: ptepDeadline.toISOString(),
    };
  }

  /**
   * Commits the offboarding: creates CANCELLATION entries for over-vested shares,
   * creates VEST entries for acceleration, and marks each grant as terminated.
   */
  async commitOffboarding(
    tenantId: string,
    adminId: string,
    input: OffboardingInput,
  ): Promise<{ cancellationsCreated: number; accelerationCreated: number; grantsTerminated: number }> {
    const preview = await this.previewOffboarding(tenantId, input);

    let cancellationsCreated = 0;
    let accelerationCreated = 0;
    let grantsTerminated = 0;

    for (const grantPreview of preview.grants) {
      // 1. Create CANCELLATION entries for each VEST entry after termination date
      for (const vestEntry of grantPreview.vestEntriesAfterTermination) {
        await this.ledgerService.recordTransaction({
          tenantId,
          transactionType: 'CANCELLATION',
          stakeholderId: grantPreview.stakeholderId,
          securityId: grantPreview.securityId,
          quantity: vestEntry.quantity,
          grantId: grantPreview.grantId,
          initiatedBy: adminId,
          timestamp: input.terminationDate,
        });
        cancellationsCreated++;
      }

      // 2. Create VEST entry for acceleration
      if (input.applyAcceleration && grantPreview.acceleratedShares > 0) {
        await this.ledgerService.recordTransaction({
          tenantId,
          transactionType: 'VEST',
          stakeholderId: grantPreview.stakeholderId,
          securityId: grantPreview.securityId,
          quantity: grantPreview.acceleratedShares,
          grantId: grantPreview.grantId,
          initiatedBy: adminId,
          timestamp: input.terminationDate,
        });
        accelerationCreated++;
      }

      // 3. CANCELLATION for the unvested forfeit (shares returning to the option pool)
      const unvestedForfeit =
        grantPreview.totalGranted -
        grantPreview.vestedBeforeTermination -
        grantPreview.acceleratedShares;
      if (unvestedForfeit > 0.000001) {
        await this.ledgerService.recordTransaction({
          tenantId,
          transactionType: 'CANCELLATION',
          stakeholderId: grantPreview.stakeholderId,
          securityId: grantPreview.securityId,
          quantity: unvestedForfeit,
          grantId: grantPreview.grantId,
          initiatedBy: adminId,
          timestamp: input.terminationDate,
        });
        cancellationsCreated++;
      }

      // 5. Mark the grant as terminated
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.grant.update({
          where: { id: grantPreview.grantId },
          data: {
            terminatedAt: input.terminationDate,
            terminationType: input.terminationType,
            ptepDays: input.ptepDays !== 90 ? input.ptepDays : null,
          },
        }),
      );
      grantsTerminated++;
    }

    return { cancellationsCreated, accelerationCreated, grantsTerminated };
  }
}
