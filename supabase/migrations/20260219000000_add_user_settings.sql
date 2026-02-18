-- Migration: Add user_settings table for per-user page customization
-- Stores customizable page metadata (e.g., boards page title/subtitle)

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  boards_page_title TEXT DEFAULT NULL,
  boards_page_subtitle TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (optimized with (select auth.uid()) pattern)
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own settings"
  ON user_settings FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

COMMENT ON TABLE user_settings IS 'Per-user customization settings (boards page title, subtitle, etc.)';
COMMENT ON COLUMN user_settings.boards_page_title IS 'Custom title for /boards page. NULL = default "My Boards"';
COMMENT ON COLUMN user_settings.boards_page_subtitle IS 'Custom subtitle for /boards page. NULL = default text';
