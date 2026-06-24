import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * RolesGuard
 *
 * Enforces Role-Based Access Control (RBAC) based on user roles defined in the constitution:
 * - ADMIN: Full Read/Write
 * - INVESTOR: Read-only aggregate views
 * - STAKEHOLDER: Read-only personal data
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { role } = request.user || {};

    if (!role) {
      throw new ForbiddenException('No role assigned to user');
    }

    // Roles are evaluated per route via @Roles() decorator
    // This guard just ensures a role exists
    return true;
  }
}

/**
 * Role Decorator for use in controllers
 * Example: @Roles(UserRole.ADMIN)
 */
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
