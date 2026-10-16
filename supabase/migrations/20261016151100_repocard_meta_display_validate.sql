-- ============================================================================
-- Validate repocard_meta_display after it was added NOT VALID
-- ============================================================================
--
-- VALIDATE CONSTRAINT takes SHARE UPDATE EXCLUSIVE, so reads and writes
-- continue during the scan. It has to be its own migration: in the same
-- transaction as ADD CONSTRAINT, that statement's ACCESS EXCLUSIVE lock is
-- held until commit and the scan would block board loads.
--
-- Re-runnable. Validating a constraint that is already valid succeeds.
--
-- Rollback: nothing of its own. Dropping the constraint belongs to the
-- rollback of 20261016151000_repocard_meta_display_check.sql.
-- ============================================================================

ALTER TABLE public.repocard VALIDATE CONSTRAINT repocard_meta_display;
