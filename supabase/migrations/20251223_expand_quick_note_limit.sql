-- Expand quick_note character limit from 300 to 5000
-- This allows for more detailed project notes while maintaining reasonable limits

-- Drop existing constraint
ALTER TABLE projectinfo
DROP CONSTRAINT IF EXISTS quick_note_length_check;

-- Add new constraint with expanded limit (5000 characters)
ALTER TABLE projectinfo
ADD CONSTRAINT quick_note_length_check CHECK (length(quick_note) <= 5000);

-- Update comment to reflect new limit
COMMENT ON COLUMN projectinfo.quick_note IS 'Project note (max 5000 characters) - expanded from original 300 char limit';
