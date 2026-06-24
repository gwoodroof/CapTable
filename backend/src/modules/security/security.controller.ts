import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SecurityService } from './security.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { SecurityType } from '@prisma/client';

@Controller('securities')
@UseGuards(RolesGuard)
export class SecurityController {
  constructor(private securityService: SecurityService) {}

  @Post()
  @Roles('ADMIN')
  async createSecurity(
    @Req() req: Request,
    @Body() body: { name: string; type: SecurityType },
  ) {
    return this.securityService.createSecurity(req.tenantId!, body);
  }

  @Get()
  @Roles('ADMIN')
  async listSecurities(@Req() req: Request) {
    return this.securityService.listSecurities(req.tenantId!);
  }
}
