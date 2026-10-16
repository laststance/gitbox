-- ============================================================================
-- Remove Public Board Sharing From The Database
-- ============================================================================
--
-- Board sharing by link is gone from the app: a board opens only for the
-- account that owns it. The build that stopped reading board.is_public,
-- board.share_slug and get_public_board(text) shipped before this migration
-- and runs on both schemas.
--
-- What this changes:
--   get_public_board(text) is dropped. It was the only SECURITY DEFINER
--   function in schema public that anon could execute; dropping it removes
--   its grants too.
--   board.share_slug and board.is_public are dropped, and
--   idx_board_share_slug goes with its column. No CASCADE: a policy, view or
--   index that still depends on a column makes the statement fail, and the
--   whole migration rolls back, instead of being dropped unseen.
--
-- One statement (a DO block) and re-runnable: it returns at once when the
-- function and both columns are gone, and it counts each column only while
-- it exists, so a run on a partial state does not fail. The block ends with
-- checks of the result. Each raises a message that starts with
-- "remove_public_board:" and names what is left; the next step is in DETAIL,
-- which the CLI prints with a failed migration (it does not print HINT).
--
-- Fix forward only. Once this has run, a build from before the removal of
-- board sharing fails on this schema: its move dialog selects is_public and
-- cannot load its boards. A rollback goes to the first build without board
-- sharing or a later one. A defect is fixed by a new commit on main.
--
-- Emergency step, when a build from before the removal has to run again
-- after this migration (old builds load again; the function stays gone, so
-- nothing can be shared):
--   ALTER TABLE public.board
--     ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
--     ADD COLUMN IF NOT EXISTS share_slug text;
-- ============================================================================

DO $migration$
DECLARE
  public_boards bigint;
  boards_with_slug bigint;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  -- Done before: a second run changes nothing
  IF to_regprocedure('public.get_public_board(text)') IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'board'
        AND column_name IN ('is_public', 'share_slug')
    )
  THEN
    RETURN;
  END IF;

  -- Counts only (the job log of this repository is public). A shared board
  -- does not stop the migration: removing the share is the change.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'board'
      AND column_name = 'is_public'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.board WHERE is_public'
      INTO public_boards;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'board'
      AND column_name = 'share_slug'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.board WHERE share_slug IS NOT NULL'
      INTO boards_with_slug;
  END IF;
  RAISE NOTICE 'remove_public_board: % public boards, % boards with a share slug',
    coalesce(public_boards::text, 'no column'),
    coalesce(boards_with_slug::text, 'no column');

  -- No REVOKE first: REVOKE has no IF EXISTS, and the grants go with the
  -- function
  DROP FUNCTION IF EXISTS public.get_public_board(text);

  ALTER TABLE public.board
    DROP COLUMN IF EXISTS share_slug,
    DROP COLUMN IF EXISTS is_public;

  -- Check the result
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'board'
      AND column_name IN ('is_public', 'share_slug')
  ) THEN
    RAISE EXCEPTION 'remove_public_board: board.is_public or board.share_slug still exists'
      USING DETAIL = 'Nothing was changed (one transaction), and this migration is not recorded as applied. Change this migration file in a new commit on main so it handles what still uses it, run pnpm db:reset, and push again; a later migration cannot run before this one.';
  END IF;

  IF to_regprocedure('public.get_public_board(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'remove_public_board: get_public_board(text) still exists'
      USING DETAIL = 'Nothing was changed (one transaction), and this migration is not recorded as applied. Change this migration file in a new commit on main so it handles what still uses it, run pnpm db:reset, and push again; a later migration cannot run before this one.';
  END IF;

  -- strpos, not ILIKE: "_" is a one-character wildcard in a LIKE pattern
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (strpos(p.prosrc, 'is_public') > 0 OR strpos(p.prosrc, 'share_slug') > 0)
  ) THEN
    RAISE EXCEPTION 'remove_public_board: a function in schema public still names is_public or share_slug'
      USING DETAIL = 'Nothing was changed (one transaction), and this migration is not recorded as applied. Change this migration file in a new commit on main so it handles what still uses it, run pnpm db:reset, and push again; a later migration cannot run before this one.';
  END IF;
END
$migration$;
