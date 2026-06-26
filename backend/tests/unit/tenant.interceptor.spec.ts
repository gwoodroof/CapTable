import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TenantInterceptor } from '../../src/common/interceptors/tenant.interceptor';
import { firstValueFrom, of } from 'rxjs';

const makeContext = (tokenTenantId: string | undefined, paramTenantId: string | undefined) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      tenantId: tokenTenantId,
      params: { tenantId: paramTenantId },
    }),
  }),
});

const makeNext = () => ({ handle: () => of('ok') });

describe('TenantInterceptor', () => {
  const interceptor = new TenantInterceptor();

  it('passes through when there is no param tenantId', async () => {
    const ctx = makeContext('tenant-1', undefined);
    const val = await firstValueFrom(interceptor.intercept(ctx as any, makeNext() as any));
    expect(val).toBe('ok');
  });

  it('passes through when JWT tenant matches param tenant', async () => {
    const ctx = makeContext('tenant-1', 'tenant-1');
    const val = await firstValueFrom(interceptor.intercept(ctx as any, makeNext() as any));
    expect(val).toBe('ok');
  });

  it('throws ForbiddenException when JWT tenant does not match param tenant', () => {
    const ctx = makeContext('tenant-1', 'tenant-2');
    expect(() => interceptor.intercept(ctx as any, makeNext() as any)).toThrow(ForbiddenException);
  });

  it('passes through when no JWT tenant is bound (unauthenticated request)', async () => {
    const ctx = makeContext(undefined, 'tenant-1');
    const val = await firstValueFrom(interceptor.intercept(ctx as any, makeNext() as any));
    expect(val).toBe('ok');
  });
});
