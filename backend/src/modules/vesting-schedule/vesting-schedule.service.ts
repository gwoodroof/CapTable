import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VestingFrequency } from '@prisma/client';

@Injectable()
export class VestingScheduleService {
  constructor(private prisma: PrismaService) {}

  async createVestingSchedule(
    tenantId: string,
    data: {
      name: string;
      cliffMonths: number;
      vestingDurationMonths: number;
      vestingFrequency: VestingFrequency;
    },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Vesting schedule name is required');
    }
    if (data.cliffMonths < 0) {
      throw new BadRequestException('cliffMonths must be non-negative');
    }
    if (data.vestingDurationMonths <= 0) {
      throw new BadRequestException('vestingDurationMonths must be positive');
    }
    if (data.cliffMonths > data.vestingDurationMonths) {
      throw new BadRequestException('cliffMonths cannot exceed vestingDurationMonths');
    }

    return this.prisma.vestingSchedule.create({
      data: {
        name: data.name.trim(),
        cliffMonths: data.cliffMonths,
        vestingDurationMonths: data.vestingDurationMonths,
        vestingFrequency: data.vestingFrequency,
        tenantId,
      },
    });
  }

  async listVestingSchedules(tenantId: string) {
    return this.prisma.vestingSchedule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
