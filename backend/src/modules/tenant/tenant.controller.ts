import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantService } from './tenant.service';
import { AuthService } from '../../common/auth/auth.service';
import { StakeholderService } from '../stakeholder/stakeholder.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.guard';

@Controller('tenants')
@UseGuards(RolesGuard)
export class TenantController {
  constructor(
    private tenantService: TenantService,
    private authService: AuthService,
    private stakeholderService: StakeholderService,
  ) {}

  /**
   * POST /api/v1/tenants
   *
   * Create a new company for the authenticated user. Issues a fresh JWT
   * scoped to the new tenant so the caller can immediately access it.
   * Any authenticated user may create a company.
   */
  @Get()
  async listTenants(@Req() req: Request) {
    return this.tenantService.listUserCompanies(req.userId!);
  }

  @Post()
  async createTenant(
    @Body() body: { name: string; authorizedShares: string; parValue: string },
    @Req() req: Request,
  ) {
    const tenant = await this.tenantService.initTenant(body.name, body.authorizedShares, body.parValue);
    await this.tenantService.createMembership(req.userId!, tenant.id);
    const token = await this.authService.generateToken(req.userId!, tenant.id, req.user.email, 'ADMIN');
    return { tenant, token };
  }

  /**
   * POST /api/v1/tenants/init
   *
   * Initialize a new tenant (company). Legacy endpoint — kept for compatibility.
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
   * Get tenant metadata.
   */
  @Get(':tenantId')
  async getTenant(@Param('tenantId') tenantId: string) {
    return this.tenantService.getTenant(tenantId);
  }

  /**
   * GET /api/v1/tenants/:tenantId/stakeholders
   *
   * Returns all Stakeholder records for the company, each annotated with
   * their CompanyMembership role if they have a platform account.
   */
  @Get(':tenantId/stakeholders')
  async getTenantStakeholders(@Param('tenantId') tenantId: string) {
    return this.tenantService.getTenantStakeholders(tenantId);
  }

  /**
   * GET /api/v1/tenants/:tenantId/my-equity
   *
   * Returns the calling user's own equity summary (holdings, grants, vesting)
   * for the specified company, looked up by the email in their JWT.
   * Returns { stakeholder: null, balances: [], grants: [], vestingEvents: [] }
   * when the user has no Stakeholder equity record.
   * Accessible to all authenticated company members (not admin-only).
   */
  @Get(':tenantId/my-equity')
  async getMyEquity(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.stakeholderService.getMyEquity(tenantId, req.user.email);
  }

  /**
   * PATCH /api/v1/tenants/:tenantId
   *
   * Update company name, website, or icon. ADMIN only.
   */
  @Patch(':tenantId')
  @Roles('ADMIN')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: { name?: string; website?: string; iconUrl?: string },
  ) {
    return this.tenantService.updateTenant(tenantId, body);
  }

  /**
   * PATCH /api/v1/tenants/:tenantId/memberships/:userId/role
   *
   * Change a user's role within this company. ADMIN only.
   */
  @Patch(':tenantId/memberships/:userId/role')
  @Roles('ADMIN')
  async updateMembershipRole(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'ADMIN' | 'STAKEHOLDER' },
  ) {
    return this.tenantService.updateMembershipRole(tenantId, userId, body.role);
  }
}
