import { createHash } from 'crypto';

/**
 * Cryptographic Audit Trail Utility
 *
 * Implements SHA-256 hash-chaining for the immutable ledger.
 * Each transaction includes:
 * - data_hash: SHA-256 of transaction data
 * - previous_row_hash: Hash of the previous entry for this tenant
 * - chain_hash: SHA-256(data_hash + previous_row_hash)
 *
 * This ensures any modification to historical data breaks the chain,
 * making tampering immediately detectable.
 */

export class AuditTrail {
  /**
   * Compute SHA-256 hash of a value
   */
  static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Compute data hash from transaction details
   */
  static computeDataHash(transactionData: any): string {
    const jsonStr = JSON.stringify(transactionData, Object.keys(transactionData).sort());
    return this.hash(jsonStr);
  }

  /**
   * Compute chain hash: SHA-256(data_hash + previous_row_hash)
   */
  static computeChainHash(dataHash: string, previousRowHash: string | null): string {
    const combined = dataHash + (previousRowHash || '0');
    return this.hash(combined);
  }

  /**
   * Validate chain integrity for a ledger entry
   */
  static validateChainIntegrity(
    dataHash: string,
    previousRowHash: string | null,
    chainHash: string,
  ): boolean {
    const expectedChainHash = this.computeChainHash(dataHash, previousRowHash);
    return expectedChainHash === chainHash;
  }
}
