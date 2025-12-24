-- Expand quick_note character limit from 5000 to 20000
-- This migration continues the expansion started in 20251223_expand_quick_note_limit.sql
-- Supporting longer notes for detailed project documentation

-- Drop existing constraint
ALTER TABLE projectinfo
DROP CONSTRAINT IF EXISTS quick_note_length_check;

-- Add new constraint with expanded limit (20000 characters)
ALTER TABLE projectinfo
ADD CONSTRAINT quick_note_length_check CHECK (length(quick_note) <= 20000);

-- Update comment to reflect new limit
COMMENT ON COLUMN projectinfo.quick_note IS 'Project note (max 20000 characters) - expanded from 5000 char limit';
