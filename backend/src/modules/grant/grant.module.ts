import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { GrantService } from './grant.service';
import { GrantController } from './grant.controller';
import { VestingService } from './vesting.service';

@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [GrantService, VestingService],
  controllers: [GrantController],
  exports: [GrantService, VestingService],
})
export class GrantModule {}
