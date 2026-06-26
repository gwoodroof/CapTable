import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../../src/common/auth/auth.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$hashed_password'),
  compare: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      getPayload: () => ({ email: 'google@example.com' }),
    }),
  })),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue({ toString: () => 'mock-verification-token' }),
  };
});

const makeMockJwt = () => ({
  sign: vi.fn().mockReturnValue('signed.jwt.token'),
  verify: vi.fn(),
  decode: vi.fn(),
});

const makeMockPrisma = () => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  tenant: {
    create: vi.fn(),
  },
  companyMembership: {
    create: vi.fn(),
  },
  pendingRegistration: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
});

const makeMockEmail = () => ({
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
});

describe('AuthService', () => {
  let service: AuthService;
  let mockJwt: ReturnType<typeof makeMockJwt>;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockEmail: ReturnType<typeof makeMockEmail>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt = makeMockJwt();
    mockPrisma = makeMockPrisma();
    mockEmail = makeMockEmail();
    service = new AuthService(mockJwt as any, mockPrisma as any, mockEmail as any);
  });

  describe('generateToken', () => {
    it('returns the signed JWT', async () => {
      const token = await service.generateToken('user-1', 'tenant-1', 'a@b.com', 'ADMIN');
      expect(token).toBe('signed.jwt.token');
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        tenantId: 'tenant-1',
        email: 'a@b.com',
        role: 'ADMIN',
      });
    });
  });

  describe('verifyToken', () => {
    it('returns the decoded payload for a valid token', async () => {
      const payload = { sub: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', email: 'a@b.com' };
      mockJwt.verify.mockReturnValue(payload);
      const result = await service.verifyToken('valid.token');
      expect(result).toEqual(payload);
    });

    it('throws if jwtService.verify throws', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      await expect(service.verifyToken('bad.token')).rejects.toThrow('Invalid token: jwt expired');
    });
  });

  describe('extractTenantId', () => {
    it('returns the tenantId from a decoded token', () => {
      mockJwt.decode.mockReturnValue({ tenantId: 'tenant-abc' });
      expect(service.extractTenantId('any.token')).toBe('tenant-abc');
    });

    it('returns null when decode throws', () => {
      mockJwt.decode.mockImplementation(() => { throw new Error('bad token'); });
      expect(service.extractTenantId('bad.token')).toBeNull();
    });

    it('returns null when decoded payload has no tenantId', () => {
      mockJwt.decode.mockReturnValue(null);
      expect(service.extractTenantId('empty.token')).toBeNull();
    });
  });

  describe('register', () => {
    it('sends a verification email and stores pending registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pendingRegistration.upsert.mockResolvedValue({});

      await service.register('a@b.com', 'password123', 'Acme');

      expect(mockPrisma.pendingRegistration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'a@b.com' },
          create: expect.objectContaining({ email: 'a@b.com', companyName: 'Acme' }),
          update: expect.objectContaining({ companyName: 'Acme' }),
        }),
      );
      expect(mockEmail.sendEmailVerification).toHaveBeenCalledWith('a@b.com', 'mock-verification-token');
    });

    it('does NOT create a user or tenant immediately', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pendingRegistration.upsert.mockResolvedValue({});

      await service.register('a@b.com', 'password123', 'Acme');

      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'a@b.com' });
      await expect(service.register('a@b.com', 'pw', 'Acme')).rejects.toThrow(ConflictException);
      expect(mockEmail.sendEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);

    it('creates tenant and user, deletes pending record, returns token', async () => {
      mockPrisma.pendingRegistration.findUnique.mockResolvedValue({
        email: 'a@b.com',
        passwordHash: '$2b$12$hash',
        companyName: 'Acme',
        token: 'valid-token',
        expiresAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-1', name: 'Acme' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', role: 'ADMIN', tenantId: 'tenant-1',
      });

      const token = await service.verifyEmail('valid-token');
      expect(token).toBe('signed.jwt.token');
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Acme', authorizedShares: '10000000' }) }),
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'a@b.com', role: 'ADMIN' }) }),
      );
      expect(mockPrisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { token: 'valid-token' } });
    });

    it('throws BadRequestException for an unknown token', async () => {
      mockPrisma.pendingRegistration.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException and cleans up when token is expired', async () => {
      mockPrisma.pendingRegistration.findUnique.mockResolvedValue({
        email: 'a@b.com',
        token: 'old-token',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyEmail('old-token')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { token: 'old-token' } });
    });

    it('throws ConflictException if email was registered via another path while token was pending', async () => {
      mockPrisma.pendingRegistration.findUnique.mockResolvedValue({
        email: 'a@b.com',
        token: 'valid-token',
        expiresAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.verifyEmail('valid-token')).rejects.toThrow(ConflictException);
      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', passwordHash: '$2b$12$hash', role: 'ADMIN', tenantId: 'tenant-1',
      });

      const token = await service.login('a@b.com', 'correct-pw');
      expect(token).toBe('signed.jwt.token');
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nope@b.com', 'pw')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', passwordHash: '$2b$12$hash', role: 'ADMIN', tenantId: 'tenant-1',
      });
      await expect(service.login('a@b.com', 'wrong-pw')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleAuth', () => {
    it('returns a token for an existing Google user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'google@example.com', role: 'ADMIN', tenantId: 'tenant-1',
      });
      const result = await service.googleAuth('valid-google-credential');
      expect(result.isNew).toBe(false);
      expect(result.token).toBe('signed.jwt.token');
    });

    it('returns isNew=true with email for a new Google user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.googleAuth('valid-google-credential');
      expect(result.isNew).toBe(true);
      expect(result.email).toBe('google@example.com');
      expect(result.token).toBeUndefined();
    });
  });

  describe('googleRegister', () => {
    it('creates a new tenant and user for first-time Google sign-up (no email verification required)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-2', name: 'NewCo' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-2', email: 'google@example.com', role: 'ADMIN', tenantId: 'tenant-2',
      });

      const token = await service.googleRegister('valid-google-credential', 'NewCo');
      expect(token).toBe('signed.jwt.token');
      expect(mockPrisma.tenant.create).toHaveBeenCalledOnce();
      expect(mockPrisma.user.create).toHaveBeenCalledOnce();
    });

    it('returns existing user token when Google user already has an account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'google@example.com', role: 'ADMIN', tenantId: 'tenant-1',
      });
      const token = await service.googleRegister('valid-google-credential', 'AnyName');
      expect(token).toBe('signed.jwt.token');
      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });
});
