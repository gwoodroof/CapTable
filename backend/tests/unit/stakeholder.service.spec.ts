import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StakeholderService } from '../../src/modules/stakeholder/stakeholder.service';

const TENANT_ID = 'tenant-1';
const SH_ID = 'sh-1';

const makePrisma = () => {
  const p = {
    stakeholder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    ledgerTransaction: {
      findMany: vi.fn(),
    },
    grant: {
      findMany: vi.fn(),
    },
    withTenant: vi.fn(async (_: string, fn: (tx: any) => Promise<any>) => fn(p)),
  };
  return p;
};

describe('StakeholderService', () => {
  let service: StakeholderService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new StakeholderService(prisma as any);
  });

  describe('createStakeholder', () => {
    it('creates and returns a stakeholder', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue(null);
      prisma.stakeholder.create.mockResolvedValue({ id: SH_ID, name: 'Alice', tenantId: TENANT_ID });

      const result = await service.createStakeholder(TENANT_ID, { name: 'Alice', type: 'INDIVIDUAL' });
      expect(result.id).toBe(SH_ID);
      expect(prisma.stakeholder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Alice', type: 'INDIVIDUAL', tenantId: TENANT_ID }) }),
      );
    });

    it('trims whitespace from name', async () => {
      prisma.stakeholder.create.mockResolvedValue({ id: SH_ID, name: 'Alice' });
      await service.createStakeholder(TENANT_ID, { name: '  Alice  ', type: 'INDIVIDUAL' });
      expect(prisma.stakeholder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Alice' }) }),
      );
    });

    it('throws BadRequestException for an empty name', async () => {
      await expect(
        service.createStakeholder(TENANT_ID, { name: '  ', type: 'INDIVIDUAL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when email already exists in tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'existing', email: 'alice@co.com' });
      await expect(
        service.createStakeholder(TENANT_ID, { name: 'Alice', email: 'alice@co.com', type: 'INDIVIDUAL' }),
      ).rejects.toThrow(ConflictException);
    });

    it('skips email uniqueness check when no email is provided', async () => {
      prisma.stakeholder.create.mockResolvedValue({ id: SH_ID, name: 'Alice' });
      await expect(
        service.createStakeholder(TENANT_ID, { name: 'Alice', type: 'INDIVIDUAL' }),
      ).resolves.toBeDefined();
      expect(prisma.stakeholder.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('listStakeholders', () => {
    it('returns all stakeholders for the tenant', async () => {
      const list = [{ id: 'sh-1' }, { id: 'sh-2' }];
      prisma.stakeholder.findMany.mockResolvedValue(list);
      const result = await service.listStakeholders(TENANT_ID);
      expect(result).toEqual(list);
      expect(prisma.stakeholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID } }),
      );
    });
  });

  describe('getStakeholderById', () => {
    it('returns stakeholder when found in tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: SH_ID, tenantId: TENANT_ID });
      const result = await service.getStakeholderById(TENANT_ID, SH_ID);
      expect(result.id).toBe(SH_ID);
    });

    it('throws NotFoundException when stakeholder does not exist', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.getStakeholderById(TENANT_ID, SH_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when stakeholder belongs to a different tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: SH_ID, tenantId: 'other-tenant' });
      await expect(service.getStakeholderById(TENANT_ID, SH_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyEquity', () => {
    it('returns empty equity when no stakeholder record found for email', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue(null);
      const result = await service.getMyEquity(TENANT_ID, 'unknown@example.com');
      expect(result.stakeholder).toBeNull();
      expect(result.balances).toEqual([]);
      expect(result.grants).toEqual([]);
      expect(result.vestingEvents).toEqual([]);
    });

    it('returns full summary when stakeholder record exists for email', async () => {
      prisma.stakeholder.findUnique
        .mockResolvedValueOnce({ id: SH_ID, tenantId: TENANT_ID })  // findUnique by email
        .mockResolvedValueOnce({ id: SH_ID, tenantId: TENANT_ID }); // findUnique by id in getAdminStakeholderSummary
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: 500, securityId: 'sec-1', security: { id: 'sec-1', type: 'COMMON_STOCK', name: 'Common' } },
      ]);
      prisma.grant.findMany.mockResolvedValue([]);

      const result = await service.getMyEquity(TENANT_ID, 'alice@example.com');
      expect(result.stakeholder).toBeDefined();
      expect(result.balances).toHaveLength(1);
      expect(result.balances[0].net).toBe(500);
    });
  });

  describe('getAdminStakeholderSummary', () => {
    it('returns stakeholder summary with balances and grants', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: SH_ID, tenantId: TENANT_ID });
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { transactionType: 'ISSUANCE', quantity: 1000, securityId: 'sec-1', security: { id: 'sec-1', type: 'COMMON_STOCK', name: 'Common' } },
        { transactionType: 'TRANSFER', quantity: 100, securityId: 'sec-1', security: { id: 'sec-1', type: 'COMMON_STOCK', name: 'Common' } },
      ]);
      prisma.grant.findMany.mockResolvedValue([]);

      const summary = await service.getAdminStakeholderSummary(TENANT_ID, SH_ID);
      expect(summary.stakeholder.id).toBe(SH_ID);
      expect(summary.balances).toHaveLength(1);
      expect(summary.balances[0].net).toBe(900); // 1000 issued - 100 transferred
      expect(summary.grants).toHaveLength(0);
    });

    it('throws NotFoundException when stakeholder is not in tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.getAdminStakeholderSummary(TENANT_ID, SH_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
