-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'app-uploads',
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_uploads_object_key_key" ON "file_uploads"("object_key");

-- CreateIndex
CREATE INDEX "file_uploads_uploaded_by_idx" ON "file_uploads"("uploaded_by");

-- CreateIndex
CREATE INDEX "file_uploads_created_at_idx" ON "file_uploads"("created_at" DESC);

-- CreateIndex
CREATE INDEX "file_uploads_checksum_idx" ON "file_uploads"("checksum");

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint (hand-added — Prisma has no CHECK syntax; see docs/DB_DESIGN.md §4)
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_size_bytes_check" CHECK (size_bytes > 0);
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_status_check" CHECK (status IN ('ACTIVE', 'DELETED'));
