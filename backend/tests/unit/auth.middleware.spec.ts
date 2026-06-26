import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthMiddleware } from '../../src/common/middleware/auth.middleware';

const makeReq = (authHeader?: string) =>
  ({ headers: { authorization: authHeader }, tenantId: undefined, userId: undefined, role: undefined, user: undefined }) as any;

const makeRes = () => ({} as any);
const makeNext = () => vi.fn();

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let mockAuthService: { verifyToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = { verifyToken: vi.fn() };
    middleware = new AuthMiddleware(mockAuthService as any);
  });

  it('calls next() without modifying request when no Authorization header is present', async () => {
    const req = makeReq();
    const next = makeNext();
    await middleware.use(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.tenantId).toBeUndefined();
    expect(req.userId).toBeUndefined();
  });

  it('strips the Bearer prefix and binds JWT payload to request', async () => {
    const payload = { sub: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', email: 'a@b.com' };
    mockAuthService.verifyToken.mockResolvedValue(payload);

    const req = makeReq('Bearer some.valid.token');
    const next = makeNext();
    await middleware.use(req, makeRes(), next);

    expect(mockAuthService.verifyToken).toHaveBeenCalledWith('some.valid.token');
    expect(req.tenantId).toBe('tenant-1');
    expect(req.userId).toBe('user-1');
    expect(req.role).toBe('ADMIN');
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledOnce();
  });

  it('handles token without Bearer prefix', async () => {
    const payload = { sub: 'user-2', tenantId: 'tenant-2', role: 'INVESTOR', email: 'b@b.com' };
    mockAuthService.verifyToken.mockResolvedValue(payload);

    const req = makeReq('some.raw.token');
    await middleware.use(req, makeRes(), makeNext());
    expect(mockAuthService.verifyToken).toHaveBeenCalledWith('some.raw.token');
  });

  it('throws UnauthorizedException for an invalid or expired token', async () => {
    mockAuthService.verifyToken.mockRejectedValue(new Error('jwt expired'));
    const req = makeReq('Bearer expired.token');
    await expect(middleware.use(req, makeRes(), makeNext())).rejects.toThrow(UnauthorizedException);
  });
});
