import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../src/common/guards/roles.guard';

const makeContext = (role: string | undefined, requiredRoles: string[] | undefined) => {
  const mockReflector = {
    getAllAndOverride: vi.fn().mockReturnValue(requiredRoles),
  };
  const mockContext = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: role !== undefined ? { role } : undefined }),
    }),
  };
  return { mockReflector, mockContext };
};

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const { mockReflector, mockContext } = makeContext('INVESTOR', []);
    const guard = new RolesGuard(mockReflector as any);
    expect(guard.canActivate(mockContext as any)).toBe(true);
  });

  it('allows access when requiredRoles is undefined', () => {
    const { mockReflector, mockContext } = makeContext('INVESTOR', undefined);
    const guard = new RolesGuard(mockReflector as any);
    expect(guard.canActivate(mockContext as any)).toBe(true);
  });

  it('allows access when the user role matches required roles', () => {
    const { mockReflector, mockContext } = makeContext('ADMIN', ['ADMIN']);
    const guard = new RolesGuard(mockReflector as any);
    expect(guard.canActivate(mockContext as any)).toBe(true);
  });

  it('allows access when user role is in a list of accepted roles', () => {
    const { mockReflector, mockContext } = makeContext('INVESTOR', ['ADMIN', 'INVESTOR']);
    const guard = new RolesGuard(mockReflector as any);
    expect(guard.canActivate(mockContext as any)).toBe(true);
  });

  it('throws ForbiddenException when user role is not in required roles', () => {
    const { mockReflector, mockContext } = makeContext('INVESTOR', ['ADMIN']);
    const guard = new RolesGuard(mockReflector as any);
    expect(() => guard.canActivate(mockContext as any)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is not authenticated', () => {
    const { mockReflector, mockContext } = makeContext(undefined, ['ADMIN']);
    const guard = new RolesGuard(mockReflector as any);
    expect(() => guard.canActivate(mockContext as any)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException with a descriptive message for role mismatch', () => {
    const { mockReflector, mockContext } = makeContext('STAKEHOLDER', ['ADMIN']);
    const guard = new RolesGuard(mockReflector as any);
    expect(() => guard.canActivate(mockContext as any)).toThrow("Role 'STAKEHOLDER' is not authorized for this resource");
  });
});
