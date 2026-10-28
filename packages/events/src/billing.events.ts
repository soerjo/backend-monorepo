export const BILLING_TOPICS = {
  PAYMENT_COMPLETED: 'billing.payment.completed',
  PAYMENT_FAILED: 'billing.payment.failed',
} as const;

export interface BillingPaymentCompletedPayload {
  orderId: string;
  transactionId: string;
  grossAmount: number;
  paymentType: string;
  status: 'COMPLETED';
  settlementTime?: string;
  provider: string;
}

export interface BillingPaymentFailedPayload {
  orderId: string;
  transactionId?: string;
  status: 'FAILED';
  reason?: string;
  provider: string;
}

export type BillingEventPayload =
  | BillingPaymentCompletedPayload
  | BillingPaymentFailedPayload;
