# WMS Service — Build Contract (derived from docs/PRD.md)

Stack: NestJS 11 + Prisma 6 + PostgreSQL (template `my-nestjs-template`). Port 3500, DB `wms_db`.
Keep template auth module & conventions (module/repo/service pattern, Swagger, JWT guard).

## Prisma models (add to schema.prisma, @@map ke snake_case)
- Warehouse: id, code(unique), name, type enum CENTRAL_DC|STORE_OUTLET|TRANSIT, address?, isActive, timestamps
- StorageBin: id, warehouseId FK, binCode, zoneName, aisle?, rack?, status enum ACTIVE|QUARANTINE|LOCKED, createdAt; @@unique([warehouseId, binCode])
- ProductStock: id, warehouseId, binId, productId, sku, batchNumber default '-', expiryDate?, quantityOnHand Decimal(15,3), quantityReserved Decimal(15,3), updatedAt; @@unique([binId, productId, batchNumber, expiryDate]) — treat nullable expiry via sentinel value strategy in code if needed
- StockLedger (append-only): id, transactionTime, warehouseId, binId, productId, sku, batchNumber, changeQuantity Decimal(15,3), balanceAfter Decimal(15,3), referenceType enum POS_SALE|POS_REFUND|INBOUND_PO|TRANSFER_OUT|TRANSFER_IN|STOCK_ADJUSTMENT, referenceId, notes?
- InboundShipment: id, shipmentNo(unique), warehouseId, supplierId?, referencePoNo?, status enum PENDING|PARTIAL|COMPLETED|CANCELLED, receivedAt?, createdAt + items InboundShipmentItem(productId, sku, batchNumber, expiryDate?, quantity, quantityReceived)
- StockTransfer: id, transferNo(unique), originWarehouseId, destinationWarehouseId, status enum DRAFT|IN_TRANSIT|COMPLETED|CANCELLED, dispatchedAt?, receivedAt? + items
- StockAdjustment: id, adjustmentNo(unique), warehouseId, reason enum SHRINKAGE|EXPIRED|SAMPLING|DAMAGE|OTHER, status enum PENDING|APPROVED|REJECTED, requestedValue Decimal(15,2)? (untuk approval threshold), approverId?, notes? + items
- ProcessedEvent: eventId @id, sourceService, eventType, processedAt (idempotency guard)

## Rules
- Ledger append-only: no update/delete in service code; Prisma migrate: postgres DB-level GRANT next step (skip for now, code-only).
- FEFO: order by expiryDate ASC nulls last; FIFO: by earliest inbound (createdAt/transactionTime ASC). Allocation via SELECT FOR UPDATE equivalent: interactive transaction + `SELECT ... FOR UPDATE` raw query on product_stocks rows.
- POS event consumer: implement as NestJS injectable service + stub transport interface (no real broker yet) — `PosEventConsumer` with `handleOrderCompleted(payload)` / `handleOrderRefunded(payload)`, dedupe via ProcessedEvent inside same transaction; oversell (stock 0) → log + DLQ stub table/interface + notif log, financial transaction NOT cancelled.
- Inter-warehouse transfer: DRAFT → IN_TRANSIT (stock out origin, ledger TRANSFER_OUT) → COMPLETED (stock in destination, ledger TRANSFER_IN). Bin transfer: internal move within warehouse.
- Adjustment requires reason code; approval flow: if value above threshold env WMS_APPROVAL_THRESHOLD (default 0 = auto-approve) require approved status before applying.

## REST API (all under /api/v1, JWT-guarded, Swagger-tagged)
- warehouses: GET/POST /v1/warehouses, GET/PATCH /v1/warehouses/:id
- bins: GET/POST /v1/warehouses/:id/bins, PATCH /v1/bins/:id (status)
- inbound: POST /v1/inbound/receipts, POST /v1/inbound/putaway
- inventory: GET /v1/inventory/on-hand (filters warehouseId, sku, batch), GET /v1/inventory/ledger, GET /v1/inventory/low-stock
- transfers: POST /v1/transfers, POST /v1/transfers/:id/dispatch, POST /v1/transfers/:id/receive
- adjustments: POST /v1/inventory/adjustments, POST /v1/inventory/adjustments/:id/approve
- POS consumer not exposed via HTTP (worker), but expose POST /v1/dev/pos-event (guarded by env WMS_DEV_EVENT_ENDPOINT=1) for smoke test.

## Gates
npm run lint (exit 0), npx tsc --noEmit, npm run test, npm run build — all pass. Unit tests untuk: FEFO/FIFO allocation, idempotent consumer dedupe, ledger balance math, oversell DLQ path.
