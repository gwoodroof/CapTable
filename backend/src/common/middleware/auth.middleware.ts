import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/auth.service';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
      role?: string;
      user?: any;
    }
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // Public routes can be exempted here if needed
      return next();
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
      const payload = await this.authService.verifyToken(token);

      // Bind tenant and user to request context
      req.tenantId = payload.tenantId;
      req.userId = payload.sub;
      req.role = payload.role;
      req.user = payload;

      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
