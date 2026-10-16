-- ============================================================================
-- A Column Sits in Rows and Columns 0 through 999
-- ============================================================================
--
-- statuslist.grid_row and statuslist.grid_col are integers with no upper
-- bound. The board page builds one drop zone per cell out to the furthest
-- column (useKanbanDnD), so a column at 2147483647 hangs that user's board
-- page until the request times out. The app checks the position it writes
-- (gridPositionSchema, GRID_POSITION_MAX). The API takes a write without the
-- app in front of it, so the table has to refuse it too, the way
-- statuslist_color_hex refuses a color.
--
-- The bound is 0 through 999, the same numbers as GRID_POSITION_MAX in
-- src/lib/constants/grid-position.ts. Change them together. A column is not
-- moved to make it fit: a row outside the range means the migration stops
-- before it writes anything.
--
-- Counted on the local database when this was written (2026-10-17): 9
-- columns, all inside the range, so the count of rows this would refuse was
-- 0. Production is counted again under the lock below. The job log is public,
-- so the message carries the count and nothing else about the rows.
--
-- One statement (a DO block) that returns early when the constraint exists,
-- so a second run does nothing.
--
-- Rollback (new migration):
--   ALTER TABLE public.statuslist DROP CONSTRAINT statuslist_grid_position_bounds;
-- ============================================================================

DO $migration$
DECLARE
  v_out_of_range integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'statuslist_grid_position_bounds'
      AND conrelid = 'public.statuslist'::regclass
  ) THEN
    RAISE NOTICE 'statuslist_grid_position_bounds: the constraint exists, nothing to do.';
    RETURN;
  END IF;

  -- Give up after 5 seconds instead of queueing behind a long transaction.
  -- The lock keeps a write from landing past 999 between the count and the
  -- constraint. The owner of the table bypasses row security unless it is
  -- forced; turning it off here makes the count the same either way.
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('row_security', 'off', true);
  LOCK TABLE public.statuslist IN SHARE ROW EXCLUSIVE MODE;

  SELECT count(*)
  INTO v_out_of_range
  FROM public.statuslist
  WHERE grid_row NOT BETWEEN 0 AND 999
     OR grid_col NOT BETWEEN 0 AND 999;

  IF v_out_of_range > 0 THEN
    RAISE EXCEPTION
      'statuslist_grid_position_bounds: % column(s) sit outside 0..999',
      v_out_of_range
      USING DETAIL = 'Move those columns into rows and columns 0 through 999, then run the migration again. Nothing was written.';
  END IF;

  ALTER TABLE public.statuslist
    ADD CONSTRAINT statuslist_grid_position_bounds
    CHECK (
      grid_row BETWEEN 0 AND 999
      AND grid_col BETWEEN 0 AND 999
    );

  RAISE NOTICE
    'statuslist_grid_position_bounds: % column(s) sit outside 0..999.',
    v_out_of_range;
END
$migration$;
