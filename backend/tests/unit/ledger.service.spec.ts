import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { AuditTrail } from '../../src/common/utils/audit-trail';

const TENANT_ID = 'tenant-abc';
const STAKEHOLDER_ID = 'sh-1';
const SECURITY_ID = 'sec-1';

const makePrisma = () => {
  const p = {
    tenant: { findUnique: vi.fn() },
    stakeholder: { findUnique: vi.fn() },
    security: { findUnique: vi.fn() },
    ledgerTransaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    withTenant: vi.fn(async (_: string, fn: (tx: any) => Promise<any>) => fn(p)),
  };
  return p;
};

const makeEmailService = () => ({
  sendLedgerNotification: vi.fn().mockResolvedValue(undefined),
});

const makeCertificateService = () => ({
  generate: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-bytes')),
});

const validTenant = { id: TENANT_ID, name: 'Acme Corp', iconUrl: null };
const validStakeholder = { id: STAKEHOLDER_ID, tenantId: TENANT_ID, name: 'Alice', email: 'alice@example.com' };
const validSecurity = { id: SECURITY_ID, tenantId: TENANT_ID, type: 'COMMON_STOCK', name: 'Common Stock' };

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof makePrisma>;
  let emailService: ReturnType<typeof makeEmailService>;
  let certificateService: ReturnType<typeof makeCertificateService>;

  beforeEach(() => {
    prisma = makePrisma();
    emailService = makeEmailService();
    certificateService = makeCertificateService();
    service = new LedgerService(prisma as any, emailService as any, certificateService as any);
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
      prisma.ledgerTransaction.count.mockResolvedValue(0);
      // Return what was passed in so certificateNumber is preserved
      prisma.ledgerTransaction.create.mockImplementation(async ({ data }: any) => ({
        id: 'tx-1',
        dataHash: 'data-hash',
        previousRowHash: null,
        chainHash: 'chain-hash',
        createdAt: new Date(),
        ...data,
      }));
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
        await new Promise((r) => setImmediate(r)); // flush cert async IIFE
        expect(emailService.sendLedgerNotification).toHaveBeenCalledOnce();
        const [params] = emailService.sendLedgerNotification.mock.calls[0];
        expect(params).toMatchObject({
          to: 'alice@example.com',
          stakeholderName: 'Alice',
          companyName: 'Acme Corp',
          tenantId: TENANT_ID,
          transactionType: 'ISSUANCE',
        });
      });

      it('does not send an email when the stakeholder has no email address', async () => {
        prisma.stakeholder.findUnique.mockResolvedValue({
          id: STAKEHOLDER_ID,
          tenantId: TENANT_ID,
          name: 'Anonymous Entity',
          email: null,
        });
        await service.recordTransaction(baseInput);
        await new Promise((r) => setImmediate(r));
        expect(emailService.sendLedgerNotification).not.toHaveBeenCalled();
      });

      it('still records the ledger entry and returns it even when email sending fails', async () => {
        emailService.sendLedgerNotification.mockRejectedValue(new Error('Postmark unavailable'));
        const result = await service.recordTransaction(baseInput);
        expect(result.id).toBe('tx-1');
        expect(prisma.ledgerTransaction.create).toHaveBeenCalledOnce();
      });
    });

    describe('stock certificate generation', () => {
      it('generates a certificate and attaches it for ISSUANCE', async () => {
        await service.recordTransaction(baseInput); // ISSUANCE
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).toHaveBeenCalledOnce();
        expect(certificateService.generate).toHaveBeenCalledWith(
          expect.objectContaining({
            certNumber: 'CS-0001',
            companyName: 'Acme Corp',
            stakeholderName: 'Alice',
            securityLabel: 'Common Stock',
          }),
        );
        const [, attachments] = emailService.sendLedgerNotification.mock.calls[0];
        expect(attachments).toHaveLength(1);
        expect(attachments[0].Name).toBe('certificate-CS-0001.pdf');
        expect(attachments[0].ContentType).toBe('application/pdf');
        expect(attachments[0].Content).toBe(Buffer.from('fake-pdf-bytes').toString('base64'));
      });

      it('generates a certificate for EXERCISE', async () => {
        await service.recordTransaction({ ...baseInput, transactionType: 'EXERCISE' as const });
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).toHaveBeenCalledOnce();
      });

      it('generates a certificate for TRANSFER', async () => {
        await service.recordTransaction({ ...baseInput, transactionType: 'TRANSFER' as const });
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).toHaveBeenCalledOnce();
      });

      it('does NOT generate a certificate for VEST', async () => {
        await service.recordTransaction({ ...baseInput, transactionType: 'VEST' as const });
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).not.toHaveBeenCalled();
      });

      it('does NOT generate a certificate for CANCELLATION', async () => {
        await service.recordTransaction({ ...baseInput, transactionType: 'CANCELLATION' as const });
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).not.toHaveBeenCalled();
      });

      it('does NOT generate a certificate for ADJUSTMENT', async () => {
        await service.recordTransaction({ ...baseInput, transactionType: 'ADJUSTMENT' as const });
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).not.toHaveBeenCalled();
      });

      it('assigns certificate number CS-0001 when no prior certs exist (count=0)', async () => {
        prisma.ledgerTransaction.count.mockResolvedValue(0);
        await service.recordTransaction(baseInput);
        const createCall = prisma.ledgerTransaction.create.mock.calls[0][0];
        expect(createCall.data.certificateNumber).toBe('CS-0001');
      });

      it('assigns CS-0005 when four prior certs exist (count=4)', async () => {
        prisma.ledgerTransaction.count.mockResolvedValue(4);
        await service.recordTransaction(baseInput);
        const createCall = prisma.ledgerTransaction.create.mock.calls[0][0];
        expect(createCall.data.certificateNumber).toBe('CS-0005');
      });

      it('stores null certificateNumber for VEST', async () => {
        await service.recordTransaction({ ...baseInput, transactionType: 'VEST' as const });
        const createCall = prisma.ledgerTransaction.create.mock.calls[0][0];
        expect(createCall.data.certificateNumber).toBeNull();
      });

      it('sends email without attachment when cert generation fails', async () => {
        certificateService.generate.mockRejectedValue(new Error('PDFKit failure'));
        await service.recordTransaction(baseInput);
        await new Promise((r) => setImmediate(r));
        expect(emailService.sendLedgerNotification).toHaveBeenCalledOnce();
        const [, attachments] = emailService.sendLedgerNotification.mock.calls[0];
        expect(attachments).toBeUndefined();
      });

      it('still records the ledger entry when cert generation fails', async () => {
        certificateService.generate.mockRejectedValue(new Error('PDFKit failure'));
        const result = await service.recordTransaction(baseInput);
        expect(result.id).toBe('tx-1');
        expect(prisma.ledgerTransaction.create).toHaveBeenCalledOnce();
      });

      it('does not generate certificate when stakeholder has no email', async () => {
        prisma.stakeholder.findUnique.mockResolvedValue({
          id: STAKEHOLDER_ID,
          tenantId: TENANT_ID,
          name: 'Anonymous Entity',
          email: null,
        });
        await service.recordTransaction(baseInput);
        await new Promise((r) => setImmediate(r));
        expect(certificateService.generate).not.toHaveBeenCalled();
        expect(emailService.sendLedgerNotification).not.toHaveBeenCalled();
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

  describe('getStakeholderHoldings', () => {
    const SELLER_ID = 'seller-1';
    const sec = { id: SECURITY_ID, type: 'COMMON_STOCK', name: 'Common Stock' };

    it('returns empty array when stakeholder has no transactions', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      const result = await service.getStakeholderHoldings(TENANT_ID, SELLER_ID);
      expect(result).toEqual([]);
    });

    it('returns securities with a positive balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000'), securityId: SECURITY_ID, security: sec },
      ]);
      const result = await service.getStakeholderHoldings(TENANT_ID, SELLER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].securityId).toBe(SECURITY_ID);
      expect(result[0].balance).toBe('1000');
    });

    it('excludes securities with a zero net balance', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('500'), securityId: SECURITY_ID, security: sec },
        { transactionType: 'CANCELLATION', quantity: new Decimal('500'), securityId: SECURITY_ID, security: sec },
      ]);
      const result = await service.getStakeholderHoldings(TENANT_ID, SELLER_ID);
      expect(result).toHaveLength(0);
    });

    it('aggregates balance correctly across multiple transaction types', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000'), securityId: SECURITY_ID, security: sec },
        { transactionType: 'CANCELLATION', quantity: new Decimal('200'), securityId: SECURITY_ID, security: sec },
      ]);
      const result = await service.getStakeholderHoldings(TENANT_ID, SELLER_ID);
      expect(result[0].balance).toBe('800');
    });
  });

  describe('buyoutPreview', () => {
    const SELLER_ID = 'seller-1';
    const BUYER_ID = 'buyer-1';
    const previewInput = {
      sellerId: SELLER_ID, buyerId: BUYER_ID, securityId: SECURITY_ID,
      quantity: '100', pricePerShare: '2.50',
    };
    const validSeller = { id: SELLER_ID, tenantId: TENANT_ID, name: 'Alice', email: 'alice@example.com' };
    const validBuyer  = { id: BUYER_ID,  tenantId: TENANT_ID, name: 'Bob',   email: 'bob@example.com' };

    beforeEach(() => {
      prisma.tenant.findUnique.mockResolvedValue(validTenant);
      prisma.stakeholder.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === SELLER_ID) return validSeller;
        if (where.id === BUYER_ID)  return validBuyer;
        return null;
      });
      prisma.security.findUnique.mockResolvedValue(validSecurity);
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { id: 'iso-1', transactionType: 'ISSUANCE', quantity: new Decimal('1000'), securityId: SECURITY_ID, timestamp: new Date('2023-01-01'), pricePerShare: new Decimal('1.00') },
      ]);
    });

    it('throws BadRequestException when seller and buyer are the same', async () => {
      await expect(service.buyoutPreview(TENANT_ID, { ...previewInput, buyerId: SELLER_ID })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when quantity is zero', async () => {
      await expect(service.buyoutPreview(TENANT_ID, { ...previewInput, quantity: '0' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when pricePerShare is zero', async () => {
      await expect(service.buyoutPreview(TENANT_ID, { ...previewInput, pricePerShare: '0' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when tenant is not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.buyoutPreview(TENANT_ID, previewInput)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when seller has insufficient balance', async () => {
      await expect(service.buyoutPreview(TENANT_ID, { ...previewInput, quantity: '5000' })).rejects.toThrow(BadRequestException);
    });

    it('returns a correct preview object', async () => {
      const result = await service.buyoutPreview(TENANT_ID, previewInput);
      expect(result.seller.id).toBe(SELLER_ID);
      expect(result.buyer.id).toBe(BUYER_ID);
      expect(result.sellerBalance).toBe('1000');
      expect(result.quantity).toBe('100');
      expect(result.pricePerShare).toBe('2.50');
      expect(result.totalConsideration).toBe('250');
    });

    it('includes seller issuance history in the preview', async () => {
      const result = await service.buyoutPreview(TENANT_ID, previewInput);
      expect(result.sellerIssuances).toHaveLength(1);
      expect(result.sellerIssuances[0].quantity).toBe('1000');
    });
  });

  describe('buyoutCommit', () => {
    const SELLER_ID = 'seller-1';
    const BUYER_ID = 'buyer-1';
    const commitInput = {
      sellerId: SELLER_ID, buyerId: BUYER_ID, securityId: SECURITY_ID,
      quantity: '100', pricePerShare: '2.50',
    };
    const validSeller = { id: SELLER_ID, tenantId: TENANT_ID, name: 'Alice', email: 'alice@example.com' };
    const validBuyer  = { id: BUYER_ID,  tenantId: TENANT_ID, name: 'Bob',   email: 'bob@example.com' };

    beforeEach(() => {
      prisma.tenant.findUnique.mockResolvedValue(validTenant);
      prisma.stakeholder.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === SELLER_ID) return validSeller;
        if (where.id === BUYER_ID)  return validBuyer;
        return null;
      });
      prisma.security.findUnique.mockResolvedValue(validSecurity);
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: new Decimal('1000'), securityId: SECURITY_ID },
      ]);
      prisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      prisma.ledgerTransaction.count.mockResolvedValue(0);
      prisma.ledgerTransaction.create
        .mockImplementationOnce(async ({ data }: any) => ({ id: 'cancel-tx', createdAt: new Date(), ...data }))
        .mockImplementationOnce(async ({ data }: any) => ({ id: 'issuance-tx', createdAt: new Date(), ...data }));
    });

    it('throws BadRequestException when seller and buyer are the same', async () => {
      await expect(service.buyoutCommit(TENANT_ID, { ...commitInput, buyerId: SELLER_ID })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when seller has insufficient balance at commit time', async () => {
      await expect(service.buyoutCommit(TENANT_ID, { ...commitInput, quantity: '9999' })).rejects.toThrow(BadRequestException);
    });

    it('creates a CANCELLATION for the seller with null certificateNumber and null pricePerShare', async () => {
      await service.buyoutCommit(TENANT_ID, commitInput);
      const firstCreate = prisma.ledgerTransaction.create.mock.calls[0][0];
      expect(firstCreate.data.transactionType).toBe('CANCELLATION');
      expect(firstCreate.data.stakeholderId).toBe(SELLER_ID);
      expect(firstCreate.data.certificateNumber).toBeNull();
      expect(firstCreate.data.pricePerShare).toBeNull();
    });

    it('creates an ISSUANCE for the buyer with a certificate number and pricePerShare', async () => {
      await service.buyoutCommit(TENANT_ID, commitInput);
      const secondCreate = prisma.ledgerTransaction.create.mock.calls[1][0];
      expect(secondCreate.data.transactionType).toBe('ISSUANCE');
      expect(secondCreate.data.stakeholderId).toBe(BUYER_ID);
      expect(secondCreate.data.certificateNumber).toBe('CS-0001');
      expect(secondCreate.data.pricePerShare).toBeDefined();
    });

    it('chains issuance previousRowHash to cancellation chainHash', async () => {
      await service.buyoutCommit(TENANT_ID, commitInput);
      const [first, second] = prisma.ledgerTransaction.create.mock.calls.map((c: any[]) => c[0]);
      expect(second.data.previousRowHash).toBe(first.data.chainHash);
    });

    it('returns both the cancellationEntry and issuanceEntry', async () => {
      const result = await service.buyoutCommit(TENANT_ID, commitInput);
      expect(result.cancellationEntry.id).toBe('cancel-tx');
      expect(result.issuanceEntry.id).toBe('issuance-tx');
    });

    it('fires certificate generation for the buyer', async () => {
      await service.buyoutCommit(TENANT_ID, commitInput);
      await new Promise((r) => setImmediate(r));
      expect(certificateService.generate).toHaveBeenCalledOnce();
    });

    it('sends email notification to the buyer', async () => {
      await service.buyoutCommit(TENANT_ID, commitInput);
      await new Promise((r) => setImmediate(r));
      expect(emailService.sendLedgerNotification).toHaveBeenCalledOnce();
      const [params] = emailService.sendLedgerNotification.mock.calls[0];
      expect(params.to).toBe('bob@example.com');
      expect(params.stakeholderName).toBe('Bob');
    });

    it('skips cert and email when buyer has no email address', async () => {
      prisma.stakeholder.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === SELLER_ID) return validSeller;
        if (where.id === BUYER_ID)  return { ...validBuyer, email: null };
        return null;
      });
      const result = await service.buyoutCommit(TENANT_ID, commitInput);
      await new Promise((r) => setImmediate(r));
      expect(result.cancellationEntry.id).toBe('cancel-tx');
      expect(emailService.sendLedgerNotification).not.toHaveBeenCalled();
      expect(certificateService.generate).not.toHaveBeenCalled();
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
