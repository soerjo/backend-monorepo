import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { UsersModule } from '../users/users.module.js';
import { parseDurationToSeconds } from '../../common/utils/token-expiry.util.js';
import { loadJwtRsaKeypair } from '../../common/utils/jwt-keypair.util.js';
import type { JwtModuleOptions } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const { privateKey } = loadJwtRsaKeypair({
          privateKey: configService.get<string>('UMS_JWT_PRIVATE_KEY'),
          privateKeyPath: configService.get<string>('UMS_JWT_PRIVATE_KEY_PATH'),
        });

        return {
          privateKey,
          signOptions: {
            algorithm: 'RS256',
            expiresIn: parseDurationToSeconds(
              configService.get<string>('JWT_ACCESS_EXPIRATION')!,
            ), // in second
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
