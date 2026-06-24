import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PoolService } from './pool.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';

@Controller('pools')
@UseGuards(RolesGuard)
export class PoolController {
  constructor(private poolService: PoolService) {}

  @Post()
  @Roles('ADMIN')
  async createPool(
    @Req() req: Request,
    @Body() body: { name: string; authorizedShares: string },
  ) {
    return this.poolService.createPool(req.tenantId!, body);
  }

  @Get()
  @Roles('ADMIN')
  async listPools(@Req() req: Request) {
    return this.poolService.listPools(req.tenantId!);
  }
}
