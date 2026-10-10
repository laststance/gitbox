-- ============================================================================
-- One Repository, One Card Per User (Issue #215)
-- ============================================================================
--
-- A user may place a given GitHub repository on at most one of their boards.
-- Until now uniqueness was per board only (unique_repo_per_board), so the same
-- repository could sit on several boards with diverging note / links / comment.
--
-- What this adds:
--   repocard.user_id                 - owner, always copied from board.user_id
--   set_repocard_user_id (trigger)   - keeps user_id in sync and unforgeable
--   repocard_unique_repo_per_user    - UNIQUE (user_id, lower(owner), lower(name))
--
-- What this never does: merge or delete cards. If a user already has the same
-- repository on two boards, the guard below aborts and nothing is changed.
-- Remove the extra card in the app, then re-run.
--
-- The whole body is ONE statement (a DO block), so it is atomic no matter how
-- the CLI wraps the file. Every step is also re-runnable.
--
-- Rollback (new migration):
--   DROP INDEX repocard_unique_repo_per_user;
--   DROP TRIGGER set_repocard_user_id ON repocard;
--   DROP FUNCTION set_repocard_user_id();
--   ALTER TABLE repocard DROP COLUMN user_id;
-- ============================================================================

DO $migration$
DECLARE
  v_duplicate_groups integer;
BEGIN
  -- 1. Guard: refuse to run while any user holds one repository on 2+ boards.
  --    The message carries a count only (no repository names, no user ids).
  SELECT count(*) INTO v_duplicate_groups
  FROM (
    SELECT 1
    FROM repocard r
    JOIN board b ON b.id = r.board_id
    GROUP BY b.user_id, lower(r.repo_owner), lower(r.repo_name)
    HAVING count(*) > 1
  ) duplicate_groups;

  IF v_duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'repocard_unique_repo_per_user: % repository group(s) sit on more than one board of the same user. Remove the extra card(s) in the app, then re-run this migration. Nothing was changed.',
      v_duplicate_groups;
  END IF;

  -- 2. Owner column. The default keeps user_id optional for inserts; the
  --    trigger below overwrites whatever value arrives.
  ALTER TABLE repocard
    ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

  -- 3. Backfill from the owning board. User triggers are switched off so
  --    update_repocard_updated_at does not rewrite every card's updated_at.
  ALTER TABLE repocard DISABLE TRIGGER USER;

  UPDATE repocard r
  SET user_id = b.user_id
  FROM board b
  WHERE b.id = r.board_id
    AND r.user_id IS NULL;

  ALTER TABLE repocard ENABLE TRIGGER USER;

  ALTER TABLE repocard ALTER COLUMN user_id SET NOT NULL;

  -- 4. Keep user_id equal to the board owner on every insert and on every
  --    change of board_id / user_id. SECURITY INVOKER: a caller who cannot see
  --    the board (RLS) cannot attach a card to it.
  CREATE OR REPLACE FUNCTION set_repocard_user_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE
    v_board_owner uuid;
  BEGIN
    SELECT user_id INTO v_board_owner FROM board WHERE id = NEW.board_id;

    IF v_board_owner IS NULL THEN
      RAISE EXCEPTION 'board % not found', NEW.board_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Always overwrite: a client-supplied user_id is never trusted
    NEW.user_id := v_board_owner;
    RETURN NEW;
  END;
  $function$;

  DROP TRIGGER IF EXISTS set_repocard_user_id ON repocard;

  CREATE TRIGGER set_repocard_user_id
    BEFORE INSERT OR UPDATE OF board_id, user_id ON repocard
    FOR EACH ROW EXECUTE FUNCTION set_repocard_user_id();

  -- 5. One card per (user, repository). GitHub names are case-insensitive.
  --    The name unique_repo_per_user is already taken by the maintenance table.
  CREATE UNIQUE INDEX IF NOT EXISTS repocard_unique_repo_per_user
    ON repocard (user_id, lower(repo_owner), lower(repo_name));
END
$migration$;
