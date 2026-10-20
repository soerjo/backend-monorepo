import { Module } from '@nestjs/common';
import { MidtransService } from './midtrans.service.js';

@Module({
  providers: [MidtransService],
  exports: [MidtransService],
})
export class PaymentsModule {}
