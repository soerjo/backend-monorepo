-- Replace global object_key UNIQUE with per-bucket composite unique
ALTER TABLE "file_uploads" DROP CONSTRAINT "file_uploads_object_key_key";
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_bucket_object_key_key" UNIQUE ("bucket", "object_key");
