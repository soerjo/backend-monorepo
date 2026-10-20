import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentChannel } from '@prisma/client';

export class CheckoutDto {
  @ApiPropertyOptional({ enum: PaymentChannel, default: PaymentChannel.SNAP_ALL })
  @IsEnum(PaymentChannel)
  @IsOptional()
  channel?: PaymentChannel;
}
