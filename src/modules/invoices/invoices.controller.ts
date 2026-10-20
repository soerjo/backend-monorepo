import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { CheckoutInvoiceDto } from './dto/checkout-invoice.dto.js';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('v1/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new invoice for an organization' })
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.createInvoice(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details by ID with transactions' })
  async getInvoiceById(@Param('id') id: string) {
    return this.invoicesService.getInvoiceById(id);
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Midtrans Snap checkout for an invoice' })
  async checkoutInvoice(
    @Param('id') id: string,
    @Body() dto: CheckoutInvoiceDto,
  ) {
    return this.invoicesService.checkoutInvoice(id, dto);
  }

  @Post(':id/qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate dynamic QRIS code for invoice payment' })
  async generateQr(@Param('id') id: string) {
    return this.invoicesService.generateQr(id);
  }
}
