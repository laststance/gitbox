-- ============================================================================
-- Create A Board With Its Columns In One Transaction (Issue #213)
-- ============================================================================
--
-- createBoard inserted the board and then, in a second request, its columns.
-- When the second request failed the user got an error and kept a board
-- without columns, and trying again made a second board. This function does
-- both writes in one transaction: the board exists with all of its columns,
-- or nothing was written.
--
-- Callers: createBoard (src/lib/actions/board.ts) and createFirstBoardIfNeeded
-- (src/lib/actions/board-creation.ts), both through createBoardFromPreset.
--
-- What it does:
--   p_columns is a JSON array of {"name": text, "color": "#RRGGBB"}. The array
--   order is the column order: element i (from 0) becomes a column with
--   "order" i, grid_row 0 and grid_col i. The board page places a column by
--   grid_row and grid_col, so leaving them at their default of 0 would put
--   every column into the same cell.
--   The board goes after the caller's last board (position). A position at
--   the top of the integer range is repeated instead of exceeded, so a board
--   that sits there cannot make the call fail.
--   Returns {"id", "name", "status_lists": [{"id", "name", "color"}]}, the
--   columns in their order.
--
-- SECURITY INVOKER: the rows are written with the caller's rights, so the
-- policies on board and statuslist decide as they do for a direct insert.
-- The API exposes the function without the server action in front of it, so
-- it checks its own input. The limits are those of src/lib/validations/board.ts
-- and src/lib/constants/regex.ts, named next to each check; change both sides
-- together. One call takes at most 100 columns, so it cannot write any number
-- of rows; the app has no such limit of its own and its largest preset has 5.
--
-- This file sorts before 20261012090000_remove_maintenance_mode on purpose:
-- when that migration refuses to run, this function is already applied and
-- boards can still be created.
--
-- One statement (a DO block), so the function and its rights arrive together,
-- and re-runnable.
--
-- Rollback (new migration):
--   DROP FUNCTION public.create_board_with_status_lists(text, jsonb);
-- ============================================================================

DO $migration$
BEGIN
  CREATE OR REPLACE FUNCTION public.create_board_with_status_lists(
    p_name text,
    p_columns jsonb
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE
    v_user_id uuid := auth.uid();
    v_name text := btrim(p_name);
    v_invalid_columns integer;
    v_board_id uuid;
  BEGIN
    -- Every check runs before the first write.
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'create_board_with_status_lists: the caller is not signed in'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- BOARD_NAME_MAX_LENGTH (a NULL name counts as empty)
    IF COALESCE(char_length(v_name), 0) NOT BETWEEN 1 AND 50 THEN
      RAISE EXCEPTION 'create_board_with_status_lists: the board name must have 1 to 50 characters'
        USING ERRCODE = 'check_violation';
    END IF;

    -- A board without columns is what this function exists to prevent, and
    -- the upper limit bounds what one call writes. CASE, not OR: the length is
    -- asked of an array only, whatever order the conditions are evaluated in.
    -- NULL and every other JSON type fall through to the refusal.
    IF NOT COALESCE(
      CASE WHEN jsonb_typeof(p_columns) = 'array'
        THEN jsonb_array_length(p_columns) BETWEEN 1 AND 100
      END,
      false
    ) THEN
      RAISE EXCEPTION 'create_board_with_status_lists: p_columns must be an array of 1 to 100 columns'
        USING ERRCODE = 'check_violation';
    END IF;

    -- STATUS_LIST_NAME_MAX_LENGTH and HEX_COLOR_CODE. A missing key reads as
    -- NULL, which COALESCE turns into a value that fails the check.
    SELECT count(*) INTO v_invalid_columns
    FROM jsonb_array_elements(p_columns) AS column_spec(value)
    WHERE jsonb_typeof(column_spec.value) <> 'object'
      OR COALESCE(char_length(btrim(column_spec.value->>'name')), 0) NOT BETWEEN 1 AND 50
      OR COALESCE(column_spec.value->>'color', '') !~ '^#[0-9A-Fa-f]{6}$';

    IF v_invalid_columns > 0 THEN
      RAISE EXCEPTION 'create_board_with_status_lists: % column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
        v_invalid_columns
        USING ERRCODE = 'check_violation';
    END IF;

    -- After the caller's last board. Added as bigint and capped at the top of
    -- the integer range: a board that sits there must not make the sum
    -- overflow, and two boards may share a position.
    INSERT INTO board (user_id, name, position)
    VALUES (
      v_user_id,
      v_name,
      (
        SELECT LEAST(COALESCE(MAX(position), -1)::bigint + 1, 2147483647)::integer
        FROM board
        WHERE user_id = v_user_id
      )
    )
    RETURNING id INTO v_board_id;

    -- WITH ORDINALITY numbers the elements from 1 in array order
    INSERT INTO statuslist (board_id, name, color, "order", grid_row, grid_col)
    SELECT
      v_board_id,
      btrim(column_spec.value->>'name'),
      column_spec.value->>'color',
      (column_spec.array_position - 1)::integer,
      0,
      (column_spec.array_position - 1)::integer
    FROM jsonb_array_elements(p_columns)
      WITH ORDINALITY AS column_spec(value, array_position);

    RETURN jsonb_build_object(
      'id', v_board_id,
      'name', v_name,
      'status_lists', (
        SELECT jsonb_agg(
          jsonb_build_object('id', s.id, 'name', s.name, 'color', s.color)
          ORDER BY s."order"
        )
        FROM statuslist s
        WHERE s.board_id = v_board_id
      )
    );
  END;
  $function$;

  -- Functions are executable by PUBLIC by default; name the one role instead.
  -- anon is revoked by name because Supabase grants it rights on new
  -- functions of this schema through default privileges.
  REVOKE ALL ON FUNCTION public.create_board_with_status_lists(text, jsonb)
    FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.create_board_with_status_lists(text, jsonb)
    TO authenticated;
END
$migration$;
