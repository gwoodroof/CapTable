import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StakeholderService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get stakeholder summary (personal equity overview)
   */
  async getStakeholderSummary(tenantId: string, stakeholderId: string) {
    const stakeholder = await this.prisma.stakeholder.findUnique({
      where: { id: stakeholderId },
    });

    if (!stakeholder || stakeholder.tenantId !== tenantId) {
      throw new Error('Stakeholder not found');
    }

    // TODO: Aggregate grants and vesting info from ledger
    return {
      stakeholder,
      totalShares: '0',
      vested: '0',
      unvested: '0',
      exercisable: '0',
      grants: [],
    };
  }
}
