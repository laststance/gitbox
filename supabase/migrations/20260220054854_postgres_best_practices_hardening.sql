-- ============================================================================
-- Postgres Best Practices Hardening
-- ============================================================================
--
-- Addresses 5 issues found during Supabase Postgres best practices audit:
--
-- 1. Missing updated_at trigger on user_settings
-- 2. Missing updated_at trigger on user_link_presets
-- 3. Missing DELETE RLS policy on user_settings
-- 4. Missing partial index on board(is_public) for public board RLS policies
-- 5. Harden update_updated_at_column() with SET search_path
--
-- All changes are additive and backwards-compatible.
-- ============================================================================

-- ============================================================================
-- 1. Add updated_at trigger for user_settings
--    Table has updated_at column but no auto-update trigger.
--    All other tables (board, statuslist, repocard, projectinfo, maintenance)
--    already have this trigger.
-- ============================================================================

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Add updated_at trigger for user_link_presets
--    Same issue — updated_at column exists but never auto-updates.
-- ============================================================================

CREATE TRIGGER update_user_link_presets_updated_at
  BEFORE UPDATE ON user_link_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Add DELETE RLS policy for user_settings
--    Has SELECT/INSERT/UPDATE but missing DELETE policy.
--    All other direct user_id tables (board, maintenance, user_link_presets)
--    have DELETE policies.
-- ============================================================================

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. Add partial index on board(is_public) for public board RLS
--    Three RLS policies (board, statuslist, repocard) filter on
--    board.is_public = true. Without an index, these require full table scan.
--    Partial index is ideal since most boards are private.
-- ============================================================================

CREATE INDEX idx_board_is_public ON board(id, is_public)
  WHERE is_public = true;

-- ============================================================================
-- 5. Harden update_updated_at_column() with SET search_path
--    Supabase security best practice: all functions should restrict search_path
--    to prevent search_path injection attacks.
--    Ref: https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
