-- Migration: Add user_link_presets table for custom link type management
-- This table stores user-defined link types that appear alongside built-in presets

-- Create the user_link_presets table
CREATE TABLE IF NOT EXISTS user_link_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value TEXT NOT NULL,           -- unique identifier (kebab-case, e.g., "my-service")
  label TEXT NOT NULL,           -- display name (e.g., "My Service")
  icon TEXT DEFAULT 'Link',      -- lucide icon name
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_link_presets_user_value_unique UNIQUE(user_id, value),
  CONSTRAINT user_link_presets_value_format CHECK (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT user_link_presets_label_length CHECK (char_length(label) BETWEEN 1 AND 50)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_link_presets_user_id ON user_link_presets(user_id);

-- Enable Row Level Security
ALTER TABLE user_link_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own presets
CREATE POLICY "Users can view own presets"
  ON user_link_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own presets"
  ON user_link_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets"
  ON user_link_presets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets"
  ON user_link_presets FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE user_link_presets IS 'User-defined link type presets for ProjectInfo links feature';
COMMENT ON COLUMN user_link_presets.value IS 'Kebab-case identifier used as link type value';
COMMENT ON COLUMN user_link_presets.label IS 'Human-readable display name shown in UI';
COMMENT ON COLUMN user_link_presets.icon IS 'Lucide icon name for visual representation';
