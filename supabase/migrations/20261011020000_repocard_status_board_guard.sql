-- ============================================================================
-- A Card's Column Must Belong To The Card's Board (Issue #215 follow-up)
-- ============================================================================
--
-- repocard carries both board_id and status_id, and nothing tied them together.
-- A stale write could put a card of board B into a column of board A: undoing a
-- drag after "Move to Another Board", or dragging the card in a second tab that
-- still shows the old board. Such a card is rendered on no board, yet it still
-- holds its repository under repocard_unique_repo_per_user, so the repository
-- could no longer be added or restored anywhere and no screen could remove it.
--
-- What this adds:
--   check_repocard_status_board (trigger) - refuses an insert, or a change of
--   board_id / status_id, whose column is not a column of the card's board.
--
-- Existing rows are not touched or validated. Count cards that are already
-- stranded (expected: 0) with:
--   SELECT count(*) FROM repocard r
--   JOIN statuslist s ON s.id = r.status_id
--   WHERE s.board_id <> r.board_id;
--
-- One statement (a DO block) and re-runnable, like the previous migration.
--
-- Rollback (new migration):
--   DROP TRIGGER check_repocard_status_board ON repocard;
--   DROP FUNCTION check_repocard_status_board();
-- ============================================================================

DO $migration$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  -- SECURITY INVOKER: the column is read with the caller's rights. A caller
  -- who cannot see the column cannot place a card in it.
  CREATE OR REPLACE FUNCTION check_repocard_status_board()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
  AS $function$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM statuslist
      WHERE id = NEW.status_id AND board_id = NEW.board_id
    ) THEN
      RAISE EXCEPTION 'status % does not belong to board %',
        NEW.status_id, NEW.board_id
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END;
  $function$;

  DROP TRIGGER IF EXISTS check_repocard_status_board ON repocard;

  CREATE TRIGGER check_repocard_status_board
    BEFORE INSERT OR UPDATE OF board_id, status_id ON repocard
    FOR EACH ROW EXECUTE FUNCTION check_repocard_status_board();
END
$migration$;
