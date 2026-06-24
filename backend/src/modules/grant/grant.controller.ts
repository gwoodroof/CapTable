import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GrantService } from './grant.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';

@Controller('grants')
@UseGuards(RolesGuard)
export class GrantController {
  constructor(private grantService: GrantService) {}

  @Post()
  @Roles('ADMIN')
  async createGrant(
    @Req() req: Request,
    @Body() body: {
      stakeholderId: string;
      securityId: string;
      vestingScheduleId: string;
      quantity: string;
      strikePrice?: string;
      grantDate: string;
      boardApprovalDate?: string;
    },
  ) {
    return this.grantService.createGrant(req.tenantId!, req.userId!, body);
  }

  @Get()
  @Roles('ADMIN')
  async listGrants(@Req() req: Request) {
    return this.grantService.listGrants(req.tenantId!);
  }
}
