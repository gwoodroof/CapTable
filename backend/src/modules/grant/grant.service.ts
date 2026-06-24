import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrecisionMath, decimal } from '../../common/utils/math';

@Injectable()
export class GrantService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  async createGrant(
    tenantId: string,
    initiatedBy: string,
    data: {
      stakeholderId: string;
      securityId: string;
      vestingScheduleId: string;
      quantity: string;
      strikePrice?: string;
      grantDate: string;
      boardApprovalDate?: string;
    },
  ) {
    const qty = decimal(data.quantity);
    if (!PrecisionMath.validateSharePrecision(qty)) {
      throw new BadRequestException('quantity exceeds precision limit (max 12 decimal places)');
    }

    if (data.strikePrice) {
      const price = decimal(data.strikePrice);
      if (!PrecisionMath.validatePricePrecision(price)) {
        throw new BadRequestException('strikePrice exceeds precision limit (max 10 decimal places)');
      }
    }

    // Validate referenced entities belong to this tenant
    const [stakeholder, security, vestingSchedule] = await Promise.all([
      this.prisma.stakeholder.findUnique({ where: { id: data.stakeholderId } }),
      this.prisma.security.findUnique({ where: { id: data.securityId } }),
      this.prisma.vestingSchedule.findUnique({ where: { id: data.vestingScheduleId } }),
    ]);

    if (!stakeholder || stakeholder.tenantId !== tenantId) {
      throw new BadRequestException(`Stakeholder not found or does not belong to this tenant`);
    }
    if (!security || security.tenantId !== tenantId) {
      throw new BadRequestException(`Security not found or does not belong to this tenant`);
    }
    if (!vestingSchedule || vestingSchedule.tenantId !== tenantId) {
      throw new BadRequestException(`Vesting schedule not found or does not belong to this tenant`);
    }

    const grant = await this.prisma.grant.create({
      data: {
        stakeholderId: data.stakeholderId,
        securityId: data.securityId,
        vestingScheduleId: data.vestingScheduleId,
        quantity: qty,
        strikePrice: data.strikePrice ? decimal(data.strikePrice) : null,
        grantDate: new Date(data.grantDate),
        boardApprovalDate: data.boardApprovalDate ? new Date(data.boardApprovalDate) : null,
        tenantId,
      },
      include: { stakeholder: true, security: true, vestingSchedule: true },
    });

    const ledgerEntry = await this.ledgerService.recordTransaction({
      tenantId,
      transactionType: 'ISSUANCE',
      stakeholderId: data.stakeholderId,
      securityId: data.securityId,
      quantity: data.quantity,
      pricePerShare: data.strikePrice,
      initiatedBy,
    });

    return { grant, ledgerEntry };
  }

  async listGrants(tenantId: string) {
    return this.prisma.grant.findMany({
      where: { tenantId },
      include: { stakeholder: true, security: true, vestingSchedule: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
