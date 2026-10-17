-- ============================================================================
-- A Position Update That Matches No Row Fails
-- ============================================================================
--
-- batch_update_statuslist_positions and batch_update_repocard_orders update
-- by id and return nothing. A missing row, or a row row-level security hides,
-- updates zero rows and the function still succeeds. The board then keeps the
-- move on screen. The single-row writes in src/lib/actions/board.ts read the
-- returned id and throw; these two raise here so their existing error branch
-- throws too. swap_statuslist_positions already raises when a column is
-- missing.
--
-- One update that matches nothing rolls the whole batch back: the function
-- runs in one transaction, and the exception leaves it.
--
-- CREATE OR REPLACE keeps the signature and the grants. A second run writes
-- the same body.
--
-- Rollback (new migration): restore the previous bodies from
-- 20260212000000_transaction_rpc_functions.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_statuslist_positions(
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item JSONB;
  v_updated INT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE statuslist
    SET grid_row = (v_item->>'grid_row')::INT,
        grid_col = (v_item->>'grid_col')::INT,
        updated_at = now()
    WHERE id = (v_item->>'id')::UUID;

    -- A deleted column, or one this session cannot see, must not look saved.
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'position update matched no row';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION batch_update_repocard_orders(
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item JSONB;
  v_updated INT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE repocard
    SET status_id = (v_item->>'status_id')::UUID,
        "order" = (v_item->>'order')::INT,
        updated_at = now()
    WHERE id = (v_item->>'id')::UUID;

    -- A removed card, or one this session cannot see, must not look saved.
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'position update matched no row';
    END IF;
  END LOOP;
END;
$$;
