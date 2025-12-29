-- GitBox - Expand Theme Constraint Migration
-- Created: 2025-12-29
-- Purpose: Add 'default' and 'dark' to the check_theme constraint
--
-- This migration expands the allowed theme values from 12 to 14:
-- - Adds 'default' as the neutral light theme option
-- - Adds 'dark' as the base dark theme option

-- Drop existing constraint
ALTER TABLE board DROP CONSTRAINT IF EXISTS check_theme;

-- Add new constraint with expanded theme list (14 themes)
ALTER TABLE board ADD CONSTRAINT check_theme
  CHECK (theme IN (
    -- Light themes (7)
    'default', 'sunrise', 'sandstone', 'mint', 'sky', 'lavender', 'rose',
    -- Dark themes (7)
    'dark', 'midnight', 'graphite', 'forest', 'ocean', 'plum', 'rust'
  ));
