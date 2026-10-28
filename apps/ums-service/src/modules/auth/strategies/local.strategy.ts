import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service.js';
import { AuditService } from '../../audit/audit.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private auditService: AuditService,
  ) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      await this.auditService.log({
        action: 'auth.login.failed',
        severity: 'warn',
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
