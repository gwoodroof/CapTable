import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrecisionMath, decimal } from '../../common/utils/math';

@Injectable()
export class PoolService {
  constructor(private prisma: PrismaService) {}

  async createPool(tenantId: string, data: { name: string; authorizedShares: string }) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Pool name is required');
    }

    const shares = decimal(data.authorizedShares);
    if (!PrecisionMath.validateSharePrecision(shares)) {
      throw new BadRequestException('authorizedShares exceeds precision limit (max 12 decimal places)');
    }

    return this.prisma.equityPool.create({
      data: { name: data.name.trim(), authorizedShares: shares, tenantId },
    });
  }

  async listPools(tenantId: string) {
    return this.prisma.equityPool.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
