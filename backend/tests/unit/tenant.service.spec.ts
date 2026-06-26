import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantService } from '../../src/modules/tenant/tenant.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

const makePrisma = () => {
  const p = {
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ledgerTransaction: {
      findMany: vi.fn(),
    },
    companyMembership: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stakeholder: {
      findMany: vi.fn(),
    },
    withTenant: vi.fn(async (_: string, fn: (tx: any) => Promise<any>) => fn(p)),
  };
  return p;
};

const makeLedgerService = () => ({
  getStakeholderBalance: vi.fn(),
  recordTransaction: vi.fn(),
  validateLedgerChain: vi.fn(),
});

describe('TenantService', () => {
  let service: TenantService;
  let prisma: ReturnType<typeof makePrisma>;
  let ledger: ReturnType<typeof makeLedgerService>;

  beforeEach(() => {
    prisma = makePrisma();
    ledger = makeLedgerService();
    service = new TenantService(prisma as any, ledger as any);
  });

  describe('initTenant', () => {
    it('creates and returns a new tenant', async () => {
      prisma.tenant.create.mockResolvedValue({ id: TENANT_ID, name: 'Acme', authorizedShares: '10000000', parValue: '0.0001' });

      const result = await service.initTenant('Acme', '10000000', '0.0001');
      expect(result.id).toBe(TENANT_ID);
      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Acme' }) }),
      );
    });

    it('allows two tenants with the same name', async () => {
      prisma.tenant.create
        .mockResolvedValueOnce({ id: 'tenant-a', name: 'Acme' })
        .mockResolvedValueOnce({ id: 'tenant-b', name: 'Acme' });

      const first = await service.initTenant('Acme', '10000000', '0.0001');
      const second = await service.initTenant('Acme', '10000000', '0.0001');
      expect(first.id).toBe('tenant-a');
      expect(second.id).toBe('tenant-b');
      expect(prisma.tenant.create).toHaveBeenCalledTimes(2);
    });

    it('throws BadRequestException when authorizedShares exceeds 12 decimal places', async () => {
      await expect(
        service.initTenant('NewCo', '1000000.1234567890123', '0.0001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when parValue exceeds 10 decimal places', async () => {
      await expect(
        service.initTenant('NewCo', '10000000', '0.12345678901'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts whole number authorizedShares', async () => {
      prisma.tenant.create.mockResolvedValue({ id: TENANT_ID });
      await expect(service.initTenant('StartupCo', '5000000', '0.001')).resolves.toBeDefined();
    });
  });

  describe('getTenant', () => {
    it('returns tenant by ID', async () => {
      const tenant = { id: TENANT_ID, name: 'Acme' };
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      const result = await service.getTenant(TENANT_ID);
      expect(result).toEqual(tenant);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: TENANT_ID } });
    });

    it('returns null when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      expect(await service.getTenant('nonexistent')).toBeNull();
    });
  });

  describe('getTotalIssuedShares', () => {
    it('returns 0 when there are no ISSUANCE or VEST transactions', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      const total = await service.getTotalIssuedShares(TENANT_ID);
      expect(total.toString()).toBe('0');
    });

    it('sums ISSUANCE and VEST transaction quantities', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { quantity: new Decimal('4000000') },
        { quantity: new Decimal('3000000') },
        { quantity: new Decimal('500000') },
      ]);
      const total = await service.getTotalIssuedShares(TENANT_ID);
      expect(total.toString()).toBe('7500000');
    });

    it('queries only ISSUANCE and VEST transaction types', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([]);
      await service.getTotalIssuedShares(TENANT_ID);
      expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionType: { in: ['ISSUANCE', 'VEST'] },
          }),
        }),
      );
    });

    it('uses Decimal precision for large share counts', async () => {
      prisma.ledgerTransaction.findMany.mockResolvedValue([
        { quantity: new Decimal('1000000.123456789012') },
        { quantity: new Decimal('2000000.000000000001') },
      ]);
      const total = await service.getTotalIssuedShares(TENANT_ID);
      expect(total.toString()).toBe('3000000.123456789013');
    });
  });

  describe('getTenantStakeholders', () => {
    it('returns stakeholder rows with null membership when no platform accounts match', async () => {
      prisma.stakeholder.findMany.mockResolvedValue([
        { id: 's-1', name: 'Alice', email: 'alice@example.com', type: 'INDIVIDUAL', tenantId: TENANT_ID, createdAt: new Date() },
      ]);
      prisma.companyMembership.findMany.mockResolvedValue([]);

      const result = await service.getTenantStakeholders(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].isStakeholder).toBe(true);
      expect(result[0].membership).toBeNull();
    });

    it('annotates stakeholder rows with their membership role when a matching user exists', async () => {
      prisma.stakeholder.findMany.mockResolvedValue([
        { id: 's-1', name: 'Alice', email: 'alice@example.com', type: 'INDIVIDUAL', tenantId: TENANT_ID, createdAt: new Date() },
      ]);
      prisma.companyMembership.findMany.mockResolvedValue([
        { userId: USER_ID, tenantId: TENANT_ID, role: 'ADMIN', createdAt: new Date(), user: { id: USER_ID, email: 'alice@example.com' } },
      ]);

      const result = await service.getTenantStakeholders(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].isStakeholder).toBe(true);
      expect(result[0].membership).toEqual({ userId: USER_ID, role: 'ADMIN' });
    });

    it('includes a member-only row for a user with CompanyMembership but no Stakeholder record', async () => {
      prisma.stakeholder.findMany.mockResolvedValue([]);
      prisma.companyMembership.findMany.mockResolvedValue([
        { userId: USER_ID, tenantId: TENANT_ID, role: 'ADMIN', createdAt: new Date(), user: { id: USER_ID, email: 'admin@example.com' } },
      ]);

      const result = await service.getTenantStakeholders(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].isStakeholder).toBe(false);
      expect(result[0].name).toBe('admin@example.com');
      expect(result[0].type).toBeNull();
      expect(result[0].membership).toEqual({ userId: USER_ID, role: 'ADMIN' });
    });

    it('does not double-count a user who is both a Stakeholder and has a CompanyMembership', async () => {
      prisma.stakeholder.findMany.mockResolvedValue([
        { id: 's-1', name: 'Alice', email: 'alice@example.com', type: 'INDIVIDUAL', tenantId: TENANT_ID, createdAt: new Date() },
      ]);
      prisma.companyMembership.findMany.mockResolvedValue([
        { userId: USER_ID, tenantId: TENANT_ID, role: 'ADMIN', createdAt: new Date(), user: { id: USER_ID, email: 'alice@example.com' } },
      ]);

      const result = await service.getTenantStakeholders(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].isStakeholder).toBe(true);
      expect(result[0].membership).toEqual({ userId: USER_ID, role: 'ADMIN' });
    });

    it('returns empty array when tenant has no stakeholders and no memberships', async () => {
      prisma.stakeholder.findMany.mockResolvedValue([]);
      prisma.companyMembership.findMany.mockResolvedValue([]);
      const result = await service.getTenantStakeholders(TENANT_ID);
      expect(result).toEqual([]);
    });
  });

  describe('updateTenant', () => {
    it('updates name, website, and iconUrl stored as a base64 data URL', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const updated = { id: TENANT_ID, name: 'NewName', website: 'https://example.com', iconUrl: dataUrl };
      prisma.tenant.update.mockResolvedValue(updated);

      const result = await service.updateTenant(TENANT_ID, { name: 'NewName', website: 'https://example.com', iconUrl: dataUrl });
      expect(result).toEqual(updated);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { name: 'NewName', website: 'https://example.com', iconUrl: dataUrl },
      });
    });

    it('allows partial updates (name only)', async () => {
      const updated = { id: TENANT_ID, name: 'Renamed', website: null, iconUrl: null };
      prisma.tenant.update.mockResolvedValue(updated);

      const result = await service.updateTenant(TENANT_ID, { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { name: 'Renamed' },
      });
    });

    it('allows clearing iconUrl', async () => {
      const updated = { id: TENANT_ID, iconUrl: null };
      prisma.tenant.update.mockResolvedValue(updated);

      const result = await service.updateTenant(TENANT_ID, { iconUrl: undefined });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { iconUrl: undefined },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('updateMembershipRole', () => {
    it('updates the membership role and returns the updated record', async () => {
      const existing = { userId: USER_ID, tenantId: TENANT_ID, role: 'STAKEHOLDER' };
      const updated = { ...existing, role: 'ADMIN' };
      prisma.companyMembership.findUnique.mockResolvedValue(existing);
      prisma.companyMembership.update.mockResolvedValue(updated);

      const result = await service.updateMembershipRole(TENANT_ID, USER_ID, 'ADMIN');
      expect(result.role).toBe('ADMIN');
      expect(prisma.companyMembership.update).toHaveBeenCalledWith({
        where: { userId_tenantId: { userId: USER_ID, tenantId: TENANT_ID } },
        data: { role: 'ADMIN' },
      });
    });

    it('throws NotFoundException when the user has no membership in this company', async () => {
      prisma.companyMembership.findUnique.mockResolvedValue(null);
      await expect(service.updateMembershipRole(TENANT_ID, 'unknown-user', 'ADMIN')).rejects.toThrow(NotFoundException);
    });

    it('allows downgrading an admin back to stakeholder', async () => {
      const existing = { userId: USER_ID, tenantId: TENANT_ID, role: 'ADMIN' };
      prisma.companyMembership.findUnique.mockResolvedValue(existing);
      prisma.companyMembership.update.mockResolvedValue({ ...existing, role: 'STAKEHOLDER' });

      const result = await service.updateMembershipRole(TENANT_ID, USER_ID, 'STAKEHOLDER');
      expect(result.role).toBe('STAKEHOLDER');
    });
  });
});
