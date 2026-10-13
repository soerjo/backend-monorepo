import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../users/users.repository.js';
import * as bcrypt from 'bcryptjs';
// import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import type { RegisterDto } from './dto/register.dto.js';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // const { password, ...result } = user;
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
      };
    }

    return null;
  }

  async validateUserById(id: string): Promise<AuthUser | null> {
    const user = await this.usersRepository.findById(id);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.usersRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `Organization of ${dto.email}`,
          slug: `org-${dto.email}`,
        },
      });

      return tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName ?? '',
          lastName: dto.lastName ?? '',
          organizationId: organization.id,
          role: $Enums.RoleName.ADMIN,
        },
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  login(payload: AuthUser) {
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn:
          Number(
            this.configService
              .get<string>('JWT_REFRESH_EXPIRATION')!
              .replace(/\D/g, '') as unknown as number,
          ) *
          60 *
          60 *
          24,
      }),
      user: payload,
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: AuthUser;
    try {
      payload = this.jwtService.verify<AuthUser>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersRepository.findById(payload.id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    };

    return this.login(authUser);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findByEmail(
      (await this.usersRepository.findById(userId)).email,
    );
    if (!user || !user.password) {
      throw new BadRequestException('No password set for this account.');
    }
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePassword(userId, hashedPassword);
  }
}
