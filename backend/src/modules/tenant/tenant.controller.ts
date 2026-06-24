import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.guard';

@Controller('tenants')
@UseGuards(RolesGuard)
export class TenantController {
  constructor(private tenantService: TenantService) {}

  /**
   * POST /api/v1/tenants/init
   *
   * Initialize a new tenant (company).
   * Requires ADMIN role.
   */
  @Post('init')
  @Roles('ADMIN')
  async initTenant(
    @Body() body: { name: string; authorized_shares: string; par_value: string },
  ) {
    return this.tenantService.initTenant(body.name, body.authorized_shares, body.par_value);
  }

  /**
   * GET /api/v1/tenants/:tenantId
   *
   * Get tenant metadata
   */
  @Get(':tenantId')
  async getTenant(@Param('tenantId') tenantId: string) {
    return this.tenantService.getTenant(tenantId);
  }
}
