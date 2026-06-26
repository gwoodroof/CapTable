import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

export interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  role: string;
  email: string;
  name: string;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async generateToken(userId: string, tenantId: string, email: string, role: string, name = ''): Promise<string> {
    const payload: JWTPayload = { sub: userId, tenantId, email, role, name };
    return this.jwtService.sign(payload);
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new Error(`Invalid token: ${(error as Error).message}`);
    }
  }

  extractTenantId(token: string): string | null {
    try {
      const decoded = this.jwtService.decode(token) as JWTPayload;
      return decoded?.tenantId || null;
    } catch {
      return null;
    }
  }

  async register(email: string, password: string, name: string, companyName: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    // Upsert so a repeated signup attempt before verification refreshes the token
    await this.prisma.pendingRegistration.upsert({
      where: { email },
      update: { passwordHash, name, companyName, token, expiresAt },
      create: { email, passwordHash, name, companyName, token, expiresAt },
    });

    await this.emailService.sendEmailVerification(email, token);
  }

  async verifyEmail(token: string): Promise<string> {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { token } });

    if (!pending) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({ where: { token } });
      throw new BadRequestException('Verification link has expired. Please sign up again.');
    }

    // Check the email wasn't registered via another path (e.g. Google SSO) while waiting
    const existingUser = await this.prisma.user.findUnique({ where: { email: pending.email } });
    if (existingUser) {
      await this.prisma.pendingRegistration.delete({ where: { token } });
      throw new ConflictException('Email already registered');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: pending.companyName,
        authorizedShares: '10000000',
        parValue: '0.0001',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: pending.email,
        passwordHash: pending.passwordHash,
        name: pending.name,
        role: 'ADMIN',
        tenantId: tenant.id,
      },
    });

    await this.prisma.companyMembership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });

    await this.prisma.pendingRegistration.delete({ where: { token } });

    return this.generateToken(user.id, tenant.id, pending.email, 'ADMIN', pending.name);
  }

  async login(email: string, password: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateToken(user.id, user.tenantId, email, user.role, user.name);
  }

  async googleAuth(credential: string): Promise<{ token?: string; isNew: boolean; email?: string }> {
    const { email, name } = await this.verifyGoogleCredential(credential);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = await this.generateToken(user.id, user.tenantId, email, user.role, user.name || name);
      return { token, isNew: false };
    }

    return { isNew: true, email };
  }

  async googleRegister(credential: string, companyName: string): Promise<string> {
    const { email, name } = await this.verifyGoogleCredential(credential);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return this.generateToken(existing.id, existing.tenantId, email, existing.role, existing.name || name);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: companyName,
        authorizedShares: '10000000',
        parValue: '0.0001',
      },
    });

    // Google users have no password; store an opaque hash so the column is never empty
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);

    const user = await this.prisma.user.create({
      data: { email, passwordHash, name, role: 'ADMIN', tenantId: tenant.id },
    });

    await this.prisma.companyMembership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });

    return this.generateToken(user.id, tenant.id, email, 'ADMIN', name);
  }

  async switchCompany(userId: string, email: string, name: string, targetTenantId: string): Promise<string> {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId: targetTenantId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this company');
    }
    return this.generateToken(userId, targetTenantId, email, membership.role, name);
  }

  private async verifyGoogleCredential(credential: string): Promise<{ email: string; name: string }> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new UnauthorizedException('Invalid Google token');
    return { email: payload.email, name: payload.name ?? '' };
  }
}
