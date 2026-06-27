import { Controller, Get, Post, Body, Req, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { GrantService } from './grant.service';
import { VestingService } from './vesting.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';

@Controller('grants')
@UseGuards(RolesGuard)
export class GrantController {
  constructor(
    private grantService: GrantService,
    private vestingService: VestingService,
  ) {}

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

  @Post('run-vesting')
  @Roles('ADMIN')
  @HttpCode(200)
  async runVesting(@Req() req: Request) {
    const created = await this.vestingService.materializeVestings(req.tenantId!);
    return { created };
  }

  @Post('offboard/preview')
  @Roles('ADMIN')
  @HttpCode(200)
  async offboardPreview(
    @Req() req: Request,
    @Body() body: {
      stakeholderId: string;
      terminationDate: string;
      terminationType: string;
      ptepDays: number;
      applyAcceleration: boolean;
      accelerationMethod: 'shares' | 'months';
      accelerationValue: number;
    },
  ) {
    if (!body.stakeholderId) throw new BadRequestException('stakeholderId is required');
    if (!body.terminationDate) throw new BadRequestException('terminationDate is required');
    return this.vestingService.previewOffboarding(req.tenantId!, {
      stakeholderId: body.stakeholderId,
      terminationDate: new Date(body.terminationDate),
      terminationType: body.terminationType || 'VOLUNTARY',
      ptepDays: body.ptepDays ?? 90,
      applyAcceleration: body.applyAcceleration ?? false,
      accelerationMethod: body.accelerationMethod ?? 'shares',
      accelerationValue: body.accelerationValue ?? 0,
    });
  }

  @Post('offboard/commit')
  @Roles('ADMIN')
  @HttpCode(200)
  async offboardCommit(
    @Req() req: Request,
    @Body() body: {
      stakeholderId: string;
      terminationDate: string;
      terminationType: string;
      ptepDays: number;
      applyAcceleration: boolean;
      accelerationMethod: 'shares' | 'months';
      accelerationValue: number;
    },
  ) {
    if (!body.stakeholderId) throw new BadRequestException('stakeholderId is required');
    if (!body.terminationDate) throw new BadRequestException('terminationDate is required');
    return this.vestingService.commitOffboarding(req.tenantId!, req.userId!, {
      stakeholderId: body.stakeholderId,
      terminationDate: new Date(body.terminationDate),
      terminationType: body.terminationType || 'VOLUNTARY',
      ptepDays: body.ptepDays ?? 90,
      applyAcceleration: body.applyAcceleration ?? false,
      accelerationMethod: body.accelerationMethod ?? 'shares',
      accelerationValue: body.accelerationValue ?? 0,
    });
  }
}
