import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { forwardRef } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module.js';

@Module({
  imports: [PrismaModule, forwardRef(() => SessionsModule)],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
