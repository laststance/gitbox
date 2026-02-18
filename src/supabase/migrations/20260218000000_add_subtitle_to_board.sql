-- Add subtitle column to board table for optional board descriptions
-- Shown below the board title in the header, editable inline

ALTER TABLE board ADD COLUMN subtitle TEXT DEFAULT NULL;

ALTER TABLE board ADD CONSTRAINT board_subtitle_length
  CHECK (subtitle IS NULL OR char_length(subtitle) <= 100);

COMMENT ON COLUMN board.subtitle IS 'Optional short description shown below board title (max 100 chars)';
