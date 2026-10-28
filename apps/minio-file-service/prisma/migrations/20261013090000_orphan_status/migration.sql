-- ExpandStatusCheck (hand-added — Prisma has no CHECK syntax; see docs/DB_DESIGN.md §4)
ALTER TABLE "file_uploads" DROP CONSTRAINT "file_uploads_status_check";
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_status_check" CHECK ("status" IN ('ACTIVE', 'DELETED', 'ORPHAN'));
