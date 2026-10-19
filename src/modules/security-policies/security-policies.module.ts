import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SecurityPoliciesController } from './security-policies.controller';
import { SecurityPoliciesRepository } from './security-policies.repository';
import { SecurityPoliciesService } from './security-policies.service';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityPoliciesController],
  providers: [SecurityPoliciesService, SecurityPoliciesRepository],
  exports: [SecurityPoliciesService, SecurityPoliciesRepository],
})
export class SecurityPoliciesModule {}
