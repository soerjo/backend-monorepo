-- AlterTable
ALTER TABLE "file_uploads" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: previously, soft-delete state was conflated into "status". Migrate
-- every existing DELETED row onto the new audit columns and reset its status
-- (status now only expresses data origin: ACTIVE | ORPHAN).
UPDATE "file_uploads"
SET
  "is_deleted" = true,
  "deleted_at" = "updated_at",
  "deleted_by" = NULL,
  "status" = 'ACTIVE'
WHERE "status" = 'DELETED';

-- CreateIndex (partial index — Prisma has no partial-index syntax; hand-written
-- so deletes stay cheap and only live rows are indexed)
CREATE INDEX "file_uploads_is_deleted_deleted_at_idx" ON "file_uploads"("is_deleted", "deleted_at") WHERE "is_deleted";

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
