import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { StakeholderModule } from './modules/stakeholder/stakeholder.module';
import { SecurityModule } from './modules/security/security.module';
import { AuthModule } from './common/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    TenantModule,
    LedgerModule,
    StakeholderModule,
    SecurityModule,
  ],
})
export class AppModule {}
