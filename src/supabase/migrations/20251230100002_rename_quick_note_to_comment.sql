-- Rename quick_note column to comment in projectinfo table
-- Phase 1.3: Column rename for inline comment feature (Card-in-Card UI)
-- Issue: https://github.com/laststance/gitbox/issues/20

-- Drop existing constraint (will be recreated with new column name)
ALTER TABLE projectinfo
DROP CONSTRAINT IF EXISTS quick_note_length_check;

-- Rename column
ALTER TABLE projectinfo
RENAME COLUMN quick_note TO comment;

-- Add constraint with updated name and appropriate limit for inline comments
-- Using 2000 chars for comment (shorter than rich text note, but sufficient for inline)
ALTER TABLE projectinfo
ADD CONSTRAINT comment_length_check CHECK (length(comment) <= 2000);

-- Update comment for documentation
COMMENT ON COLUMN projectinfo.comment IS 'Inline comment displayed on RepoCard (max 2000 characters) - Card-in-Card UI';
