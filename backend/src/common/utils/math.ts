import Decimal from 'decimal.js';

/**
 * Precision Math Utility for Cap Table Calculations
 *
 * All financial calculations MUST use this utility to ensure 100% precision.
 * JavaScript's native Number type is floating-point and unsuitable for equity math.
 *
 * Configuration:
 * - Precision: 28 significant digits (Handles extreme fractional shares)
 * - Rounding Mode: ROUND_HALF_UP (Standard financial rounding)
 */

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 7,
  toExpNeg: -7,
});

export class PrecisionMath {
  /**
   * Add two quantities (shares, prices)
   */
  static add(a: string | number | Decimal, b: string | number | Decimal): Decimal {
    return new Decimal(a).plus(new Decimal(b));
  }

  /**
   * Subtract two quantities
   */
  static subtract(a: string | number | Decimal, b: string | number | Decimal): Decimal {
    return new Decimal(a).minus(new Decimal(b));
  }

  /**
   * Multiply (e.g., Shares * Price)
   */
  static multiply(a: string | number | Decimal, b: string | number | Decimal): Decimal {
    return new Decimal(a).times(new Decimal(b));
  }

  /**
   * Divide (e.g., Total Cost / Strike Price)
   */
  static divide(a: string | number | Decimal, b: string | number | Decimal): Decimal {
    return new Decimal(a).dividedBy(new Decimal(b));
  }

  /**
   * Compare two quantities
   * Returns: -1 (a < b), 0 (a === b), 1 (a > b)
   */
  static compare(a: string | number | Decimal, b: string | number | Decimal): number {
    return new Decimal(a).comparedTo(new Decimal(b));
  }

  /**
   * Check if quantity is greater than threshold
   */
  static isGreaterThan(a: string | number | Decimal, b: string | number | Decimal): boolean {
    return new Decimal(a).greaterThan(new Decimal(b));
  }

  /**
   * Check if quantity is less than or equal to threshold
   */
  static isLessThanOrEqual(a: string | number | Decimal, b: string | number | Decimal): boolean {
    return new Decimal(a).lessThanOrEqualTo(new Decimal(b));
  }

  /**
   * Check if two quantities are equal
   */
  static isEqual(a: string | number | Decimal, b: string | number | Decimal): boolean {
    return new Decimal(a).equals(new Decimal(b));
  }

  /**
   * Get the absolute value
   */
  static abs(a: string | number | Decimal): Decimal {
    return new Decimal(a).absoluteValue();
  }

  /**
   * Round to N decimal places
   */
  static round(value: string | number | Decimal, decimalPlaces: number): Decimal {
    return new Decimal(value).toDecimalPlaces(decimalPlaces);
  }

  /**
   * Sum an array of quantities
   */
  static sum(quantities: (string | number | Decimal)[]): Decimal {
    return quantities.reduce<Decimal>((acc, q) => acc.plus(new Decimal(q)), new Decimal(0));
  }

  /**
   * Convert to string for storage/API
   */
  static toString(value: Decimal | string | number): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return value.toString();
  }

  /**
   * Convert to number (lossy, for display only)
   */
  static toNumber(value: Decimal | string | number): number {
    return Number(new Decimal(value).toString());
  }

  /**
   * Validate share quantity precision (max 12 decimal places)
   */
  static validateSharePrecision(value: Decimal | string | number): boolean {
    const decimal = new Decimal(value);
    // Extract fractional part
    const str = decimal.toString();
    const parts = str.split('.');
    if (parts.length === 1) return true; // No fractional part
    return parts[1].length <= 12;
  }

  /**
   * Validate price precision (max 10 decimal places)
   */
  static validatePricePrecision(value: Decimal | string | number): boolean {
    const decimal = new Decimal(value);
    const str = decimal.toString();
    const parts = str.split('.');
    if (parts.length === 1) return true;
    return parts[1].length <= 10;
  }
}

export const decimal = (value: string | number | Decimal): Decimal => new Decimal(value);
