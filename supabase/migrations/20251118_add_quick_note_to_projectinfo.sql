-- Add quick_note column to ProjectInfo table
-- User Story 4: Quick note (1-3 lines, max 300 characters)

ALTER TABLE ProjectInfo
ADD COLUMN quick_note text;

-- Add constraint for 300 character limit
ALTER TABLE ProjectInfo
ADD CONSTRAINT quick_note_length_check CHECK (length(quick_note) <= 300);

-- Add comment for documentation
COMMENT ON COLUMN ProjectInfo.quick_note IS 'Quick project note (1-3 lines, max 300 characters) - User Story 4';
