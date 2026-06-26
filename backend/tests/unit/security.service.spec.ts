import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SecurityService } from '../../src/modules/security/security.service';

const TENANT_ID = 'tenant-1';

const makePrisma = () => ({
  security: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
});

describe('SecurityService', () => {
  let service: SecurityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SecurityService(prisma as any);
  });

  describe('createSecurity', () => {
    it('creates and returns a security', async () => {
      prisma.security.create.mockResolvedValue({ id: 'sec-1', name: 'Series A', type: 'PREFERRED_STOCK', tenantId: TENANT_ID });
      const result = await service.createSecurity(TENANT_ID, { name: 'Series A', type: 'PREFERRED_STOCK' });
      expect(result.id).toBe('sec-1');
      expect(prisma.security.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Series A', type: 'PREFERRED_STOCK', tenantId: TENANT_ID }) }),
      );
    });

    it('trims whitespace from security name', async () => {
      prisma.security.create.mockResolvedValue({ id: 'sec-2' });
      await service.createSecurity(TENANT_ID, { name: '  Options Pool  ', type: 'OPTION' });
      expect(prisma.security.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Options Pool' }) }),
      );
    });

    it('throws BadRequestException for an empty name', async () => {
      await expect(
        service.createSecurity(TENANT_ID, { name: '', type: 'COMMON_STOCK' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a whitespace-only name', async () => {
      await expect(
        service.createSecurity(TENANT_ID, { name: '   ', type: 'COMMON_STOCK' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates all supported security types', async () => {
      const types = ['COMMON_STOCK', 'PREFERRED_STOCK', 'OPTION', 'SAFE', 'CONVERTIBLE_NOTE', 'WARRANT'] as const;
      for (const type of types) {
        prisma.security.create.mockResolvedValue({ id: `sec-${type}`, type, tenantId: TENANT_ID });
        await expect(
          service.createSecurity(TENANT_ID, { name: `Test ${type}`, type }),
        ).resolves.toBeDefined();
      }
    });
  });

  describe('listSecurities', () => {
    it('returns all securities for the tenant', async () => {
      const securities = [{ id: 'sec-1', type: 'COMMON_STOCK' }, { id: 'sec-2', type: 'OPTION' }];
      prisma.security.findMany.mockResolvedValue(securities);

      const result = await service.listSecurities(TENANT_ID);
      expect(result).toEqual(securities);
      expect(prisma.security.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID } }),
      );
    });

    it('returns an empty array when no securities exist', async () => {
      prisma.security.findMany.mockResolvedValue([]);
      expect(await service.listSecurities(TENANT_ID)).toHaveLength(0);
    });
  });
});
