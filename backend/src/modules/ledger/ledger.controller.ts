import { Controller, Get, Post, Query, Body, Req, UseGuards, Param } from '@nestjs/common';
import { Request } from 'express';
import { LedgerService } from './ledger.service';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';

@Controller('ledger')
@UseGuards(RolesGuard)
export class LedgerController {
  constructor(private ledgerService: LedgerService) {}

  @Post(':tenantId/issuance')
  @Roles('ADMIN')
  async recordIssuance(
    @Param('tenantId') tenantId: string,
    @Req() req: Request,
    @Body() body: { stakeholderId: string; securityId: string; quantity: string; pricePerShare?: string },
  ) {
    return this.ledgerService.recordTransaction({
      tenantId,
      transactionType: 'ISSUANCE',
      stakeholderId: body.stakeholderId,
      securityId: body.securityId,
      quantity: body.quantity,
      pricePerShare: body.pricePerShare,
      initiatedBy: req.userId,
    });
  }

  @Get(':tenantId/report')
  async getHistoricalReport(@Param('tenantId') tenantId: string, @Query('asOf') asOfDate?: string) {
    const date = asOfDate ? new Date(asOfDate) : new Date();
    return this.ledgerService.getLedgerReportAsOf(tenantId, date);
  }

  @Get(':tenantId/validate')
  async validateChain(@Param('tenantId') tenantId: string) {
    return this.ledgerService.validateLedgerChain(tenantId);
  }

  @Get(':tenantId/holdings/:stakeholderId')
  @Roles('ADMIN')
  async getStakeholderHoldings(
    @Param('tenantId') tenantId: string,
    @Param('stakeholderId') stakeholderId: string,
  ) {
    return this.ledgerService.getStakeholderHoldings(tenantId, stakeholderId);
  }

  @Post(':tenantId/buyout/preview')
  @Roles('ADMIN')
  async buyoutPreview(
    @Param('tenantId') tenantId: string,
    @Body() body: { sellerId: string; buyerId: string; securityId: string; quantity: string; pricePerShare: string },
  ) {
    return this.ledgerService.buyoutPreview(tenantId, body);
  }

  @Post(':tenantId/buyout/commit')
  @Roles('ADMIN')
  async buyoutCommit(
    @Param('tenantId') tenantId: string,
    @Req() req: Request,
    @Body() body: { sellerId: string; buyerId: string; securityId: string; quantity: string; pricePerShare: string },
  ) {
    return this.ledgerService.buyoutCommit(tenantId, body, req.userId);
  }
}
