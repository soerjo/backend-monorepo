# ERP Core Backend Service

> Centralized ERP Core backend service for enterprise procurement, sales aggregation, financial accounting (General Ledger), and warehouse/billing synchronization.

Part of the **Soerjo Platform Ecosystem** (UMS, POS, WMS, Billing, CMS, ERP Core).

---

## 🏛️ Architecture & Business Flow

Dokumentasi lengkap mengenai desain arsitektur, integrasi sistem, dan alur bisnis end-to-end tersedia di:  
👉 **[docs/BUSINESS_FLOW_AND_ARCHITECTURE.md](docs/BUSINESS_FLOW_AND_ARCHITECTURE.md)**

---

## 🚀 Key Features

1. **Single Sign-On (SSO) with UMS:**
   - Stateless JWT authentication (RS256) verifying public keys dynamically via UMS JWKS endpoint (`/.well-known/jwks.json`).
   - In-memory key caching with configurable TTL and offline static PEM fallback.
   - Decoupled authorization: Roles and permissions (`@Permissions()`) are evaluated purely from JWT claims without local database user lookups.

2. **Procure-to-Pay (P2P):**
   - Vendor master data management.
   - Multi-tiered Purchase Orders (PO) with automatic 11% PPN tax computation.
   - Atomic state transitions (`DRAFT` → `APPROVED`) generating Inbound ASN notifications dispatched via Transactional Outbox.

3. **Order-to-Cash (O2C) & POS Sales Aggregator:**
   - Webhook endpoint for cashier transaction ingestion (`POST /api/v1/sales/pos-sync`).
   - Idempotent deduplication based on `posTransactionId`.
   - Automatic product catalog stubbing to prevent transaction dropouts.
   - Outbox event propagation for general ledger posting and inventory depletion.

4. **Accounting & General Ledger:**
   - Multi-tier Chart of Accounts (COA) across standard account types (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`).
   - **Automated Double-entry Bookkeeping Engine:** Strictly enforces $\sum \text{Debit} = \sum \text{Credit}$. Asymmetric transactions are rejected immediately with HTTP `422 Unprocessable Entity`.
   - Append-only journal lines for audit compliance and deadlock prevention.

5. **WMS & Billing Integration:**
   - Inbound receipt callback (`POST /api/v1/integration/wms/goods-received`) reconciling PO quantities.
   - Automatic journal generation: Debit Inventory (11300) vs. Credit Accounts Payable (21100).
   - Outbox event dissemination to trigger Accounts Payable invoices in Billing Service.

---

## 🛠️ Tech Stack & Toolchain

- **Framework:** NestJS 11 (Express platform)
- **Runtime & Package Manager:** [Bun](https://bun.sh) (Strict lockfile `bun.lock`, no npm/yarn/pnpm)
- **Database & ORM:** PostgreSQL 16 + Prisma ORM 6
- **Module System:** TypeScript with `module: nodenext` (all internal imports require `.js` extensions)
- **Reliability:** Transactional Outbox Pattern + Idempotency Protection

---

## 📋 Commands

```bash
# Install dependencies
bun install

# Run database migrations
bunx prisma migrate deploy

# Generate Prisma Client
bunx prisma generate

# Typecheck
bunx tsc --noEmit

# Lint check
bun run lint

# Build production bundle
bun run build

# Run unit tests
bunx jest --config jest.config.js

# Start development server
bun run start:dev
```

---

## 🔒 Quality Gates (Mandatory before PR)

All pull requests must pass 100% of the following verification checks:

1. `bunx tsc --noEmit` (0 type errors)
2. `bun run lint` (0 lint / Prettier errors)
3. `bun run build` (Successful Nest build to `dist/`)
4. `bunx jest --config jest.config.js` (All unit tests passing)
