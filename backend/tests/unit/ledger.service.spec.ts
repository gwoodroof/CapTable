import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { AuditTrail } from '../../src/common/utils/audit-trail';

const TENANT_ID = 'tenant-abc';
const STAKEHOLDER_ID = 'sh-1';
const SECURITY_ID = 'sec-1';

const makePrisma = () => ({
  tenant: { findUnique: vi.fn() },
  stakeholder: { findUnique: vi.fn() },
  security: { findUnique: vi.fn() },
  ledgerTransaction: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
});

const makeEmailService = () => ({
  sendLedgerNotification: vi.fn().mockResolvedValue(undefined),
});

const validTenant = { id: TENANT_ID, name: 'Acme Corp' };
const validStakeholder = { id: STAKEHOLDER_ID, tenantId: TENANT_ID, name: 'Alice', email: 'alice@example.com' };
const validSecurity = { id: SECURITY_ID, tenantId: TENANT_ID, type: 'COMMON_STOCK', name: 'Common Stock' };

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof makePrisma>;
  let emailService: ReturnType<typeof makeEmailService>;

  beforeEach(() => {
    prisma = makePrisma();
    emailService = makeEmailService();
    service = new LedgerService(prisma as any, emailService as any);
  });

  describe('recordTransaction', () => {
    const baseInput = {
      tenantId: TENANT_ID,
      transactionType: 'ISSUANCE' as const,
      stakeholderId: STAKEHOLDER_ID,
      securityId: SECURITY_ID,
      quantity: '1000',
    };

    beforeEach(() => {
      prisma.tenant.findUnique.mockResolvedValue(validTenant);
      prisma.stakeholder.findUnique.mockResolvedValue(validStakeholder);
      prisma.security.findUnique.mockResolvedValue(validSecurity);
      prisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      prisma.ledgerTransaction.create.mockResolvedValue({
        id: 'tx-1',
        ...baseInput,
        dataHash: 'data-hash',
        previousRowHash: null,
        chainHash: 'chain-hash',
        createdAt: new Date(),
      });
    });

    it('records a valid transaction and returns the ledger entry', async () => {
      const result = await service.recordTransaction(baseInput);
      expect(result.id).toBe('tx-1');
      expect(prisma.ledgerTransaction.create).toHaveBeenCalledOnce();
    });

    it('throws BadRequestException when tenant is not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.recordTransaction(baseInput)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stakeholder does not exist', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.recordTransaction(baseInput)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stakeholder belongs to a different tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: STAKEHOLDER_ID, tenantId: 'other-tenant' });
      await expect(service.recordTransaction(baseInput)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when security belongs to a different tenant', async () => {
      prisma.security.findUnique.mockResolvedValue({ id: SECURITY_ID, tenantId: 'other-tenant' });
      await expect(service.recordTransaction(baseInput)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when quantity exceeds 12 decimal places', async () => {
      await expect(
        service.recordTransaction({ ...baseInput, quantity: '100.1234567890123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when pricePerShare exceeds 10 decimal places', async () => {
      await expect(
        service.recordTransaction({ ...baseInput, pricePerShare: '0.12345678901' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets previousRowHash to null for the first entry in a tenant', async () => {
      prisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      await service.recordTransaction(baseInput);
      const createCall = prisma.ledgerTransaction.create.mock.calls[0][0];
      expect(createCall.data.previousRowHash).toBeNull();
    });

    it('links previousRowHash to the prior entry chain hash', async () => {
      const prevChainHash = AuditTrail.hash('previous-entry');
      prisma.ledgerTransaction.findFirst.mockResolvedValue({ chainHash: prevChainHash });
      await service.recordTransaction(baseInput);
      const createCall = prisma.ledgerTransaction.create.mock.calls[0][0];
      expect(createCall.data.previousRowHash).toBe(prevChainHash);
    });

    it('stores a valid chain hash (SHA-256 of dataHash + previousRowHash)', async () => {
      await service.recordTransaction(baseInput);
      const createCall = prisma.ledgerTransaction.create.mock.calls[0][0];
      const { dataHash, previousRowHash, chainHash } = createCall.data;
      expect(AuditTrail.validateChainIntegrity(dataHash, previousRowHash, chainHash)).toBe(true);
    });

    it('accepts fractional share quantities up to 12 decimals', async () => {
      await expect(
        service.recordTransaction({ ...baseInput, quantity: '0.123456789012' }),
      ).resolves.toBeDefined();
    });

    describe('stakeholder email notification', () => {
      it('sends a notification email when the stakeholder has an email address', async () => {
        await service.recordTransaction(baseInput);
        expect(emailService.sendLedgerNotification).toHaveBeenCalledOnce();
        expect(emailService.sendLedgerNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'alice@example.com',
            stakeholderName: 'Alice',
            companyName: 'Acme Corp',
            tenantId: TENANT_ID,
            transactionType: 'ISSUANCE',
          }),
        );
      });

      it('does not send an email when the stakeholder has no email address', async () => {
        prisma.stakeholder.findUnique.mockResolvedValue({
          id: STAKEHOLDER_ID,
          tenantId: TENANT_ID,
          name: 'Anonymous Entity',
          email: null,
        });
        await service.recordTransaction(baseInput);
        expect(emailService.sendLedgerNotification).not.toHaveBeenCalled();
      });

      it('still records the ledger entry and returns it even when email sending fails', async () => {
        emailService.sendLedgerNotification.mockRejectedValue(new Error('Postmark unavailable'));
        const result = await service.recordTransaction(baseInput);
        expect(result.id).toBe('tx-1');
        expect(prisma.ledgerTransaction.create).toHaveBeenCalledOnce();
      });
    });
  });

  describe('getStakeholderBalance', () => {
    it('returns 0 when there are no transactions', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('0');
    });

    it('adds ISSUANCE quantities to the balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000') },
        { transactionType: 'ISSUANCE', quantity: new Decimal('500') },
      ]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('1500');
    });

    it('adds VEST quantities to the balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'VEST', quantity: new Decimal('250') },
      ]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('250');
    });

    it('subtracts EXERCISE quantities from the balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000') },
        { transactionType: 'EXERCISE', quantity: new Decimal('300') },
      ]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('700');
    });

    it('subtracts TRANSFER quantities from the balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000') },
        { transactionType: 'TRANSFER', quantity: new Decimal('200') },
      ]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('800');
    });

    it('subtracts CANCELLATION quantities from the balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000') },
        { transactionType: 'CANCELLATION', quantity: new Decimal('400') },
      ]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('600');
    });

    it('adds ADJUSTMENT quantities (positive or negative sign in quantity)', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000') },
        { transactionType: 'ADJUSTMENT', quantity: new Decimal('-50') },
      ]);
      const balance = await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID);
      expect(balance.toString()).toBe('950');
    });

    it('passes asOf date filter to the query', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      const asOf = new Date('2024-01-01');
      await service.getStakeholderBalance(TENANT_ID, STAKEHOLDER_ID, SECURITY_ID, asOf);
      expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ timestamp: { lte: asOf } }),
        }),
      );
    });
  });

  describe('validateLedgerChain', () => {
    it('returns valid=true and no errors for an empty ledger', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      const result = await service.validateLedgerChain(TENANT_ID);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=true for a correct single-entry chain', async () => {
      const data = AuditTrail.computeDataHash({ type: 'ISSUANCE', qty: '1000' });
      const chain = AuditTrail.computeChainHash(data, null);
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { id: 'tx-1', dataHash: data, previousRowHash: null, chainHash: chain },
      ]);
      const result = await service.validateLedgerChain(TENANT_ID);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=true for a correct two-entry chain', async () => {
      const data1 = AuditTrail.computeDataHash({ type: 'ISSUANCE', qty: '1000' });
      const chain1 = AuditTrail.computeChainHash(data1, null);
      const data2 = AuditTrail.computeDataHash({ type: 'VEST', qty: '250' });
      const chain2 = AuditTrail.computeChainHash(data2, chain1);

      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { id: 'tx-1', dataHash: data1, previousRowHash: null, chainHash: chain1 },
        { id: 'tx-2', dataHash: data2, previousRowHash: chain1, chainHash: chain2 },
      ]);
      const result = await service.validateLedgerChain(TENANT_ID);
      expect(result.valid).toBe(true);
    });

    it('reports an error when a chain hash has been tampered', async () => {
      const data1 = AuditTrail.computeDataHash({ type: 'ISSUANCE', qty: '1000' });
      const chain1 = AuditTrail.computeChainHash(data1, null);
      const data2 = AuditTrail.computeDataHash({ type: 'VEST', qty: '250' });
      const tamperedChain2 = 'aaaa0000tampered0000bbbb';

      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { id: 'tx-1', dataHash: data1, previousRowHash: null, chainHash: chain1 },
        { id: 'tx-2', dataHash: data2, previousRowHash: chain1, chainHash: tamperedChain2 },
      ]);
      const result = await service.validateLedgerChain(TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports an error when the previousRowHash link is broken', async () => {
      const data1 = AuditTrail.computeDataHash({ type: 'ISSUANCE', qty: '1000' });
      const chain1 = AuditTrail.computeChainHash(data1, null);
      const data2 = AuditTrail.computeDataHash({ type: 'VEST', qty: '250' });
      const chain2 = AuditTrail.computeChainHash(data2, chain1);

      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { id: 'tx-1', dataHash: data1, previousRowHash: null, chainHash: chain1 },
        // tx-2 references a different previous hash than tx-1's chain hash
        { id: 'tx-2', dataHash: data2, previousRowHash: 'wrong-prev-hash', chainHash: chain2 },
      ]);
      const result = await service.validateLedgerChain(TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('tx-2'))).toBe(true);
    });
  });

  describe('getLedgerReportAsOf', () => {
    it('returns a report with transactions up to the given date', async () => {
      const asOf = new Date('2024-06-01');
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { id: 'tx-1', transactionType: 'ISSUANCE' },
        { id: 'tx-2', transactionType: 'VEST' },
      ]);

      const report = await service.getLedgerReportAsOf(TENANT_ID, asOf);
      expect(report.tenantId).toBe(TENANT_ID);
      expect(report.asOfDate).toEqual(asOf);
      expect(report.transactionCount).toBe(2);
      expect(report.transactions).toHaveLength(2);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('queries only transactions at or before the asOf date', async () => {
      const asOf = new Date('2023-12-31');
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      await service.getLedgerReportAsOf(TENANT_ID, asOf);
      expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ timestamp: { lte: asOf } }),
        }),
      );
    });
  });
});
