import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';

@ApiTags('Checkout')
@ApiBearerAuth()
@Controller('v1/invoices/:id/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate Midtrans checkout payment session for an invoice' })
  async createCheckoutSession(
    @Param('id') invoiceId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.checkoutService.createCheckoutSession(invoiceId, dto);
  }
}
