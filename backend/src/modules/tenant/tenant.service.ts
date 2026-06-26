import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrecisionMath, decimal } from '../../common/utils/math';
import { LedgerService } from '../ledger/ledger.service';
import Decimal from 'decimal.js';

@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  /**
   * Initialize a new tenant with basic company metadata
   */
  async initTenant(
    name: string,
    authorizedShares: string | number | Decimal,
    parValue: string | number | Decimal,
  ) {
    const authorizedSharesDecimal = decimal(authorizedShares);
    const parValueDecimal = decimal(parValue);

    // Validate precision
    if (!PrecisionMath.validateSharePrecision(authorizedSharesDecimal)) {
      throw new BadRequestException('Authorized shares precision exceeds limit');
    }
    if (!PrecisionMath.validatePricePrecision(parValueDecimal)) {
      throw new BadRequestException('Par value precision exceeds limit');
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        authorizedShares: authorizedSharesDecimal,
        parValue: parValueDecimal,
      },
    });

    return tenant;
  }

  /**
   * Get tenant details
   */
  async getTenant(tenantId: string) {
    return this.prisma.tenant.findUnique({ where: { id: tenantId } });
  }

  async createMembership(userId: string, tenantId: string) {
    return this.prisma.companyMembership.create({
      data: { userId, tenantId, role: 'ADMIN' },
    });
  }

  async getTenantStakeholders(tenantId: string) {
    const [stakeholders, memberships] = await Promise.all([
      this.prisma.stakeholder.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.companyMembership.findMany({
        where: { tenantId },
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const membershipByEmail = new Map(memberships.map((m) => [m.user.email, m]));
    const stakeholderEmails = new Set(
      stakeholders.filter((s) => s.email).map((s) => s.email as string),
    );

    // Equity-holder rows annotated with their platform membership (if any)
    const stakeholderRows = stakeholders.map((s) => {
      const m = s.email ? (membershipByEmail.get(s.email) ?? null) : null;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        type: s.type as string | null,
        createdAt: s.createdAt,
        membership: m ? { userId: m.userId, role: m.role as string } : null,
        isStakeholder: true,
      };
    });

    // Platform-member-only rows: users with CompanyMembership but no Stakeholder record
    const memberOnlyRows = memberships
      .filter((m) => !stakeholderEmails.has(m.user.email))
      .map((m) => ({
        id: m.userId,
        name: m.user.email,
        email: m.user.email,
        type: null,
        createdAt: m.createdAt,
        membership: { userId: m.userId, role: m.role as string },
        isStakeholder: false,
      }));

    return [...stakeholderRows, ...memberOnlyRows];
  }

  async updateMembershipRole(tenantId: string, userId: string, role: 'ADMIN' | 'STAKEHOLDER') {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found for this user in this company');
    }
    return this.prisma.companyMembership.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { role },
    });
  }

  async listUserCompanies(userId: string) {
    const memberships = await this.prisma.companyMembership.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => m.tenant);
  }

  async updateTenant(tenantId: string, data: { name?: string; website?: string; iconUrl?: string }) {
    return this.prisma.tenant.update({ where: { id: tenantId }, data });
  }

  /**
   * Get total issued shares for a tenant (sum of all non-cancelled issuances)
   */
  async getTotalIssuedShares(tenantId: string): Promise<Decimal> {
    const entries = await this.prisma.ledgerTransaction.findMany({
      where: {
        tenantId,
        transactionType: { in: ['ISSUANCE', 'VEST'] },
      },
    });

    return PrecisionMath.sum(entries.map((e) => e.quantity));
  }
}
