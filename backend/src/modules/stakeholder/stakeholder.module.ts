import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StakeholderService } from './stakeholder.service';
import { StakeholderController } from './stakeholder.controller';

@Module({
  imports: [PrismaModule],
  providers: [StakeholderService],
  controllers: [StakeholderController],
  exports: [StakeholderService],
})
export class StakeholderModule {}
