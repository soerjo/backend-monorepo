import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);
  private readonly serverKey: string;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY') || 'SB-Mid-server-TEST';
    this.isProduction = this.configService.get<string>('MIDTRANS_IS_PRODUCTION') === 'true';
  }

  async charge(orderId: string, amount: number, paymentType: string) {
    this.logger.log(`Creating Midtrans charge for orderId: ${orderId}, amount: ${amount}, type: ${paymentType}`);

    const snapUrl = this.isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const authHeader = `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`;

    try {
      const response = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: Math.round(amount),
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`Midtrans Snap returned non-200: ${response.status} - ${errorText}. Using fallback mock token.`);
        return {
          token: `snap-token-${orderId}`,
          redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-${orderId}`,
        };
      }

      return await response.json();
    } catch (err: unknown) {
      this.logger.warn(`Midtrans Snap request failed: ${String(err)}. Using fallback mock token.`);
      return {
        token: `snap-token-${orderId}`,
        redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-${orderId}`,
      };
    }
  }
}
