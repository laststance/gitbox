-- Add maintenance_id column to projectinfo table
-- Feature: Maintenance画面でもProjectInfo機能を使えるようにする
-- Issue: Board→Maintenance移動時にProjectInfoデータを保持

-- ============================================================================
-- 1. Add maintenance_id column (nullable, FK to maintenance.id)
-- ============================================================================
ALTER TABLE projectinfo
ADD COLUMN maintenance_id uuid REFERENCES maintenance(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. Make repo_card_id nullable (for when linked to maintenance instead)
-- ============================================================================
-- First drop the existing NOT NULL constraint
ALTER TABLE projectinfo
ALTER COLUMN repo_card_id DROP NOT NULL;

-- ============================================================================
-- 3. Add CHECK constraint: exactly one of repo_card_id or maintenance_id must be set
-- ============================================================================
ALTER TABLE projectinfo
ADD CONSTRAINT projectinfo_target_exclusive_check CHECK (
  (repo_card_id IS NOT NULL AND maintenance_id IS NULL) OR
  (repo_card_id IS NULL AND maintenance_id IS NOT NULL)
);

-- ============================================================================
-- 4. Add index for maintenance_id lookups
-- ============================================================================
CREATE INDEX idx_projectinfo_maintenance_id ON projectinfo(maintenance_id);

-- ============================================================================
-- 5. Update RLS Policies to support access via maintenance
-- ============================================================================

-- Drop existing policies (they only check repo_card_id)
DROP POLICY IF EXISTS "Users can view their project info" ON projectinfo;
DROP POLICY IF EXISTS "Users can manage their project info" ON projectinfo;

-- Recreate SELECT policy: allow access via repocard OR maintenance
CREATE POLICY "Users can view their project info"
  ON projectinfo FOR SELECT
  USING (
    -- Access via RepoCard (existing path)
    EXISTS (
      SELECT 1 FROM repocard
      JOIN board ON board.id = repocard.board_id
      WHERE repocard.id = projectinfo.repo_card_id AND board.user_id = auth.uid()
    )
    OR
    -- Access via Maintenance (new path)
    EXISTS (
      SELECT 1 FROM maintenance
      WHERE maintenance.id = projectinfo.maintenance_id AND maintenance.user_id = auth.uid()
    )
  );

-- Recreate ALL policy: allow management via repocard OR maintenance
CREATE POLICY "Users can manage their project info"
  ON projectinfo FOR ALL
  USING (
    -- Access via RepoCard (existing path)
    EXISTS (
      SELECT 1 FROM repocard
      JOIN board ON board.id = repocard.board_id
      WHERE repocard.id = projectinfo.repo_card_id AND board.user_id = auth.uid()
    )
    OR
    -- Access via Maintenance (new path)
    EXISTS (
      SELECT 1 FROM maintenance
      WHERE maintenance.id = projectinfo.maintenance_id AND maintenance.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON COLUMN projectinfo.maintenance_id IS 'Foreign key to maintenance table - set when repo is in maintenance mode (mutually exclusive with repo_card_id)';
COMMENT ON CONSTRAINT projectinfo_target_exclusive_check ON projectinfo IS 'Ensures projectinfo is linked to either repocard OR maintenance, never both or neither';
