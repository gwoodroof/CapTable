import { describe, it, expect } from 'vitest';
import { AuditTrail } from '../../src/common/utils/audit-trail';

describe('AuditTrail', () => {
  describe('hash', () => {
    it('produces a deterministic 64-char hex string', () => {
      const h = AuditTrail.hash('hello');
      expect(h).toHaveLength(64);
      expect(AuditTrail.hash('hello')).toBe(h);
    });

    it('produces different hashes for different inputs', () => {
      expect(AuditTrail.hash('a')).not.toBe(AuditTrail.hash('b'));
    });
  });

  describe('computeDataHash', () => {
    it('produces consistent hash for same object', () => {
      const data = { transactionType: 'ISSUANCE', quantity: '1000', stakeholderId: 'sh-1' };
      expect(AuditTrail.computeDataHash(data)).toBe(AuditTrail.computeDataHash(data));
    });

    it('is order-independent (keys are sorted)', () => {
      const a = { b: 2, a: 1 };
      const b = { a: 1, b: 2 };
      expect(AuditTrail.computeDataHash(a)).toBe(AuditTrail.computeDataHash(b));
    });

    it('produces different hashes for different data', () => {
      const a = { quantity: '100' };
      const b = { quantity: '200' };
      expect(AuditTrail.computeDataHash(a)).not.toBe(AuditTrail.computeDataHash(b));
    });
  });

  describe('computeChainHash', () => {
    it('handles null previousRowHash (genesis entry)', () => {
      const dataHash = AuditTrail.hash('first-transaction');
      const chainHash = AuditTrail.computeChainHash(dataHash, null);
      // Should combine dataHash + '0'
      const expected = AuditTrail.hash(dataHash + '0');
      expect(chainHash).toBe(expected);
    });

    it('incorporates previousRowHash for subsequent entries', () => {
      const dataHash = AuditTrail.hash('second-transaction');
      const prevHash = AuditTrail.hash('previous-chain-hash');
      const chainHash = AuditTrail.computeChainHash(dataHash, prevHash);
      const expected = AuditTrail.hash(dataHash + prevHash);
      expect(chainHash).toBe(expected);
    });

    it('produces different chain hashes with vs without previous hash', () => {
      const dataHash = AuditTrail.hash('some-data');
      const withPrev = AuditTrail.computeChainHash(dataHash, AuditTrail.hash('prev'));
      const withoutPrev = AuditTrail.computeChainHash(dataHash, null);
      expect(withPrev).not.toBe(withoutPrev);
    });
  });

  describe('validateChainIntegrity', () => {
    it('returns true for a valid genesis entry', () => {
      const dataHash = AuditTrail.hash('tx-data');
      const chainHash = AuditTrail.computeChainHash(dataHash, null);
      expect(AuditTrail.validateChainIntegrity(dataHash, null, chainHash)).toBe(true);
    });

    it('returns true for a valid chained entry', () => {
      const dataHash = AuditTrail.hash('tx-data');
      const prevChainHash = AuditTrail.hash('prev-chain');
      const chainHash = AuditTrail.computeChainHash(dataHash, prevChainHash);
      expect(AuditTrail.validateChainIntegrity(dataHash, prevChainHash, chainHash)).toBe(true);
    });

    it('returns false when dataHash has been tampered', () => {
      const dataHash = AuditTrail.hash('original-data');
      const chainHash = AuditTrail.computeChainHash(dataHash, null);
      const tamperedDataHash = AuditTrail.hash('tampered-data');
      expect(AuditTrail.validateChainIntegrity(tamperedDataHash, null, chainHash)).toBe(false);
    });

    it('returns false when chainHash has been tampered', () => {
      const dataHash = AuditTrail.hash('tx-data');
      const chainHash = AuditTrail.computeChainHash(dataHash, null);
      const tamperedChainHash = AuditTrail.hash('tampered-chain');
      expect(AuditTrail.validateChainIntegrity(dataHash, null, tamperedChainHash)).toBe(false);
    });

    it('detects a broken chain when previousRowHash changes', () => {
      const dataHash = AuditTrail.hash('tx-data');
      const correctPrev = AuditTrail.hash('correct-prev');
      const wrongPrev = AuditTrail.hash('wrong-prev');
      const chainHash = AuditTrail.computeChainHash(dataHash, correctPrev);
      expect(AuditTrail.validateChainIntegrity(dataHash, wrongPrev, chainHash)).toBe(false);
    });

    it('simulates a 3-entry chain all being valid', () => {
      const data1 = AuditTrail.computeDataHash({ type: 'ISSUANCE', qty: '1000' });
      const chain1 = AuditTrail.computeChainHash(data1, null);

      const data2 = AuditTrail.computeDataHash({ type: 'VEST', qty: '250' });
      const chain2 = AuditTrail.computeChainHash(data2, chain1);

      const data3 = AuditTrail.computeDataHash({ type: 'CANCELLATION', qty: '100' });
      const chain3 = AuditTrail.computeChainHash(data3, chain2);

      expect(AuditTrail.validateChainIntegrity(data1, null, chain1)).toBe(true);
      expect(AuditTrail.validateChainIntegrity(data2, chain1, chain2)).toBe(true);
      expect(AuditTrail.validateChainIntegrity(data3, chain2, chain3)).toBe(true);
    });
  });
});
