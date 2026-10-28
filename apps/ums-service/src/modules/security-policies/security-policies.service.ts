import { Injectable } from '@nestjs/common';
import { SecurityPoliciesRepository } from './security-policies.repository';
import { UpdateSecurityPolicyDto } from './dto/update-security-policies.dto';
import { SecurityPolicy } from '@prisma/client';

@Injectable()
export class SecurityPoliciesService {
  constructor(private readonly repository: SecurityPoliciesRepository) {}

  async getPolicies(): Promise<SecurityPolicy> {
    return this.repository.getPolicies();
  }

  async updatePolicies(dto: UpdateSecurityPolicyDto): Promise<SecurityPolicy> {
    return this.repository.updatePolicies(dto);
  }
}
