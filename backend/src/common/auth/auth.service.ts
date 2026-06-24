import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  role: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /**
   * Generate JWT token with tenant_id binding
   */
  async generateToken(userId: string, tenantId: string, email: string, role: string): Promise<string> {
    const payload: JWTPayload = {
      sub: userId,
      tenantId,
      email,
      role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new Error(`Invalid token: ${(error as Error).message}`);
    }
  }

  /**
   * Extract tenant ID from JWT
   */
  extractTenantId(token: string): string | null {
    try {
      const decoded = this.jwtService.decode(token) as JWTPayload;
      return decoded?.tenantId || null;
    } catch {
      return null;
    }
  }
}
