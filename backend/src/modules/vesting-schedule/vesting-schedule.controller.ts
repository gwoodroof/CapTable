import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { VestingScheduleService } from './vesting-schedule.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { VestingFrequency } from '@prisma/client';

@Controller('vesting-schedules')
@UseGuards(RolesGuard)
export class VestingScheduleController {
  constructor(private vestingScheduleService: VestingScheduleService) {}

  @Post()
  @Roles('ADMIN')
  async createVestingSchedule(
    @Req() req: Request,
    @Body() body: {
      name: string;
      cliffMonths: number;
      vestingDurationMonths: number;
      vestingFrequency: VestingFrequency;
    },
  ) {
    return this.vestingScheduleService.createVestingSchedule(req.tenantId!, body);
  }

  @Get()
  @Roles('ADMIN')
  async listVestingSchedules(@Req() req: Request) {
    return this.vestingScheduleService.listVestingSchedules(req.tenantId!);
  }
}
