-- ============================================================================
-- A Public Board Is Readable By Its Share Slug Only
-- ============================================================================
--
-- Three RLS policies from 20260219100000 let every role, signed in or not,
-- SELECT any board with is_public = true, plus its columns and cards, straight
-- from the tables. Through the REST API that meant:
--   * every public board could be listed without knowing a single share slug
--   * board.user_id and repocard.user_id (the owner's account id) came with
--     every row
-- The share page needs neither: it looks one board up by its slug and shows
-- no owner.
--
-- What this changes:
--   get_public_board(p_slug) - the one way left to read a board that is not
--   yours. Returns a single JSON document for the public board with that
--   share slug: the board's name and subtitle, its columns and its cards,
--   without any user_id. Returns NULL when no public board has the slug.
--   Columns and cards are capped at 1000 each, the row limit the REST API
--   applied to the table reads this replaces.
--   The three "Anyone can view public ..." policies are dropped, so the
--   tables answer their owner only.
--   idx_board_is_public is dropped: it existed for those policies alone. The
--   function finds the board through idx_board_share_slug.
--
-- Rollout: the app code that calls the function ships in the same pull
-- request, and the migration and the app deploy are not atomic. Between the
-- two, /public/<slug> answers "not found" (old app + new database: the tables
-- return nothing; new app + old database: the function is missing). Owners'
-- own boards are not affected. After merging:
--   1. the "Supabase Production Migration" workflow run is green
--   2. the Vercel production deployment of the same commit is Ready
--   3. a shared board link opens signed out
-- Do not roll the app back past this commit while this migration is applied:
-- the old app reads the tables and would show every shared link as missing.
--
-- One statement (a DO block) and re-runnable, like the previous migrations.
-- The block ends with a check of the result and raises when a policy still
-- exposes public boards or anon cannot call the function, which rolls the
-- whole migration back.
--
-- Going back (new migration; it re-opens the listing and the user_id columns
-- described above):
--   1. recreate the three policies from 20260219100000 and
--      idx_board_is_public from 20260220054854; keep the function
--   2. deploy the app version that reads the tables
--   3. DROP FUNCTION get_public_board(text) in a later migration
-- ============================================================================

DO $migration$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  -- SECURITY DEFINER: the caller has no right to read someone else's rows, so
  -- the function reads them with its owner's rights and decides what leaves.
  -- Everything it returns is listed by name; a column added to these tables
  -- later is not public until it is added here. The empty search_path makes
  -- every name resolve to the schema written in front of it.
  CREATE OR REPLACE FUNCTION public.get_public_board(p_slug text)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $function$
    SELECT jsonb_build_object(
      'board', jsonb_build_object(
        'name', b.name,
        'subtitle', b.subtitle
      ),
      'statuslist', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'board_id', s.board_id,
            'name', s.name,
            'color', s.color,
            'order', s."order",
            'grid_row', s.grid_row,
            'grid_col', s.grid_col,
            'created_at', s.created_at,
            'updated_at', s.updated_at
          )
          ORDER BY s.grid_row, s.grid_col
        )
        FROM (
          SELECT *
          FROM public.statuslist
          WHERE board_id = b.id
          ORDER BY grid_row, grid_col
          LIMIT 1000
        ) s
      ), '[]'::jsonb),
      'repocard', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'board_id', c.board_id,
            'status_id', c.status_id,
            'repo_owner', c.repo_owner,
            'repo_name', c.repo_name,
            'order', c."order",
            'meta', c.meta,
            'created_at', c.created_at,
            'updated_at', c.updated_at
          )
          ORDER BY c."order"
        )
        FROM (
          SELECT *
          FROM public.repocard
          WHERE board_id = b.id
          ORDER BY "order"
          LIMIT 1000
        ) c
      ), '[]'::jsonb)
    )
    FROM public.board b
    WHERE b.share_slug = p_slug
      AND b.is_public = true
  $function$;

  -- Functions are executable by PUBLIC by default; name the roles instead.
  REVOKE ALL ON FUNCTION public.get_public_board(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.get_public_board(text)
    TO anon, authenticated, service_role;

  -- From here on the tables answer their owner only.
  DROP POLICY IF EXISTS "Anyone can view public boards" ON public.board;
  DROP POLICY IF EXISTS "Anyone can view public board status lists" ON public.statuslist;
  DROP POLICY IF EXISTS "Anyone can view public board repo cards" ON public.repocard;

  DROP INDEX IF EXISTS public.idx_board_is_public;

  -- Check the result. A policy under another name that still opens public
  -- boards through the tables would leave the listing in place unnoticed.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('board', 'statuslist', 'repocard')
      AND qual ILIKE '%is_public%'
  ) THEN
    RAISE EXCEPTION 'A policy on board, statuslist or repocard still reads is_public; public boards must be readable through get_public_board only';
  END IF;

  -- Without this grant every shared link answers "not found" to visitors.
  IF NOT pg_catalog.has_function_privilege('anon', 'public.get_public_board(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon cannot execute get_public_board';
  END IF;
END
$migration$;
