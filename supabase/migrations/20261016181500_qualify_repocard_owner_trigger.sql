-- ============================================================================
-- Name the schema in the card owner trigger
-- ============================================================================
--
-- set_repocard_user_id copies the board owner onto the card. It read `board`
-- through search_path. A temporary table of that name in the session would
-- stand in for public.board. The other two trigger functions this was going
-- to qualify are gone: the foreign keys took their place.
--
-- Re-runnable. Replacing the function keeps its trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_repocard_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_board_owner uuid;
BEGIN
  SELECT user_id INTO v_board_owner FROM public.board WHERE id = NEW.board_id;

  IF v_board_owner IS NULL THEN
    RAISE EXCEPTION 'board % not found', NEW.board_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Always overwrite: a client-supplied user_id is never trusted
  NEW.user_id := v_board_owner;
  RETURN NEW;
END;
$function$;
