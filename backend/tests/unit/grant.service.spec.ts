import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GrantService } from '../../src/modules/grant/grant.service';

const TENANT_ID = 'tenant-1';
const SH_ID = 'sh-1';
const SEC_ID = 'sec-1';
const VS_ID = 'vs-1';
const USER_ID = 'user-1';

const makePrisma = () => ({
  stakeholder: { findUnique: vi.fn() },
  security: { findUnique: vi.fn() },
  vestingSchedule: { findUnique: vi.fn() },
  grant: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
});

const makeLedgerService = () => ({
  recordTransaction: vi.fn(),
});

const validData = {
  stakeholderId: SH_ID,
  securityId: SEC_ID,
  vestingScheduleId: VS_ID,
  quantity: '10000',
  strikePrice: '0.50',
  grantDate: '2024-01-15',
};

describe('GrantService', () => {
  let service: GrantService;
  let prisma: ReturnType<typeof makePrisma>;
  let ledger: ReturnType<typeof makeLedgerService>;

  beforeEach(() => {
    prisma = makePrisma();
    ledger = makeLedgerService();
    service = new GrantService(prisma as any, ledger as any);

    prisma.stakeholder.findUnique.mockResolvedValue({ id: SH_ID, tenantId: TENANT_ID });
    prisma.security.findUnique.mockResolvedValue({ id: SEC_ID, tenantId: TENANT_ID });
    prisma.vestingSchedule.findUnique.mockResolvedValue({ id: VS_ID, tenantId: TENANT_ID });
    prisma.grant.create.mockResolvedValue({
      id: 'grant-1', ...validData, tenantId: TENANT_ID,
      stakeholder: { id: SH_ID }, security: { id: SEC_ID }, vestingSchedule: { id: VS_ID },
    });
    ledger.recordTransaction.mockResolvedValue({ id: 'tx-1' });
  });

  describe('createGrant', () => {
    it('creates a grant and a linked ledger entry', async () => {
      const result = await service.createGrant(TENANT_ID, USER_ID, validData);
      expect(result.grant.id).toBe('grant-1');
      expect(result.ledgerEntry.id).toBe('tx-1');
      expect(prisma.grant.create).toHaveBeenCalledOnce();
      expect(ledger.recordTransaction).toHaveBeenCalledOnce();
    });

    it('passes initiatedBy and correct quantity to ledger.recordTransaction', async () => {
      await service.createGrant(TENANT_ID, USER_ID, validData);
      expect(ledger.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          transactionType: 'ISSUANCE',
          stakeholderId: SH_ID,
          securityId: SEC_ID,
          quantity: '10000',
          pricePerShare: '0.50',
          initiatedBy: USER_ID,
        }),
      );
    });

    it('creates a grant with no strikePrice (e.g., RSU)', async () => {
      prisma.grant.create.mockResolvedValue({ id: 'grant-2', tenantId: TENANT_ID });
      const { strikePrice: _ignored, ...dataWithoutPrice } = validData;
      await expect(service.createGrant(TENANT_ID, USER_ID, dataWithoutPrice)).resolves.toBeDefined();
    });

    it('throws BadRequestException when quantity exceeds 12 decimal places', async () => {
      await expect(
        service.createGrant(TENANT_ID, USER_ID, { ...validData, quantity: '100.1234567890123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when strikePrice exceeds 10 decimal places', async () => {
      await expect(
        service.createGrant(TENANT_ID, USER_ID, { ...validData, strikePrice: '0.12345678901' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stakeholder does not belong to tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: SH_ID, tenantId: 'other-tenant' });
      await expect(service.createGrant(TENANT_ID, USER_ID, validData)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stakeholder is not found', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.createGrant(TENANT_ID, USER_ID, validData)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when security does not belong to tenant', async () => {
      prisma.security.findUnique.mockResolvedValue({ id: SEC_ID, tenantId: 'other-tenant' });
      await expect(service.createGrant(TENANT_ID, USER_ID, validData)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when vesting schedule does not belong to tenant', async () => {
      prisma.vestingSchedule.findUnique.mockResolvedValue({ id: VS_ID, tenantId: 'other-tenant' });
      await expect(service.createGrant(TENANT_ID, USER_ID, validData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('listGrants', () => {
    it('returns all grants for the tenant including related entities', async () => {
      const grants = [
        { id: 'grant-1', stakeholder: { id: SH_ID }, security: { id: SEC_ID }, vestingSchedule: { id: VS_ID } },
        { id: 'grant-2', stakeholder: { id: SH_ID }, security: { id: SEC_ID }, vestingSchedule: { id: VS_ID } },
      ];
      prisma.grant.findMany.mockResolvedValue(grants);

      const result = await service.listGrants(TENANT_ID);
      expect(result).toEqual(grants);
      expect(prisma.grant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID } }),
      );
    });
  });
});
