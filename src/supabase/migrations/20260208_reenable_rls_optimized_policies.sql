-- ============================================================================
-- Re-enable Row Level Security (reverses 20251117_disable_rls_for_testing.sql)
-- ============================================================================
--
-- This migration:
-- 1. Re-enables RLS on all 5 core tables
-- 2. Drops and recreates ALL policies with (select auth.uid()) optimization
-- 3. Optimizes user_link_presets policies (already enabled)
--
-- Performance optimization: wrapping auth.uid() in a subquery ensures it is
-- evaluated once per query instead of once per row. This prevents the planner
-- from treating it as a volatile function call.
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================================

-- ============================================================================
-- 1. Re-enable RLS on core tables
-- ============================================================================

ALTER TABLE board ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuslist ENABLE ROW LEVEL SECURITY;
ALTER TABLE repocard ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectinfo ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Board Policies (direct user_id column)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own boards" ON board;
DROP POLICY IF EXISTS "Users can create their own boards" ON board;
DROP POLICY IF EXISTS "Users can update their own boards" ON board;
DROP POLICY IF EXISTS "Users can delete their own boards" ON board;

CREATE POLICY "Users can view their own boards"
  ON board FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create their own boards"
  ON board FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own boards"
  ON board FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own boards"
  ON board FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. StatusList Policies (via board join)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their board's status lists" ON statuslist;
DROP POLICY IF EXISTS "Users can manage their board's status lists" ON statuslist;

CREATE POLICY "Users can view their board's status lists"
  ON statuslist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = statuslist.board_id
      AND board.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can manage their board's status lists"
  ON statuslist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = statuslist.board_id
      AND board.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = statuslist.board_id
      AND board.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 4. RepoCard Policies (via board join)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their board's repo cards" ON repocard;
DROP POLICY IF EXISTS "Users can manage their board's repo cards" ON repocard;

CREATE POLICY "Users can view their board's repo cards"
  ON repocard FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = repocard.board_id
      AND board.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can manage their board's repo cards"
  ON repocard FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = repocard.board_id
      AND board.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = repocard.board_id
      AND board.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 5. ProjectInfo Policies (via repocard->board OR maintenance)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their project info" ON projectinfo;
DROP POLICY IF EXISTS "Users can manage their project info" ON projectinfo;

CREATE POLICY "Users can view their project info"
  ON projectinfo FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM repocard
      JOIN board ON board.id = repocard.board_id
      WHERE repocard.id = projectinfo.repo_card_id
      AND board.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM maintenance
      WHERE maintenance.id = projectinfo.maintenance_id
      AND maintenance.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can manage their project info"
  ON projectinfo FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM repocard
      JOIN board ON board.id = repocard.board_id
      WHERE repocard.id = projectinfo.repo_card_id
      AND board.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM maintenance
      WHERE maintenance.id = projectinfo.maintenance_id
      AND maintenance.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repocard
      JOIN board ON board.id = repocard.board_id
      WHERE repocard.id = projectinfo.repo_card_id
      AND board.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM maintenance
      WHERE maintenance.id = projectinfo.maintenance_id
      AND maintenance.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 6. Maintenance Policies (direct user_id column)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their maintenance items" ON maintenance;
DROP POLICY IF EXISTS "Users can manage their maintenance items" ON maintenance;

CREATE POLICY "Users can view their maintenance items"
  ON maintenance FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage their maintenance items"
  ON maintenance FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 7. user_link_presets Policies (optimize existing - already RLS enabled)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own presets" ON user_link_presets;
DROP POLICY IF EXISTS "Users can insert own presets" ON user_link_presets;
DROP POLICY IF EXISTS "Users can update own presets" ON user_link_presets;
DROP POLICY IF EXISTS "Users can delete own presets" ON user_link_presets;

CREATE POLICY "Users can view own presets"
  ON user_link_presets FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own presets"
  ON user_link_presets FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own presets"
  ON user_link_presets FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own presets"
  ON user_link_presets FOR DELETE
  USING ((select auth.uid()) = user_id);
