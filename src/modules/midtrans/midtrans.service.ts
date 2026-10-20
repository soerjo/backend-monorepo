import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import axios from 'axios';

export interface SnapTransactionParams {
  orderId: string;
  grossAmount: number;
  customerDetails?: {
    first_name?: string;
    email?: string;
    phone?: string;
  };
  itemDetails?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
}

export interface SnapTransactionResponse {
  token: string;
  redirect_url: string;
}

@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);
  private readonly serverKey: string;
  private readonly isProduction: boolean;
  private readonly snapBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY', '');
    this.isProduction = this.configService.get<boolean>(
      'MIDTRANS_IS_PRODUCTION',
      false,
    );
    this.snapBaseUrl = this.isProduction
      ? 'https://app.midtrans.com/snap/v1'
      : 'https://app.sandbox.midtrans.com/snap/v1';
  }

  async createSnapTransaction(
    params: SnapTransactionParams,
  ): Promise<SnapTransactionResponse> {
    if (!this.serverKey) {
      this.logger.warn(
        'MIDTRANS_SERVER_KEY is not set. Generating mock Snap token for local testing.',
      );
      return {
        token: `mock-snap-token-${params.orderId}`,
        redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-${params.orderId}`,
      };
    }

    const authHeader = Buffer.from(`${this.serverKey}:`).toString('base64');

    const payload = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: Math.round(params.grossAmount),
      },
      customer_details: params.customerDetails,
      item_details: params.itemDetails,
    };

    try {
      const response = await axios.post<SnapTransactionResponse>(
        `${this.snapBaseUrl}/transactions`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Basic ${authHeader}`,
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: unknown } })?.response?.data ||
        (err as Error).message;
      this.logger.error(
        `Failed to create Snap transaction for order ${params.orderId}: ${JSON.stringify(errorMsg)}`,
      );
      throw new Error(`Midtrans Snap error: ${JSON.stringify(errorMsg)}`);
    }
  }

  verifySignatureKey(params: {
    orderId: string;
    statusCode: string;
    grossAmount: string;
    signatureKey: string;
  }): boolean {
    if (!this.serverKey) {
      this.logger.warn(
        'MIDTRANS_SERVER_KEY empty. Bypassing signature verification in dev/test.',
      );
      return true;
    }

    const raw = `${params.orderId}${params.statusCode}${params.grossAmount}${this.serverKey}`;
    const expected = createHash('sha512').update(raw).digest('hex');

    return expected.toLowerCase() === params.signatureKey.toLowerCase();
  }
}
