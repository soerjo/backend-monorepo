import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IntegrationService } from './integration.service.js';
import { WmsGoodsReceivedDto } from './dto/wms-receipt.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Integration (WMS & Ecosystem)')
@Controller('integration')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post('wms/goods-received')
  @Public() // Webhook callback from WMS service
  @ApiOperation({
    summary: 'Callback webhook from WMS when PO goods are received',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory reconciled & journal entry posted',
  })
  async wmsGoodsReceived(@Body() dto: WmsGoodsReceivedDto) {
    return this.integrationService.handleWmsGoodsReceived(dto);
  }
}
