import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SecurityType } from '@prisma/client';

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  async createSecurity(tenantId: string, data: { name: string; type: SecurityType }) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Security name is required');
    }

    return this.prisma.security.create({
      data: { name: data.name.trim(), type: data.type, tenantId },
    });
  }

  async listSecurities(tenantId: string) {
    return this.prisma.security.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
