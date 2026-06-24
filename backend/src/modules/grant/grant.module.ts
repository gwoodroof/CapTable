import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { GrantService } from './grant.service';
import { GrantController } from './grant.controller';

@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [GrantService],
  controllers: [GrantController],
  exports: [GrantService],
})
export class GrantModule {}
