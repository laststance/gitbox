-- Migration: Add 2D grid positioning to StatusList
-- Purpose: Enable free column positioning in any row/column of the Kanban board
-- Date: 2024-12-24

-- Add grid position columns with default values
ALTER TABLE statuslist ADD COLUMN IF NOT EXISTS grid_row integer NOT NULL DEFAULT 0;
ALTER TABLE statuslist ADD COLUMN IF NOT EXISTS grid_col integer NOT NULL DEFAULT 0;

-- Migrate existing order values to grid_col (all columns start in row 0)
-- This preserves the current horizontal order as column positions
UPDATE statuslist SET grid_row = 0, grid_col = "order" WHERE grid_col = 0;

-- Create index for efficient grid lookups per board
CREATE INDEX IF NOT EXISTS idx_statuslist_grid ON statuslist(board_id, grid_row, grid_col);

-- Note: Keeping "order" column for backwards compatibility
-- Can be removed in a future migration after confirming grid positions work correctly
