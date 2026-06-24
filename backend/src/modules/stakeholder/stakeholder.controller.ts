import { Controller, Get, UseGuards } from '@nestjs/common';
import { StakeholderService } from './stakeholder.service';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('stakeholders')
@UseGuards(RolesGuard)
export class StakeholderController {
  constructor(private stakeholderService: StakeholderService) {}

  /**
   * GET /api/v1/stakeholders/me/summary
   *
   * Get current stakeholder's equity summary
   */
  @Get('me/summary')
  async getMyDashboard() {
    // Implemented in Phase 7
    return { message: 'Dashboard - Coming in Phase 7' };
  }
}
