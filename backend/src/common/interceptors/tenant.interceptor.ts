import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * TenantInterceptor
 *
 * Enforces tenant scoping on every request.
 * Validates that the tenant ID in the JWT matches the route parameter (if present).
 * This prevents horizontal privilege escalation attempts.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { tenantId: tokenTenantId } = request;
    const { tenantId: paramTenantId } = request.params;

    // If route specifies a tenantId param, authentication is required
    if (paramTenantId && !tokenTenantId) {
      throw new UnauthorizedException('Authentication required');
    }

    // Verify the JWT tenant matches the route param
    if (paramTenantId && tokenTenantId && paramTenantId !== tokenTenantId) {
      throw new ForbiddenException('Tenant ID mismatch: Cannot access other tenants data');
    }

    return next.handle();
  }
}
