import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../interfaces/auth-user.interface.js';

interface RequestWithUser {
  user: AuthUser;
}

/**
 * Authorizes from the roles carried in the verified access token, so no
 * database lookup happens per request (UMS is the source of truth, downstream
 * services trust the signed claims).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user?.roles?.length) {
      return false;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
