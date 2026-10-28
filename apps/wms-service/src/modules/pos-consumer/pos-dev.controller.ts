import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PosConsumerService } from './pos-consumer.service.js';
import { PosEventDto } from './dto/pos-event.dto.js';
import { PosEventPayload } from './interfaces/pos-event.interface.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('POS Dev & Events')
@Controller('v1/dev/pos-event')
export class PosDevController {
  constructor(private readonly posConsumerService: PosConsumerService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Simulate POS event (Order Completed / Refunded)' })
  async receiveEvent(@Body() dto: PosEventDto) {
    if (process.env.WMS_DEV_EVENT_ENDPOINT !== '1') {
      throw new ForbiddenException(
        'Dev POS event endpoint is disabled (WMS_DEV_EVENT_ENDPOINT is not 1)',
      );
    }
    return this.posConsumerService.handleEvent(
      dto as unknown as PosEventPayload,
    );
  }
}
