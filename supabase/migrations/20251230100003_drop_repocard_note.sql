-- Drop note column from repocard table
-- Phase 1.4: Cleanup after data migration to projectinfo
-- Issue: https://github.com/laststance/gitbox/issues/20
--
-- IMPORTANT: This migration should only run AFTER data has been verified
-- to be successfully migrated to projectinfo.note

-- Drop the note column from repocard
-- The CHECK constraint is automatically dropped with the column
ALTER TABLE repocard
DROP COLUMN IF EXISTS note;

-- Add comment for migration tracking
COMMENT ON TABLE repocard IS 'Repository card - note column migrated to projectinfo.note (2025-12-30)';
