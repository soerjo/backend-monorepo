-- AlterTable
ALTER TABLE "media_assets" DROP COLUMN "fileName",
DROP COLUMN "storageKey",
ADD COLUMN     "fileId" TEXT NOT NULL,
ADD COLUMN     "objectKey" TEXT NOT NULL,
ALTER COLUMN "url" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_fileId_key" ON "media_assets"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_objectKey_key" ON "media_assets"("objectKey");
