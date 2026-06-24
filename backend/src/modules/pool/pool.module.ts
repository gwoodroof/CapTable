import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PoolService } from './pool.service';
import { PoolController } from './pool.controller';

@Module({
  imports: [PrismaModule],
  providers: [PoolService],
  controllers: [PoolController],
  exports: [PoolService],
})
export class PoolModule {}
