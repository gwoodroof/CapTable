import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, StakeholderType } from '@prisma/client';

@Injectable()
export class StakeholderService {
  constructor(private prisma: PrismaService) {}

  async createStakeholder(tenantId: string, data: { name: string; email?: string; type: StakeholderType }) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Stakeholder name is required');
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      if (data.email) {
        const existing = await tx.stakeholder.findUnique({
          where: { tenantId_email: { tenantId, email: data.email } },
        });
        if (existing) {
          throw new ConflictException(`A stakeholder with email ${data.email} already exists`);
        }
      }

      return tx.stakeholder.create({
        data: { name: data.name.trim(), email: data.email || null, type: data.type, tenantId },
      });
    });
  }

  async listStakeholders(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.stakeholder.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getStakeholderById(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const sh = await tx.stakeholder.findUnique({ where: { id } });
      if (!sh || sh.tenantId !== tenantId) throw new NotFoundException('Stakeholder not found');
      return sh;
    });
  }

  async getAdminStakeholderSummary(tenantId: string, stakeholderId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const stakeholder = await tx.stakeholder.findUnique({ where: { id: stakeholderId } });
      if (!stakeholder || stakeholder.tenantId !== tenantId) throw new NotFoundException('Stakeholder not found');

      const transactions = await tx.ledgerTransaction.findMany({
        where: { tenantId, stakeholderId },
        include: { security: true },
        orderBy: { timestamp: 'asc' },
      });

      const securityMap = new Map<string, {
        security: { id: string; type: string; name: string | null };
        issued: number; vested: number; exercised: number; cancelled: number; transferred: number;
      }>();

      for (const txn of transactions) {
        const key = txn.securityId;
        if (!securityMap.has(key)) {
          securityMap.set(key, { security: { id: txn.security.id, type: txn.security.type, name: txn.security.name }, issued: 0, vested: 0, exercised: 0, cancelled: 0, transferred: 0 });
        }
        const entry = securityMap.get(key)!;
        const qty = Number(txn.quantity);
        if (txn.transactionType === 'ISSUANCE')    entry.issued    += qty;
        if (txn.transactionType === 'VEST')        entry.vested    += qty;
        if (txn.transactionType === 'EXERCISE')    entry.exercised += qty;
        if (txn.transactionType === 'CANCELLATION') entry.cancelled += qty;
        if (txn.transactionType === 'TRANSFER')    entry.transferred += qty;
      }

      const balances = Array.from(securityMap.values()).map((e) => ({
        ...e,
        net: e.issued + e.vested - e.exercised - e.cancelled - e.transferred,
      }));

      const grants = await tx.grant.findMany({
        where: { tenantId, stakeholderId },
        include: { security: true, vestingSchedule: true },
        orderBy: { grantDate: 'asc' },
      });

      const optionSecurityIds = grants
        .filter((g) => g.security.type === 'OPTION')
        .map((g) => g.securityId);

      const vestingEvents = optionSecurityIds.length
        ? transactions
            .filter((t) => optionSecurityIds.includes(t.securityId) && (t.transactionType === 'ISSUANCE' || t.transactionType === 'VEST'))
            .map((t) => ({ timestamp: t.timestamp, quantity: Number(t.quantity), transactionType: t.transactionType }))
        : [];

      return { stakeholder, balances, grants, vestingEvents };
    });
  }

  async getMyEquity(tenantId: string, email: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const stakeholder = await tx.stakeholder.findUnique({
        where: { tenantId_email: { tenantId, email } },
      });
      if (!stakeholder) {
        return { stakeholder: null, balances: [], grants: [], vestingEvents: [] };
      }
      // Re-use the inner logic directly on tx (avoid nested withTenant)
      return this._summaryOnTx(tx, tenantId, stakeholder.id);
    });
  }

  async getStakeholderSummary(tenantId: string, stakeholderId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const stakeholder = await tx.stakeholder.findUnique({ where: { id: stakeholderId } });
      if (!stakeholder || stakeholder.tenantId !== tenantId) throw new Error('Stakeholder not found');
      return { stakeholder, totalShares: '0', vested: '0', unvested: '0', exercisable: '0', grants: [] };
    });
  }

  // Inner helper used by both getAdminStakeholderSummary and getMyEquity
  // to avoid nesting withTenant transactions.
  private async _summaryOnTx(tx: Prisma.TransactionClient, tenantId: string, stakeholderId: string) {
    const stakeholder = await tx.stakeholder.findUnique({ where: { id: stakeholderId } });
    if (!stakeholder || stakeholder.tenantId !== tenantId) throw new NotFoundException('Stakeholder not found');

    const transactions = await tx.ledgerTransaction.findMany({
      where: { tenantId, stakeholderId },
      include: { security: true },
      orderBy: { timestamp: 'asc' },
    });

    const securityMap = new Map<string, {
      security: { id: string; type: string; name: string | null };
      issued: number; vested: number; exercised: number; cancelled: number; transferred: number;
    }>();

    for (const txn of transactions) {
      const key = txn.securityId;
      if (!securityMap.has(key)) {
        securityMap.set(key, { security: { id: txn.security.id, type: txn.security.type, name: txn.security.name }, issued: 0, vested: 0, exercised: 0, cancelled: 0, transferred: 0 });
      }
      const entry = securityMap.get(key)!;
      const qty = Number(txn.quantity);
      if (txn.transactionType === 'ISSUANCE')    entry.issued    += qty;
      if (txn.transactionType === 'VEST')        entry.vested    += qty;
      if (txn.transactionType === 'EXERCISE')    entry.exercised += qty;
      if (txn.transactionType === 'CANCELLATION') entry.cancelled += qty;
      if (txn.transactionType === 'TRANSFER')    entry.transferred += qty;
    }

    const balances = Array.from(securityMap.values()).map((e) => ({
      ...e,
      net: e.issued + e.vested - e.exercised - e.cancelled - e.transferred,
    }));

    const grants = await tx.grant.findMany({
      where: { tenantId, stakeholderId },
      include: { security: true, vestingSchedule: true },
      orderBy: { grantDate: 'asc' },
    });

    const optionSecurityIds = grants
      .filter((g) => g.security.type === 'OPTION')
      .map((g) => g.securityId);

    const vestingEvents = optionSecurityIds.length
      ? transactions
          .filter((t) => optionSecurityIds.includes(t.securityId) && (t.transactionType === 'ISSUANCE' || t.transactionType === 'VEST'))
          .map((t) => ({ timestamp: t.timestamp, quantity: Number(t.quantity), transactionType: t.transactionType }))
      : [];

    return { stakeholder, balances, grants, vestingEvents };
  }
}
