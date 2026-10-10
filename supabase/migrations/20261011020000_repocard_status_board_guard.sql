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
--   check_repocard_status_board (trigger on repocard) - refuses an insert, or
--   a change of board_id / status_id, whose column is not a column of the
--   card's board.
--   forbid_statuslist_board_change (trigger on statuslist) - refuses moving a
--   column to another board, which would strand every card in it from the
--   other side. The app never does this; only a direct API call could.
--
-- Existing rows are not touched or repaired. The migration counts cards that
-- are already stranded and reports the number as a WARNING in the migration
-- output (a count only, no ids or names). The same count by hand:
--   SELECT count(*) FROM repocard r
--   JOIN statuslist s ON s.id = r.status_id
--   WHERE s.board_id <> r.board_id;
-- To repair one, point its status_id at a column of its own board.
--
-- One statement (a DO block) and re-runnable, like the previous migration.
--
-- Rollback (new migration):
--   DROP TRIGGER check_repocard_status_board ON repocard;
--   DROP FUNCTION check_repocard_status_board();
--   DROP TRIGGER forbid_statuslist_board_change ON statuslist;
--   DROP FUNCTION forbid_statuslist_board_change();
-- ============================================================================

DO $migration$
DECLARE
  v_stranded_cards integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  -- Cards an earlier stale write already stranded stay as they are; say how
  -- many there are so they can be repaired by hand.
  SELECT count(*) INTO v_stranded_cards
  FROM repocard r
  JOIN statuslist s ON s.id = r.status_id
  WHERE s.board_id <> r.board_id;

  IF v_stranded_cards > 0 THEN
    RAISE WARNING
      'check_repocard_status_board: % existing card(s) sit in a column of another board and are shown on no board. They are left unchanged; see the header of this migration for the repair.',
      v_stranded_cards;
  END IF;

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

  -- The same rule from the column's side: a column stays on its board.
  CREATE OR REPLACE FUNCTION forbid_statuslist_board_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
  AS $function$
  BEGIN
    IF NEW.board_id IS DISTINCT FROM OLD.board_id THEN
      RAISE EXCEPTION 'status % cannot be moved to another board', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END;
  $function$;

  DROP TRIGGER IF EXISTS forbid_statuslist_board_change ON statuslist;

  CREATE TRIGGER forbid_statuslist_board_change
    BEFORE UPDATE OF board_id ON statuslist
    FOR EACH ROW EXECUTE FUNCTION forbid_statuslist_board_change();
END
$migration$;
