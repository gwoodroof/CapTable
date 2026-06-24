import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StakeholderType } from '@prisma/client';

@Injectable()
export class StakeholderService {
  constructor(private prisma: PrismaService) {}

  async createStakeholder(tenantId: string, data: { name: string; email?: string; type: StakeholderType }) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Stakeholder name is required');
    }

    if (data.email) {
      const existing = await this.prisma.stakeholder.findUnique({
        where: { tenantId_email: { tenantId, email: data.email } },
      });
      if (existing) {
        throw new ConflictException(`A stakeholder with email ${data.email} already exists`);
      }
    }

    return this.prisma.stakeholder.create({
      data: { name: data.name.trim(), email: data.email || null, type: data.type, tenantId },
    });
  }

  async listStakeholders(tenantId: string) {
    return this.prisma.stakeholder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStakeholderById(tenantId: string, id: string) {
    const sh = await this.prisma.stakeholder.findUnique({ where: { id } });
    if (!sh || sh.tenantId !== tenantId) throw new NotFoundException('Stakeholder not found');
    return sh;
  }

  async getAdminStakeholderSummary(tenantId: string, stakeholderId: string) {
    const stakeholder = await this.prisma.stakeholder.findUnique({ where: { id: stakeholderId } });
    if (!stakeholder || stakeholder.tenantId !== tenantId) throw new NotFoundException('Stakeholder not found');

    // All ledger entries for this stakeholder
    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: { tenantId, stakeholderId },
      include: { security: true },
      orderBy: { timestamp: 'asc' },
    });

    // Compute net balance per security
    const securityMap = new Map<string, {
      security: { id: string; type: string; name: string | null };
      issued: number; vested: number; exercised: number; cancelled: number; transferred: number;
    }>();

    for (const tx of transactions) {
      const key = tx.securityId;
      if (!securityMap.has(key)) {
        securityMap.set(key, { security: { id: tx.security.id, type: tx.security.type, name: tx.security.name }, issued: 0, vested: 0, exercised: 0, cancelled: 0, transferred: 0 });
      }
      const entry = securityMap.get(key)!;
      const qty = Number(tx.quantity);
      if (tx.transactionType === 'ISSUANCE')    entry.issued    += qty;
      if (tx.transactionType === 'VEST')        entry.vested    += qty;
      if (tx.transactionType === 'EXERCISE')    entry.exercised += qty;
      if (tx.transactionType === 'CANCELLATION') entry.cancelled += qty;
      if (tx.transactionType === 'TRANSFER')    entry.transferred += qty;
    }

    const balances = Array.from(securityMap.values()).map((e) => ({
      ...e,
      net: e.issued + e.vested - e.exercised - e.cancelled - e.transferred,
    }));

    // Grants with vesting schedules
    const grants = await this.prisma.grant.findMany({
      where: { tenantId, stakeholderId },
      include: { security: true, vestingSchedule: true },
      orderBy: { grantDate: 'asc' },
    });

    // Vest events for the chart (ISSUANCE + VEST on option securities)
    const optionSecurityIds = grants
      .filter((g) => g.security.type === 'OPTION')
      .map((g) => g.securityId);

    const vestingEvents = optionSecurityIds.length
      ? transactions
          .filter((tx) => optionSecurityIds.includes(tx.securityId) && (tx.transactionType === 'ISSUANCE' || tx.transactionType === 'VEST'))
          .map((tx) => ({ timestamp: tx.timestamp, quantity: Number(tx.quantity), transactionType: tx.transactionType }))
      : [];

    return { stakeholder, balances, grants, vestingEvents };
  }

  async getStakeholderSummary(tenantId: string, stakeholderId: string) {
    const stakeholder = await this.prisma.stakeholder.findUnique({ where: { id: stakeholderId } });
    if (!stakeholder || stakeholder.tenantId !== tenantId) throw new Error('Stakeholder not found');
    return { stakeholder, totalShares: '0', vested: '0', unvested: '0', exercisable: '0', grants: [] };
  }
}
