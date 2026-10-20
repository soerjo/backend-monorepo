import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaymentChannel } from '@prisma/client';

export class CheckoutInvoiceDto {
  @ApiPropertyOptional({
    enum: PaymentChannel,
    default: PaymentChannel.SNAP_ALL,
    example: PaymentChannel.SNAP_ALL,
    description: 'Preferred Midtrans payment channel',
  })
  @IsEnum(PaymentChannel)
  @IsOptional()
  channel?: PaymentChannel;
}
