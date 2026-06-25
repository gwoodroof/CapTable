import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrecisionMath, decimal } from '../../src/common/utils/math';
import Decimal from 'decimal.js';

describe('PrecisionMath', () => {
  describe('add', () => {
    it('should add two numbers with precision', () => {
      const result = PrecisionMath.add('0.1', '0.2');
      expect(result.toString()).toBe('0.3');
    });

    it('should add Decimal instances', () => {
      const result = PrecisionMath.add(new Decimal('100'), new Decimal('50'));
      expect(result.toString()).toBe('150');
    });

    it('should handle large share quantities', () => {
      const result = PrecisionMath.add('1000000.123456789012', '2000000.987654321098');
      expect(PrecisionMath.validateSharePrecision(result)).toBe(true);
    });
  });

  describe('subtract', () => {
    it('should subtract two numbers', () => {
      const result = PrecisionMath.subtract('1', '0.1');
      expect(result.toString()).toBe('0.9');
    });

    it('should handle negative results', () => {
      const result = PrecisionMath.subtract('10', '20');
      expect(result.toString()).toBe('-10');
    });
  });

  describe('multiply', () => {
    it('should multiply two numbers', () => {
      const result = PrecisionMath.multiply('0.1', '0.2');
      expect(result.toString()).toBe('0.02');
    });

    it('should calculate exercise cost correctly', () => {
      // 10k shares * $0.50 strike = $5,000
      const result = PrecisionMath.multiply('10000', '0.50');
      expect(result.toString()).toBe('5000');
    });
  });

  describe('divide', () => {
    it('should divide two numbers', () => {
      const result = PrecisionMath.divide('1', '3');
      // 1/3 with 28 digit precision
      expect(result.toString().startsWith('0.333333333333333333333333')).toBe(true);
    });

    it('should handle fractional shares when rounded before storage', () => {
      // Raw division has 28-digit precision (exceeds 12dp limit)
      const result = PrecisionMath.divide('100', '3');
      // Round to 12dp as you would before persisting to the ledger
      const rounded = PrecisionMath.round(result, 12);
      expect(PrecisionMath.validateSharePrecision(rounded)).toBe(true);
    });
  });

  describe('compare', () => {
    it('should return -1 when a < b', () => {
      const result = PrecisionMath.compare('10', '20');
      expect(result).toBe(-1);
    });

    it('should return 0 when a === b', () => {
      const result = PrecisionMath.compare('10', '10');
      expect(result).toBe(0);
    });

    it('should return 1 when a > b', () => {
      const result = PrecisionMath.compare('20', '10');
      expect(result).toBe(1);
    });
  });

  describe('isGreaterThan', () => {
    it('should return true when a > b', () => {
      const result = PrecisionMath.isGreaterThan('20', '10');
      expect(result).toBe(true);
    });

    it('should return false when a <= b', () => {
      const result = PrecisionMath.isGreaterThan('10', '10');
      expect(result).toBe(false);
    });
  });

  describe('isLessThanOrEqual', () => {
    it('should return true when a <= b', () => {
      const result = PrecisionMath.isLessThanOrEqual('10', '10');
      expect(result).toBe(true);
    });

    it('should return false when a > b', () => {
      const result = PrecisionMath.isLessThanOrEqual('20', '10');
      expect(result).toBe(false);
    });
  });

  describe('isEqual', () => {
    it('should return true for equal values', () => {
      const result = PrecisionMath.isEqual('10.5', '10.5');
      expect(result).toBe(true);
    });

    it('should return false for unequal values', () => {
      const result = PrecisionMath.isEqual('10.5', '10.6');
      expect(result).toBe(false);
    });
  });

  describe('sum', () => {
    it('should sum an array of quantities', () => {
      const result = PrecisionMath.sum(['100', '200', '300']);
      expect(result.toString()).toBe('600');
    });

    it('should handle empty array', () => {
      const result = PrecisionMath.sum([]);
      expect(result.toString()).toBe('0');
    });

    it('should sum fractional shares', () => {
      const result = PrecisionMath.sum(['33.333333333333', '33.333333333333', '33.333333333334']);
      expect(result.toString()).toBe('100');
    });
  });

  describe('round', () => {
    it('should round to specified decimal places', () => {
      const result = PrecisionMath.round('10.556', 2);
      expect(result.toString()).toBe('10.56');
    });

    it('should use ROUND_HALF_UP mode', () => {
      const result = PrecisionMath.round('10.555', 2);
      expect(result.toString()).toBe('10.56');
    });
  });

  describe('validateSharePrecision', () => {
    it('should accept values with <= 12 decimal places', () => {
      const valid = PrecisionMath.validateSharePrecision('100.123456789012');
      expect(valid).toBe(true);
    });

    it('should reject values with > 12 decimal places', () => {
      const invalid = PrecisionMath.validateSharePrecision('100.1234567890123');
      expect(invalid).toBe(false);
    });

    it('should accept whole numbers', () => {
      const valid = PrecisionMath.validateSharePrecision('100');
      expect(valid).toBe(true);
    });
  });

  describe('validatePricePrecision', () => {
    it('should accept values with <= 10 decimal places', () => {
      const valid = PrecisionMath.validatePricePrecision('0.1234567890');
      expect(valid).toBe(true);
    });

    it('should reject values with > 10 decimal places', () => {
      const invalid = PrecisionMath.validatePricePrecision('0.12345678901');
      expect(invalid).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('scenario 1: issuing fractional shares in a large round', () => {
      // 1M shares split 3 ways — raw division has 28-digit precision, so round to 12dp before storage
      const perShareholder = PrecisionMath.round(PrecisionMath.divide('1000000', '3'), 12);
      expect(PrecisionMath.validateSharePrecision(perShareholder)).toBe(true);

      // Due to rounding, the sum of three equal thirds is not exactly 1M
      // (333333.333333333333 * 3 = 999999.999999999999), which is by design
      const totalReissuance = PrecisionMath.sum([perShareholder, perShareholder, perShareholder]);
      expect(PrecisionMath.isGreaterThan(totalReissuance, '0')).toBe(true);
      expect(PrecisionMath.isLessThanOrEqual(totalReissuance, '1000000')).toBe(true);
    });

    it('scenario 2: option exercise with strike price', () => {
      // 10k options at $0.50 strike
      const cost = PrecisionMath.multiply('10000', '0.50');
      expect(cost.toString()).toBe('5000');
      expect(PrecisionMath.validatePricePrecision(decimal('0.50'))).toBe(true);
    });

    it('scenario 3: cap table reconciliation', () => {
      // Issue 10M authorized shares
      // Issue 4M to Founder A, 4M to Founder B
      // 2M remains unissued
      const founderA = new Decimal('4000000');
      const founderB = new Decimal('4000000');
      const total = PrecisionMath.sum([founderA, founderB]);
      const remaining = PrecisionMath.subtract('10000000', total);
      expect(remaining.toString()).toBe('2000000');
    });
  });
});
