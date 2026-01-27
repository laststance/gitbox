-- Add note column to projectinfo table
-- Phase 1.1: Prepare projectinfo to receive rich text notes from repocard
-- Issue: https://github.com/laststance/gitbox/issues/20

-- Add note column with 20k character limit (for PlateEditor rich text content)
ALTER TABLE projectinfo
ADD COLUMN note text;

-- Add constraint for 20000 character limit
ALTER TABLE projectinfo
ADD CONSTRAINT note_length_check CHECK (length(note) <= 20000);

-- Add comment for documentation
COMMENT ON COLUMN projectinfo.note IS 'Rich text project note (max 20000 characters) - migrated from repocard.note';
