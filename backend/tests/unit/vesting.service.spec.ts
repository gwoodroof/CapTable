import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { computeVestingEvents } from '../../src/modules/grant/vesting.service';

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
