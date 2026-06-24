import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

export interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  role: string;
  email: string;
}

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async generateToken(userId: string, tenantId: string, email: string, role: string): Promise<string> {
    const payload: JWTPayload = { sub: userId, tenantId, email, role };
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

  async register(email: string, password: string, companyName: string): Promise<string> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: companyName,
        authorizedShares: '10000000',
        parValue: '0.0001',
      },
    });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: { email, passwordHash, role: 'ADMIN', tenantId: tenant.id },
    });

    return this.generateToken(user.id, tenant.id, email, 'ADMIN');
  }

  async login(email: string, password: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateToken(user.id, user.tenantId, email, user.role);
  }

  async googleAuth(credential: string): Promise<{ token?: string; isNew: boolean; email?: string }> {
    const email = await this.verifyGoogleCredential(credential);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = await this.generateToken(user.id, user.tenantId, email, user.role);
      return { token, isNew: false };
    }

    return { isNew: true, email };
  }

  async googleRegister(credential: string, companyName: string): Promise<string> {
    const email = await this.verifyGoogleCredential(credential);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return this.generateToken(existing.id, existing.tenantId, email, existing.role);
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
      data: { email, passwordHash, role: 'ADMIN', tenantId: tenant.id },
    });

    return this.generateToken(user.id, tenant.id, email, 'ADMIN');
  }

  private async verifyGoogleCredential(credential: string): Promise<string> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new UnauthorizedException('Invalid Google token');
    return payload.email;
  }
}
