-- Drop Unused Maintenance Table Columns
-- Reason: These columns are no longer used after projectinfo refactoring
--
-- Dropped columns:
-- 1. note - Always null, notes now stored in projectinfo.note
-- 2. repo_card_id - Always null, relationship now via projectinfo.maintenance_id
-- 3. hidden - Always false, no UI to toggle visibility (showArchived feature never implemented)

-- Drop the foreign key constraint first (if exists)
ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS maintenance_repo_card_id_fkey;

-- Drop the unique constraint on repo_card_id
ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS maintenance_repo_card_id_key;

-- Drop the columns
ALTER TABLE maintenance DROP COLUMN IF EXISTS note;
ALTER TABLE maintenance DROP COLUMN IF EXISTS repo_card_id;
ALTER TABLE maintenance DROP COLUMN IF EXISTS hidden;

-- Drop the hidden index (created in initial schema)
DROP INDEX IF EXISTS idx_maintenance_hidden;
