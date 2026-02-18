-- Atomic position swap for two status lists
-- P1-6: Replaces non-atomic client-side swap with a single transaction
-- SECURITY INVOKER respects RLS policies (user must own both status lists)

CREATE OR REPLACE FUNCTION swap_statuslist_positions(
  id_a UUID,
  id_b UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  row_a INT;
  col_a INT;
  row_b INT;
  col_b INT;
BEGIN
  -- Lock in deterministic order to prevent deadlocks
  IF id_a < id_b THEN
    SELECT grid_row, grid_col INTO row_a, col_a
      FROM statuslist WHERE id = id_a FOR UPDATE;
    SELECT grid_row, grid_col INTO row_b, col_b
      FROM statuslist WHERE id = id_b FOR UPDATE;
  ELSE
    SELECT grid_row, grid_col INTO row_b, col_b
      FROM statuslist WHERE id = id_b FOR UPDATE;
    SELECT grid_row, grid_col INTO row_a, col_a
      FROM statuslist WHERE id = id_a FOR UPDATE;
  END IF;

  IF NOT FOUND OR row_a IS NULL OR col_a IS NULL OR row_b IS NULL OR col_b IS NULL THEN
    RAISE EXCEPTION 'One or both status lists not found';
  END IF;

  -- Swap positions in the same transaction
  UPDATE statuslist
    SET grid_row = row_b, grid_col = col_b, updated_at = now()
    WHERE id = id_a;

  UPDATE statuslist
    SET grid_row = row_a, grid_col = col_a, updated_at = now()
    WHERE id = id_b;
END;
$$;

-- Grant execute to authenticated users (RLS enforces ownership)
GRANT EXECUTE ON FUNCTION swap_statuslist_positions(UUID, UUID) TO authenticated;
