-- ============================================================================
-- Add position column to board table for user-controlled ordering
-- ============================================================================
--
-- Previously boards were always ordered by created_at DESC.
-- This migration adds a position column so users can reorder boards via DnD.
-- Backfill assigns positions based on created_at DESC to preserve current order.
--
-- ============================================================================

-- Add position column (0-indexed, lower = earlier in list)
ALTER TABLE board ADD COLUMN position integer NOT NULL DEFAULT 0;

-- Index for efficient ORDER BY position queries scoped to a user
CREATE INDEX idx_board_user_position ON board (user_id, position);

-- Backfill existing boards: assign sequential positions per user
-- based on created_at DESC (preserves the current display order)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS pos
  FROM board
)
UPDATE board SET position = ranked.pos FROM ranked WHERE board.id = ranked.id;
