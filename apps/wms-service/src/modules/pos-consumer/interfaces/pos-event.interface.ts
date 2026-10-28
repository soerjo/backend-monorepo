export interface PosOrderItem {
  productId: string;
  sku: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string | Date;
}

export interface PosOrderCompletedPayload {
  eventId: string;
  sourceService?: string;
  eventType: 'ORDER_COMPLETED';
  warehouseId: string;
  items: PosOrderItem[];
}

export interface PosOrderRefundedItem {
  productId: string;
  sku: string;
  quantity: number;
  condition: 'SELLABLE' | 'DAMAGED';
  batchNumber?: string;
  expiryDate?: string | Date;
  binId?: string;
}

export interface PosOrderRefundedPayload {
  eventId: string;
  sourceService?: string;
  eventType: 'ORDER_REFUNDED';
  warehouseId: string;
  items: PosOrderRefundedItem[];
}

export type PosEventPayload =
  PosOrderCompletedPayload | PosOrderRefundedPayload;
