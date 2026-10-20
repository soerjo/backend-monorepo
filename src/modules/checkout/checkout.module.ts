import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
