# Backend Monorepo

Centralized monorepo for the microservices ecosystem, powered by **Bun Workspaces** and **Turborepo**.

---

## 📦 Services Overview

| Service | Port | Description | Database | Key Technologies |
| :--- | :--- | :--- | :--- | :--- |
| [`ums-service`](apps/ums-service) | `3001` | Central Identity Provider, JWT RS256, JWKS, RBAC, Sessions | `ums_db` | NestJS 11, Prisma 6, RS256, Winston, Prom |
| [`cms-service`](apps/cms-service) | `3002` | Headless CMS (Pages, Content Types, Versions, Media) | `cms_db` | NestJS 11, Prisma 6, UMS JWKS Client |
| [`pos-service`](apps/pos-service) | `3003` | Point of Sale Core (Orders, Shifts, Outbox Kafka) | `pos_db` | NestJS 11, Prisma 6, KafkaJS, Outbox |
| [`wms-service`](apps/wms-service) | `3004` | Warehouse Management System & Stock Ledger | `wms_db` | NestJS 11, Prisma 6, POS Kafka Consumer |
| [`billing-service`](apps/billing-service) | `3005` | Payment Gateway (Midtrans), Webhooks, Idempotency | `billing_db` | NestJS 11, Prisma 6, Midtrans, Redis, Outbox |
| [`minio-file-service`](apps/minio-file-service) | `3006` | S3 / MinIO Object Storage & Presigned URLs | `file_db` | NestJS 11, Prisma 6, MinIO S3 SDK |
| [`notification-service`](apps/notification-service) | `3007` | Central Dispatcher (Email, FCM, In-App) via BullMQ | `notification_db` | NestJS 11, Prisma 6, BullMQ, Redis |

---

## 🏛️ Repository Layout

```text
backend-monorepo/
├── apps/
│   ├── ums-service/              # Central Auth & Identity Provider (Port 3001)
│   ├── cms-service/              # Headless CMS (Port 3002)
│   ├── pos-service/              # Point of Sale Core (Port 3003)
│   ├── wms-service/              # Warehouse Management (Port 3004)
│   ├── billing-service/          # Billing & Midtrans Gateway (Port 3005)
│   ├── minio-file-service/       # S3 File Storage Management (Port 3006)
│   └── notification-service/     # BullMQ Queue & Notification Dispatcher (Port 3007)
│
├── packages/
│   ├── common/                   # Shared NestJS filters, interceptors, middleware, decorators, utils
│   ├── auth/                     # UMS JWKS client, JwtAuthGuard, RolesGuard
│   ├── events/                   # Shared event contracts & DTOs (Kafka & Outbox)
│   ├── tsconfig/                 # Base and NestJS tsconfig presets
│   └── eslint-config/            # Shared ESLint configuration
│
├── docker/
│   ├── docker-compose.yml        # PostgreSQL (multi-db), Redis, Kafka, MinIO, Mailpit
│   ├── init-db.sh                # Multi-database init script for PostgreSQL
│   └── env.template              # Environment variable template
│
├── .github/workflows/ci.yml      # Unified CI/CD workflow
├── package.json                  # Root Bun workspaces configuration
└── turbo.json                    # Turborepo task pipeline configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Bun](https://bun.sh) (v1.1+ recommended)
- [Docker](https://www.docker.com/) & Docker Compose

### 2. Environment Setup
Copy the template environment file:
```bash
cp docker/env.template .env
```

### 3. Start Local Infrastructure
Start PostgreSQL, Redis, Kafka, Kafbat UI (`http://localhost:8080`), MinIO, and Mailpit:
```bash
bun run docker:up
```

### 4. Install Dependencies & Generate Prisma Clients
```bash
bun install
bun run prisma:generate
```

### 5. Running Services

Run all services in development mode with Turborepo:
```bash
bun run dev
```

Or run a specific service:
```bash
bun --filter ums-service start:dev
bun --filter pos-service start:dev
bun --filter billing-service start:dev
```

### 6. Building & Testing

```bash
# Build all apps & packages
bun run build

# Run unit tests across all services
bun run test

# Run linter
bun run lint
```
