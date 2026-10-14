-- Replace global object_key uniqueness with a per-bucket composite one.
--
-- NOTE: in prod the global uniqueness on object_key exists as a BARE unique
-- index (created by a baseline `prisma db push`), not a table constraint —
-- pg_constraint has no row named file_uploads_object_key_key while
-- pg_indexes has the b-tree index of the same name enforcing uniqueness.
-- DROP CONSTRAINT would fail with 42704, so drop the index instead (IF EXISTS
-- keeps this safe for databases where it exists as a constraint).
DROP INDEX IF EXISTS "file_uploads_object_key_key";
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_bucket_object_key_key" UNIQUE ("bucket", "object_key");
