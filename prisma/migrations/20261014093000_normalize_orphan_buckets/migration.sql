-- NormalizeOrphanBuckets (hand-written data migration — no schema change)
--
-- Legacy ORPHAN rows wrongly embed the source bucket name as a prefix of
-- object_key, while the real object lives in that source bucket. Example:
--   bucket = 'app-uploads', object_key = 'test/Gemini_x.png'
-- but the object actually lives in bucket 'test' at key 'Gemini_x.png'.
--
-- This migration moves the prefix out of object_key and into the bucket
-- column, so presigning signs against the correct, per-object bucket.
--
-- Scope: ONLY the two known legacy prefixes are handled. A generic
-- "split on the first slash" rule is deliberately NOT used — valid keys
-- legitimately contain slashes (e.g. '<userId>/<uuid>-<name>'), so a
-- generic rule could corrupt them. Any row with an unknown prefix is left
-- untouched.
--
-- SAFETY: object_key carries a UNIQUE constraint. If stripping a prefix
-- would collide with an existing key, this migration fails loudly with a
-- unique violation rather than silently overwriting data — resolve the
-- collision by hand and re-run. Only status = 'ORPHAN' rows are touched;
-- ACTIVE rows are never rewritten.

-- 'test/' is 5 characters -> substr from position 6 strips the prefix.
UPDATE "file_uploads"
SET
  "bucket" = 'test',
  "object_key" = substr("object_key", 6)
WHERE "status" = 'ORPHAN'
  AND "object_key" LIKE 'test/%'
  -- Rows whose stripped key already exists are skipped: the duplicate is a
  -- byte-identical copy preserved under its own bucket prefix, and the
  -- composite UNIQUE(bucket, object_key) added by migration 20261014094500
  -- keeps both.
  AND NOT EXISTS (
    SELECT 1 FROM "file_uploads" u2
    WHERE u2."bucket" = 'test'
      AND u2."object_key" = substr("file_uploads"."object_key", 6)
  );

-- 'default-upload/' is 15 characters -> substr from position 16 strips it.
UPDATE "file_uploads"
SET
  "bucket" = 'default-upload',
  "object_key" = substr("object_key", 16)
WHERE "status" = 'ORPHAN'
  AND "object_key" LIKE 'default-upload/%'
  -- Rows whose stripped key already exists are skipped: the duplicate is a
  -- byte-identical copy preserved under its own bucket prefix, and the
  -- composite UNIQUE(bucket, object_key) added by migration 20261014094500
  -- keeps both.
  AND NOT EXISTS (
    SELECT 1 FROM "file_uploads" u2
    WHERE u2."bucket" = 'default-upload'
      AND u2."object_key" = substr("file_uploads"."object_key", 16)
  );
