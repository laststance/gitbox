-- ============================================================================
-- Validate the card-to-board foreign keys added NOT VALID
-- ============================================================================
--
-- VALIDATE CONSTRAINT takes SHARE UPDATE EXCLUSIVE, so reads and writes
-- continue during the scan. It has to be its own migration: in the same
-- transaction as ADD CONSTRAINT, that statement's ACCESS EXCLUSIVE lock is
-- held until commit and the scan would block board loads.
--
-- Re-runnable. Validating a constraint that is already valid succeeds.
--
-- Rollback: nothing of its own. Dropping the keys belongs to the rollback of
-- 20261016170000_repocard_board_links_fkey.sql.
-- ============================================================================

ALTER TABLE public.repocard VALIDATE CONSTRAINT repocard_board_owner_fkey;
ALTER TABLE public.repocard VALIDATE CONSTRAINT repocard_status_board_fkey;
