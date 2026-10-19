import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateSecurityPolicyDto } from './dto/update-security-policies.dto';
import { SecurityPolicy } from '@prisma/client';

const DEFAULT_POLICY_ID = 'default';

@Injectable()
export class SecurityPoliciesRepository {
  constructor(private prisma: PrismaService) {}

  async getPolicies(): Promise<SecurityPolicy> {
    let policies = await this.prisma.securityPolicy.findUnique({
      where: { id: DEFAULT_POLICY_ID },
    });

    if (!policies) {
      policies = await this.prisma.securityPolicy.create({
        data: { id: DEFAULT_POLICY_ID },
      });
    }
    return policies;
  }

  async updatePolicies(dto: UpdateSecurityPolicyDto): Promise<SecurityPolicy> {
    return this.prisma.securityPolicy.upsert({
      where: { id: DEFAULT_POLICY_ID },
      update: dto,
      create: {
        id: DEFAULT_POLICY_ID,
        ...dto,
      },
    });
  }
}
