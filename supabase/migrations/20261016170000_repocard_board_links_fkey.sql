-- ============================================================================
-- Tie a card to its board and its column with foreign keys
-- ============================================================================
--
-- set_repocard_user_id still copies the board owner onto the card. A foreign
-- key cannot do that on insert, or when the card itself changes boards, and
-- the seed and the service-role writes rely on the copy. What the trigger
-- does not do is follow a change of board.user_id: the card would keep the
-- old owner, and deleting that account would then delete the card. The
-- composite key below cascades that change.
--
-- check_repocard_status_board and forbid_statuslist_board_change go away.
-- repocard (status_id, board_id) -> statuslist (id, board_id) is the same
-- rule for a card, and for a column that still holds cards. An empty column
-- can change boards: nothing references the old pair. The app never moves a
-- column.
--
-- Existing rows are counted first. A stranded card, or a card whose user_id
-- is not its board's, stops the migration before any write. The message
-- carries the two counts only. The foreign keys are added NOT VALID, so that
-- check is not the scan that holds ACCESS EXCLUSIVE. The next migration
-- validates them.
--
-- One statement (a DO block) and re-runnable. A second run, once both keys
-- exist, changes nothing.
--
-- Rollback (new migration):
--   ALTER TABLE repocard DROP CONSTRAINT repocard_status_board_fkey;
--   ALTER TABLE repocard DROP CONSTRAINT repocard_board_owner_fkey;
--   ALTER TABLE statuslist DROP CONSTRAINT statuslist_id_board_id_key;
--   ALTER TABLE board DROP CONSTRAINT board_id_user_id_key;
--   and restore the two triggers from 20261011020000_repocard_status_board_guard.sql
-- ============================================================================

DO $migration$
DECLARE
  v_stranded integer;
  v_owner_mismatch integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'repocard_board_owner_fkey'
      AND conrelid = 'public.repocard'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'repocard_status_board_fkey'
      AND conrelid = 'public.repocard'::regclass
  ) THEN
    RETURN;
  END IF;

  -- Writes wait. The count and the keys that follow see the same rows, and
  -- reads of a board are not blocked. The exclusive lock of ADD CONSTRAINT
  -- is only the catalog change: the keys are NOT VALID.
  LOCK TABLE public.board, public.statuslist, public.repocard
    IN SHARE ROW EXCLUSIVE MODE;

  SELECT count(*) INTO v_stranded
  FROM public.repocard r
  JOIN public.statuslist s ON s.id = r.status_id
  WHERE s.board_id <> r.board_id;

  SELECT count(*) INTO v_owner_mismatch
  FROM public.repocard r
  JOIN public.board b ON b.id = r.board_id
  WHERE r.user_id IS DISTINCT FROM b.user_id;

  IF v_stranded > 0 OR v_owner_mismatch > 0 THEN
    RAISE EXCEPTION 'repocard board links are not ready for a foreign key'
      USING DETAIL = format(
        'stranded=%s owner_mismatch=%s. Point a stranded card at a column of its own board, and set user_id from its board, then re-run.',
        v_stranded,
        v_owner_mismatch
      );
  END IF;

  -- id is already unique. The pair is what a composite foreign key can cite.
  ALTER TABLE public.board
    DROP CONSTRAINT IF EXISTS board_id_user_id_key;
  ALTER TABLE public.board
    ADD CONSTRAINT board_id_user_id_key UNIQUE (id, user_id);

  ALTER TABLE public.statuslist
    DROP CONSTRAINT IF EXISTS statuslist_id_board_id_key;
  ALTER TABLE public.statuslist
    ADD CONSTRAINT statuslist_id_board_id_key UNIQUE (id, board_id);

  ALTER TABLE public.repocard
    ADD CONSTRAINT repocard_board_owner_fkey
    FOREIGN KEY (board_id, user_id)
    REFERENCES public.board (id, user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
    NOT VALID;

  ALTER TABLE public.repocard
    ADD CONSTRAINT repocard_status_board_fkey
    FOREIGN KEY (status_id, board_id)
    REFERENCES public.statuslist (id, board_id)
    ON DELETE CASCADE
    NOT VALID;

  DROP TRIGGER IF EXISTS check_repocard_status_board ON public.repocard;
  DROP FUNCTION IF EXISTS public.check_repocard_status_board();
  DROP TRIGGER IF EXISTS forbid_statuslist_board_change ON public.statuslist;
  DROP FUNCTION IF EXISTS public.forbid_statuslist_board_change();
END
$migration$;
