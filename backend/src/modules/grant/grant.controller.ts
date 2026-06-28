import { Controller, Get, Post, Body, Req, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { GrantService } from './grant.service';
import { VestingService, ExerciseCommitInput } from './vesting.service';
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

  @Post('exercise/counts')
  @Roles('ADMIN')
  @HttpCode(200)
  async exerciseCounts(
    @Req() req: Request,
    @Body() body: { grantId: string; asOfDate: string },
  ) {
    if (!body.grantId) throw new BadRequestException('grantId is required');
    if (!body.asOfDate) throw new BadRequestException('asOfDate is required');
    return this.vestingService.exerciseCounts(req.tenantId!, body.grantId, new Date(body.asOfDate));
  }

  @Post('exercise/commit')
  @Roles('ADMIN')
  @HttpCode(200)
  async exerciseCommit(
    @Req() req: Request,
    @Body() body: { grantId: string; asOfDate: string; quantity: string; issuanceSecurityId: string },
  ) {
    if (!body.grantId) throw new BadRequestException('grantId is required');
    if (!body.asOfDate) throw new BadRequestException('asOfDate is required');
    if (!body.quantity) throw new BadRequestException('quantity is required');
    if (!body.issuanceSecurityId) throw new BadRequestException('issuanceSecurityId is required');
    const input: ExerciseCommitInput = {
      grantId: body.grantId,
      asOfDate: new Date(body.asOfDate),
      quantity: body.quantity,
      issuanceSecurityId: body.issuanceSecurityId,
    };
    return this.vestingService.exerciseCommit(req.tenantId!, req.userId!, input);
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
