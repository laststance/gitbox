-- ============================================================================
-- A Column Color Is #RRGGBB (found in the review of Issue #213)
-- ============================================================================
--
-- statuslist.color had no constraint. The app checks the color it writes
-- (statusListColorSchema), but the API takes a write without the app in front
-- of it, and the color is printed into a style attribute. On a shared board
-- (/public/<slug>) the server prints it into the page a visitor loads, so a
-- value such as "red; position: fixed; inset: 0" added CSS declarations of
-- the board owner's choice to that page. The CHECK closes that at the table,
-- for every writer.
--
-- The pattern is HEX_COLOR_CODE (src/lib/constants/regex.ts), the one
-- create_board_with_status_lists checks too; change them together. NULL stays
-- allowed: the column has a default, and the app reads a missing color as
-- that default.
--
-- A column that holds another value gets the column default, a gray. Such a
-- value was never written by the app, and waiting for someone to repair it by
-- hand would leave the page of a shared board open in the meantime. Only the
-- color changes: the column keeps its name, its place and its cards. The
-- number of columns changed is raised as a NOTICE, which the Supabase CLI
-- does not print; the audit before the merge counts them
-- (docs/plans/2026-10-12-issue-213-rollout-runbook.md, section 5). Production
-- held no such column when this was written (2026-10-12, 21 columns).
--
-- This file sorts before 20261012090000_remove_maintenance_mode on purpose:
-- that migration refuses to run while its data has a conflict, and the check
-- must not wait for it.
--
-- One statement (a DO block) that returns early when the constraint exists,
-- so a second run does nothing.
--
-- Rollback (new migration):
--   ALTER TABLE public.statuslist DROP CONSTRAINT statuslist_color_hex;
-- The colors that were replaced are in the data dump taken before the run.
-- ============================================================================

DO $migration$
DECLARE
  v_colors_replaced integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'statuslist_color_hex'
      AND conrelid = 'public.statuslist'::regclass
  ) THEN
    RAISE NOTICE 'statuslist_color_check: the constraint exists, nothing to do.';
    RETURN;
  END IF;

  -- Give up after 5 seconds instead of queueing behind a long transaction.
  -- The lock keeps a write from adding another color between the update and
  -- the constraint.
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE public.statuslist IN SHARE ROW EXCLUSIVE MODE;

  -- A session that row level security applies to would skip rows here. The
  -- constraint below is checked against every row whoever adds it, so such a
  -- run fails as a whole instead of leaving a color behind.
  UPDATE public.statuslist
  SET color = DEFAULT
  WHERE color IS NOT NULL
    AND color !~ '^#[0-9A-Fa-f]{6}$';

  GET DIAGNOSTICS v_colors_replaced = ROW_COUNT;

  ALTER TABLE public.statuslist
    ADD CONSTRAINT statuslist_color_hex
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

  RAISE NOTICE
    'statuslist_color_check: % column(s) had a color that is not #RRGGBB and got the default.',
    v_colors_replaced;
END
$migration$;
