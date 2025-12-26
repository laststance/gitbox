-- Add is_favorite column to board table
-- Allows users to mark boards as favorites for quick access

ALTER TABLE board ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;

-- Create composite index for efficient favorites queries per user
CREATE INDEX idx_board_user_favorite ON board(user_id, is_favorite);
