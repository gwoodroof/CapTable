import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('ledger')
@UseGuards(RolesGuard)
export class LedgerController {
  constructor(private ledgerService: LedgerService) {}

  /**
   * GET /api/v1/tenants/:tenantId/ledger/report
   *
   * Retrieve a historical cap table report as of a specific date.
   * Multi-tenant safe: tenantId extracted from JWT.
   */
  @Get(':tenantId/report')
  async getHistoricalReport(@Param('tenantId') tenantId: string, @Query('asOf') asOfDate?: string) {
    const date = asOfDate ? new Date(asOfDate) : new Date();
    return this.ledgerService.getLedgerReportAsOf(tenantId, date);
  }

  /**
   * GET /api/v1/tenants/:tenantId/ledger/validate
   *
   * Validate the chain integrity of the entire ledger.
   * For compliance/audit purposes.
   */
  @Get(':tenantId/validate')
  async validateChain(@Param('tenantId') tenantId: string) {
    return this.ledgerService.validateLedgerChain(tenantId);
  }
}
