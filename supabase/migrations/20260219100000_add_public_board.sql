-- ============================================================================
-- Add Public Board Sharing (Phase 1)
-- ============================================================================
--
-- Adds ability to make boards publicly viewable via unique share slugs.
-- Public boards are read-only for unauthenticated visitors.
--
-- New columns on board:
--   is_public  - Whether the board is publicly accessible
--   share_slug - Unique URL slug for public access
--
-- RLS policies allow anyone to SELECT public boards, their status lists,
-- and repo cards. Private data (projectinfo) remains owner-only.
-- ============================================================================

-- 1. Add columns
ALTER TABLE board ADD COLUMN is_public boolean NOT NULL DEFAULT false;
ALTER TABLE board ADD COLUMN share_slug text;

-- 2. Unique partial index on share_slug (only non-null values)
CREATE UNIQUE INDEX idx_board_share_slug ON board(share_slug) WHERE share_slug IS NOT NULL;

-- 3. Public read policies
-- These ADD to existing owner-only policies (PostgreSQL RLS uses OR for multiple SELECT policies)

CREATE POLICY "Anyone can view public boards"
  ON board FOR SELECT
  USING (is_public = true);

CREATE POLICY "Anyone can view public board status lists"
  ON statuslist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = statuslist.board_id
      AND board.is_public = true
    )
  );

CREATE POLICY "Anyone can view public board repo cards"
  ON repocard FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board
      WHERE board.id = repocard.board_id
      AND board.is_public = true
    )
  );
