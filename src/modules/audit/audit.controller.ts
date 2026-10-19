import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary:
      'List audit logs (paginated, filter by action/severity/actorId) — ums:admin',
  })
  async findAll(@Query() query: ListAuditLogsDto) {
    return this.auditService.findLogs(query);
  }

  @Post('purge')
  @ApiOperation({
    summary:
      'Manually purge audit logs older than the retention window (default 30 days) — ums:admin',
  })
  async purge() {
    const purged = await this.auditService.purge();
    return { purged };
  }
}
