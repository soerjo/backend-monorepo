import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { SessionsRepository } from './sessions.repository.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsRepository],
  exports: [SessionsService],
})
export class SessionsModule {}
