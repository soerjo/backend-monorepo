-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SOCKET_IO', 'TELEGRAM', 'EMAIL', 'FCM', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRY');

-- CreateEnum
CREATE TYPE "DeliveryLogStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "trace_id" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient_id" VARCHAR(128) NOT NULL,
    "recipient_target" VARCHAR(255) NOT NULL,
    "template_code" VARCHAR(64),
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "DeliveryLogStatus" NOT NULL,
    "provider_response" JSONB NOT NULL DEFAULT '{}',
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_trace_id_idx" ON "notifications"("trace_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_notification_id_idx" ON "notification_delivery_logs"("notification_id");

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
