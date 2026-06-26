/**
 * Security tests: multi-tenant isolation
 *
 * These tests verify that a tenant cannot read or write data belonging to
 * another tenant — the core security invariant of the system.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { StakeholderService } from '../../src/modules/stakeholder/stakeholder.service';
import { GrantService } from '../../src/modules/grant/grant.service';
import { TenantInterceptor } from '../../src/common/interceptors/tenant.interceptor';
import { firstValueFrom, of } from 'rxjs';

const T1 = 'tenant-1';
const T2 = 'tenant-2';

const makePrisma = () => ({
  tenant: {
    findUnique: vi.fn().mockImplementation(({ where: { id } }) =>
      Promise.resolve(id === T1 ? { id: T1 } : null),
    ),
  },
  stakeholder: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  security: {
    findUnique: vi.fn(),
  },
  vestingSchedule: {
    findUnique: vi.fn(),
  },
  grant: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  ledgerTransaction: {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'tx-1', dataHash: 'dh', previousRowHash: null, chainHash: 'ch' }),
  },
});

describe('Security: Tenant Isolation', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let ledgerService: LedgerService;
  let stakeholderService: StakeholderService;
  let grantService: GrantService;

  beforeEach(() => {
    prisma = makePrisma();
    ledgerService = new LedgerService(prisma as any);
    stakeholderService = new StakeholderService(prisma as any);
    grantService = new GrantService(prisma as any, ledgerService);
  });

  describe('LedgerService.recordTransaction', () => {
    it('rejects a transaction where the tenant does not exist', async () => {
      // T2 does not exist (mock returns null for T2)
      await expect(
        ledgerService.recordTransaction({
          tenantId: T2,
          transactionType: 'ISSUANCE',
          stakeholderId: 'sh-1',
          securityId: 'sec-1',
          quantity: '100',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a transaction where the stakeholder belongs to a different tenant', async () => {
      // Stakeholder "sh-from-t2" actually belongs to T2
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'sh-from-t2', tenantId: T2 });
      prisma.security.findUnique.mockResolvedValue({ id: 'sec-1', tenantId: T1 });

      await expect(
        ledgerService.recordTransaction({
          tenantId: T1,
          transactionType: 'ISSUANCE',
          stakeholderId: 'sh-from-t2',
          securityId: 'sec-1',
          quantity: '100',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a transaction where the security belongs to a different tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'sh-1', tenantId: T1 });
      // Security "sec-from-t2" belongs to T2
      prisma.security.findUnique.mockResolvedValue({ id: 'sec-from-t2', tenantId: T2 });

      await expect(
        ledgerService.recordTransaction({
          tenantId: T1,
          transactionType: 'ISSUANCE',
          stakeholderId: 'sh-1',
          securityId: 'sec-from-t2',
          quantity: '100',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('StakeholderService', () => {
    it('getStakeholderById throws NotFoundException for a cross-tenant lookup', async () => {
      // Stakeholder exists but belongs to T2
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'sh-2', tenantId: T2 });
      const { NotFoundException } = await import('@nestjs/common');
      await expect(stakeholderService.getStakeholderById(T1, 'sh-2')).rejects.toThrow(NotFoundException);
    });

    it('getAdminStakeholderSummary throws NotFoundException for a cross-tenant stakeholder', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'sh-2', tenantId: T2 });
      const { NotFoundException } = await import('@nestjs/common');
      await expect(stakeholderService.getAdminStakeholderSummary(T1, 'sh-2')).rejects.toThrow(NotFoundException);
    });

    it('listStakeholders filters by tenantId so T2 stakeholders never appear in T1 results', async () => {
      prisma.stakeholder.findMany.mockResolvedValue([
        { id: 'sh-1', tenantId: T1 },
      ]);
      const results = await stakeholderService.listStakeholders(T1);
      expect(results.every((s: any) => s.tenantId === T1)).toBe(true);
      expect(prisma.stakeholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: T1 } }),
      );
    });
  });

  describe('GrantService.createGrant', () => {
    it('prevents creating a grant with a stakeholder from another tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'sh-t2', tenantId: T2 });
      prisma.security.findUnique.mockResolvedValue({ id: 'sec-1', tenantId: T1 });
      prisma.vestingSchedule.findUnique.mockResolvedValue({ id: 'vs-1', tenantId: T1 });

      await expect(
        grantService.createGrant(T1, 'admin', {
          stakeholderId: 'sh-t2', securityId: 'sec-1', vestingScheduleId: 'vs-1',
          quantity: '1000', grantDate: '2024-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents creating a grant with a vesting schedule from another tenant', async () => {
      prisma.stakeholder.findUnique.mockResolvedValue({ id: 'sh-1', tenantId: T1 });
      prisma.security.findUnique.mockResolvedValue({ id: 'sec-1', tenantId: T1 });
      prisma.vestingSchedule.findUnique.mockResolvedValue({ id: 'vs-t2', tenantId: T2 });

      await expect(
        grantService.createGrant(T1, 'admin', {
          stakeholderId: 'sh-1', securityId: 'sec-1', vestingScheduleId: 'vs-t2',
          quantity: '1000', grantDate: '2024-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TenantInterceptor (HTTP-layer isolation)', () => {
    const interceptor = new TenantInterceptor();
    const next = { handle: () => of('ok') };

    it('blocks a request where the JWT tenant does not match the route param tenant', () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ tenantId: T1, params: { tenantId: T2 } }),
        }),
      };
      expect(() => interceptor.intercept(ctx as any, next as any)).toThrow(ForbiddenException);
    });

    it('allows a request where the JWT tenant matches the route param tenant', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ tenantId: T1, params: { tenantId: T1 } }),
        }),
      };
      const v = await firstValueFrom(interceptor.intercept(ctx as any, next as any));
      expect(v).toBe('ok');
    });

    it('allows a request with no param tenantId (non-tenant-scoped route)', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ tenantId: T1, params: {} }),
        }),
      };
      const v = await firstValueFrom(interceptor.intercept(ctx as any, next as any));
      expect(v).toBe('ok');
    });
  });
});
