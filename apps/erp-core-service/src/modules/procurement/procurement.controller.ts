import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { CreatePoDto } from './dto/create-po.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';

@ApiTags('Procurement (P2P)')
@ApiBearerAuth()
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Post('vendors')
  @Permissions('erp.vendor.create')
  @ApiOperation({ summary: 'Create vendor master' })
  @ApiResponse({ status: 201, description: 'Vendor created successfully' })
  async createVendor(@Body() dto: CreateVendorDto) {
    return this.procurementService.createVendor(dto);
  }

  @Get('vendors')
  @Permissions('erp.vendor.view')
  @ApiOperation({ summary: 'List all vendors' })
  async listVendors() {
    return this.procurementService.listVendors();
  }

  @Post('orders')
  @Permissions('erp.po.create')
  @ApiOperation({ summary: 'Create draft Purchase Order' })
  @ApiResponse({ status: 201, description: 'Purchase order created' })
  async createPo(@Body() dto: CreatePoDto, @CurrentUser() user: AuthUser) {
    return this.procurementService.createPo(dto, user.id);
  }

  @Get('orders/:id')
  @Permissions('erp.po.view')
  @ApiOperation({ summary: 'Get Purchase Order detail by ID' })
  async getPo(@Param('id') id: string) {
    return this.procurementService.getPoDetail(id);
  }

  @Post('orders/:id/approve')
  @Permissions('erp.po.approve')
  @ApiOperation({ summary: 'Approve PO and dispatch ASN outbox event to WMS' })
  @ApiResponse({
    status: 200,
    description: 'PO approved and ASN queued in Outbox',
  })
  async approvePo(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const data = await this.procurementService.approvePo(id, user.id);
    return {
      status: 'success',
      message: 'Purchase order approved and ASN dispatched to WMS',
      data,
    };
  }
}
