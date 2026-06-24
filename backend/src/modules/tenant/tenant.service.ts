import { Injectable, BadRequestException } from '@nestjs/common';
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
    // Validate name uniqueness
    const existing = await this.prisma.tenant.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Tenant with name "${name}" already exists`);
    }

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
