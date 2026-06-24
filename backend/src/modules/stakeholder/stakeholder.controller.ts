import { Controller, Get, Post, Body, Req, Param, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StakeholderService } from './stakeholder.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { StakeholderType } from '@prisma/client';

@Controller('stakeholders')
@UseGuards(RolesGuard)
export class StakeholderController {
  constructor(private stakeholderService: StakeholderService) {}

  @Post()
  @Roles('ADMIN')
  async createStakeholder(
    @Req() req: Request,
    @Body() body: { name: string; email?: string; type: StakeholderType },
  ) {
    return this.stakeholderService.createStakeholder(req.tenantId!, body);
  }

  @Get()
  @Roles('ADMIN')
  async listStakeholders(@Req() req: Request) {
    return this.stakeholderService.listStakeholders(req.tenantId!);
  }

  // Static routes before /:id to prevent shadowing
  @Get('me/summary')
  async getMyDashboard() {
    return { message: 'Dashboard - Coming in Phase 7' };
  }

  @Get(':id')
  @Roles('ADMIN')
  async getStakeholder(@Req() req: Request, @Param('id') id: string) {
    return this.stakeholderService.getStakeholderById(req.tenantId!, id);
  }

  @Get(':id/summary')
  @Roles('ADMIN')
  async getStakeholderSummary(@Req() req: Request, @Param('id') id: string) {
    return this.stakeholderService.getAdminStakeholderSummary(req.tenantId!, id);
  }
}
