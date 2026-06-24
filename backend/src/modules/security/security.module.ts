import { Module, Injectable } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Injectable()
export class SecurityService {
  // Placeholder for Phase 5-9
}

@Module({
  imports: [PrismaModule],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
