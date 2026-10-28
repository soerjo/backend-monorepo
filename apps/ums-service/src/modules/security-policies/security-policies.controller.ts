import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';
import { UpdateSecurityPolicyDto } from './dto/update-security-policies.dto';
import { SecurityPoliciesService } from './security-policies.service';

@ApiTags('Security Policies')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('security-policies')
export class SecurityPoliciesController {
  constructor(
    private readonly securityPoliciesService: SecurityPoliciesService,
  ) {}

  @Get('/')
  async getPolicies() {
    return this.securityPoliciesService.getPolicies();
  }

  @Patch('/')
  async updatePolicies(@Body() dto: UpdateSecurityPolicyDto) {
    return this.securityPoliciesService.updatePolicies(dto);
  }
}
