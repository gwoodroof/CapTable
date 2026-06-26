import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './health.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { StakeholderModule } from './modules/stakeholder/stakeholder.module';
import { SecurityModule } from './modules/security/security.module';
import { PoolModule } from './modules/pool/pool.module';
import { VestingScheduleModule } from './modules/vesting-schedule/vesting-schedule.module';
import { GrantModule } from './modules/grant/grant.module';
import { AuthModule } from './common/auth/auth.module';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: TenantInterceptor }],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    PrismaModule,
    AuthModule,
    TenantModule,
    LedgerModule,
    StakeholderModule,
    SecurityModule,
    PoolModule,
    VestingScheduleModule,
    GrantModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
