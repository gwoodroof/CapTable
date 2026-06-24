import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { VestingScheduleService } from './vesting-schedule.service';
import { VestingScheduleController } from './vesting-schedule.controller';

@Module({
  imports: [PrismaModule],
  providers: [VestingScheduleService],
  controllers: [VestingScheduleController],
  exports: [VestingScheduleService],
})
export class VestingScheduleModule {}
