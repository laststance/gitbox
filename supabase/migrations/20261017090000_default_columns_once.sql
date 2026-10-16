-- ============================================================================
-- Default Columns Once, And One First Board (TODOS.md)
-- ============================================================================
--
-- Two requests could each decide to write the same rows:
--
--   1. getBoardBundle sees a board with no column and createDefaultStatusLists
--      inserts the five default columns. Two tabs that open that board at once
--      both saw none, so the board got ten. ensure_default_status_lists locks
--      the board row first and inserts only while it still has no column.
--      The second request waits, finds the columns, and returns them.
--
--   2. createFirstBoardIfNeeded counted the user's boards and then created
--      "First Board". Two first sign-ins both counted zero. The count now
--      happens in create_first_board_if_needed, after pg_advisory_xact_lock
--      on that user, so the second sign-in finds the board and does nothing.
--
-- The same lock is taken by create_board_with_status_lists before it reads
-- MAX(position). Two boards one user creates at the same moment used to land
-- on the same position. They now take turns. A position at the top of the
-- integer range is still repeated rather than exceeded: the lock does not
-- change that cap.
--
-- create_first_board_if_needed takes the lock and then calls
-- create_board_with_status_lists, which takes it again. A second
-- pg_advisory_xact_lock of the same key in the same transaction returns at
-- once (PostgreSQL 17). The key is 81421301 in both functions; it is not a
-- lock any other function uses.
--
-- No unique index on (board_id, grid_row, grid_col). A column swap writes
-- the two cells one after the other, so the index would fail the swap.
--
-- Both new functions are SECURITY INVOKER and check their own input. The
-- column limits are those of create_board_with_status_lists. Change them
-- together.
--
-- One statement (a DO block), so the functions and their rights arrive
-- together, and re-runnable.
--
-- Rollback (new migration):
--   DROP FUNCTION public.ensure_default_status_lists(uuid, jsonb);
--   DROP FUNCTION public.create_first_board_if_needed(text, jsonb);
--   and put create_board_with_status_lists back without the advisory lock.
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

    -- Same key as create_first_board_if_needed. Held until this transaction
    -- ends, so the position read below cannot race another create.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      81421301,
      pg_catalog.hashtext(v_user_id::text)
    );

    -- After the caller's last board. Added as bigint and capped at the top of
    -- the integer range: a board that sits there must not make the sum
    -- overflow, and two boards may share that one last position.
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

  CREATE OR REPLACE FUNCTION public.create_first_board_if_needed(
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
  BEGIN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'create_first_board_if_needed: the caller is not signed in'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Before the count, so two sign-ins cannot both see zero boards.
    -- Same key as create_board_with_status_lists.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      81421301,
      pg_catalog.hashtext(v_user_id::text)
    );

    -- The caller's own boards: this function runs with their rights.
    IF EXISTS (SELECT 1 FROM board WHERE user_id = v_user_id) THEN
      RETURN NULL;
    END IF;

    -- The lock is already held. The called function takes it again, which
    -- returns at once, then checks the name and the columns and inserts.
    RETURN public.create_board_with_status_lists(p_name, p_columns);
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.ensure_default_status_lists(
    p_board_id uuid,
    p_columns jsonb
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE
    v_user_id uuid := auth.uid();
    v_board_id uuid;
    v_invalid_columns integer;
    v_columns jsonb;
  BEGIN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'ensure_default_status_lists: the caller is not signed in'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Same column checks as create_board_with_status_lists, before the lock,
    -- so a refused call does not wait behind a repair.
    IF NOT COALESCE(
      CASE WHEN jsonb_typeof(p_columns) = 'array'
        THEN jsonb_array_length(p_columns) BETWEEN 1 AND 100
      END,
      false
    ) THEN
      RAISE EXCEPTION 'ensure_default_status_lists: p_columns must be an array of 1 to 100 columns'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*) INTO v_invalid_columns
    FROM jsonb_array_elements(p_columns) AS column_spec(value)
    WHERE jsonb_typeof(column_spec.value) <> 'object'
      OR COALESCE(char_length(btrim(column_spec.value->>'name')), 0) NOT BETWEEN 1 AND 50
      OR COALESCE(column_spec.value->>'color', '') !~ '^#[0-9A-Fa-f]{6}$';

    IF v_invalid_columns > 0 THEN
      RAISE EXCEPTION 'ensure_default_status_lists: % column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
        v_invalid_columns
        USING ERRCODE = 'check_violation';
    END IF;

    -- The board row, not a unique index on the grid. A column swap updates
    -- two cells one after the other and must keep working.
    SELECT owned.id INTO v_board_id
    FROM board AS owned
    WHERE owned.id = p_board_id
      AND owned.user_id = v_user_id
    FOR UPDATE;

    IF v_board_id IS NULL THEN
      RAISE EXCEPTION 'ensure_default_status_lists: board not found'
        USING ERRCODE = 'no_data_found';
    END IF;

    -- Someone else already gave this board its columns while we waited.
    IF EXISTS (SELECT 1 FROM statuslist WHERE board_id = v_board_id) THEN
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
        ORDER BY s.grid_row, s.grid_col, s.id
      )
      INTO v_columns
      FROM statuslist s
      WHERE s.board_id = v_board_id;
      RETURN v_columns;
    END IF;

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
      ORDER BY s.grid_row, s.grid_col, s.id
    )
    INTO v_columns
    FROM statuslist s
    WHERE s.board_id = v_board_id;

    IF v_columns IS NULL THEN
      RAISE EXCEPTION 'ensure_default_status_lists: the board has no column after the write'
        USING ERRCODE = 'data_exception';
    END IF;

    RETURN v_columns;
  END;
  $function$;

  -- Functions are executable by PUBLIC by default. anon is revoked by name
  -- because Supabase grants it rights on new functions of this schema.
  -- create_board_with_status_lists keeps the rights it already has.
  REVOKE ALL ON FUNCTION public.create_first_board_if_needed(text, jsonb)
    FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.create_first_board_if_needed(text, jsonb)
    TO authenticated;

  REVOKE ALL ON FUNCTION public.ensure_default_status_lists(uuid, jsonb)
    FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.ensure_default_status_lists(uuid, jsonb)
    TO authenticated;
END
$migration$;
