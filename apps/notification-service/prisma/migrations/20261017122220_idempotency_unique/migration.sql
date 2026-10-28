-- Idempotency DB-level guarantee.
--
-- The single-column UNIQUE index on notifications.idempotency_key is created by
-- 20261017051016_init_notifications. It is re-asserted here defensively (IF NOT
-- EXISTS) so this migration is the self-contained source of truth for the
-- idempotency invariant that a caller key is never duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- Supports the prefix lookup used by the ingestion path to group every row
-- produced by a single caller idempotency_key: single recipient/channel rows
-- store the key verbatim (exact match), while batch/multi-channel rows store
-- "<key>::<channel>::<recipient>" and are matched with a LIKE prefix scan.
-- (BTree "text_pattern_ops" is required for LIKE 'prefix%' to use an index
-- under non-C collations.)
CREATE INDEX "notifications_idempotency_key_pattern_idx" ON "notifications"("idempotency_key" text_pattern_ops);
