-- Transaction-safe RPC functions for multi-step DB operations
-- Issue #61: Replaces fragile manual rollback with PostgreSQL implicit transactions
-- All functions use SECURITY INVOKER to respect existing RLS policies

-- ============================================================================
-- 1. move_to_maintenance: Atomically move a repocard to maintenance archive
--    Replaces: 3-step insert→update→delete with manual rollback in repo-cards.ts
-- ============================================================================
CREATE OR REPLACE FUNCTION move_to_maintenance(
  p_card_id UUID,
  p_user_id UUID,
  p_repo_owner TEXT,
  p_repo_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_maint_id UUID;
BEGIN
  -- Step 1: Insert maintenance entry
  INSERT INTO maintenance (user_id, repo_owner, repo_name)
  VALUES (p_user_id, p_repo_owner, p_repo_name)
  RETURNING id INTO v_maint_id;

  -- Step 2: Transfer projectinfo FK (single statement satisfies exclusive CHECK)
  -- No-op if no projectinfo exists for this card
  UPDATE projectinfo
  SET maintenance_id = v_maint_id,
      repo_card_id = NULL,
      updated_at = now()
  WHERE repo_card_id = p_card_id;

  -- Step 3: Delete the repocard (guard against TOCTOU race)
  DELETE FROM repocard WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'repocard % not found', p_card_id;
  END IF;

  RETURN v_maint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION move_to_maintenance(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 2. restore_to_board: Atomically restore a maintenance item back to a board
--    Replaces: 3-step insert→update→delete with manual rollback in repo-cards.ts
-- ============================================================================
CREATE OR REPLACE FUNCTION restore_to_board(
  p_maintenance_id UUID,
  p_board_id UUID,
  p_status_id UUID,
  p_repo_owner TEXT,
  p_repo_name TEXT,
  p_next_order INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- Step 1: Insert new repocard
  INSERT INTO repocard (board_id, status_id, repo_owner, repo_name, "order", meta)
  VALUES (p_board_id, p_status_id, p_repo_owner, p_repo_name, p_next_order, '{}'::jsonb)
  RETURNING id INTO v_card_id;

  -- Step 2: Transfer projectinfo FK (single statement satisfies exclusive CHECK)
  -- No-op if no projectinfo exists for this maintenance item
  UPDATE projectinfo
  SET repo_card_id = v_card_id,
      maintenance_id = NULL,
      updated_at = now()
  WHERE maintenance_id = p_maintenance_id;

  -- Step 3: Delete from maintenance (guard against TOCTOU race)
  DELETE FROM maintenance WHERE id = p_maintenance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'maintenance record % not found', p_maintenance_id;
  END IF;

  RETURN v_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_to_board(UUID, UUID, UUID, TEXT, TEXT, INT) TO authenticated;

-- ============================================================================
-- 3. batch_update_statuslist_positions: Atomic batch update for column positions
--    Replaces: Promise.all N individual updates in board.ts
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
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE statuslist
    SET grid_row = (v_item->>'grid_row')::INT,
        grid_col = (v_item->>'grid_col')::INT,
        updated_at = now()
    WHERE id = (v_item->>'id')::UUID;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_statuslist_positions(JSONB) TO authenticated;

-- ============================================================================
-- 4. batch_update_repocard_orders: Atomic batch update for card positions
--    Replaces: Promise.all N individual updates in board.ts
-- ============================================================================
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
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE repocard
    SET status_id = (v_item->>'status_id')::UUID,
        "order" = (v_item->>'order')::INT,
        updated_at = now()
    WHERE id = (v_item->>'id')::UUID;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_repocard_orders(JSONB) TO authenticated;

-- ============================================================================
-- 5. batch_update_board_positions: Atomic batch update for board ordering
--    Replaces: Promise.all N individual updates in board.ts
-- ============================================================================
CREATE OR REPLACE FUNCTION batch_update_board_positions(
  p_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE board
    SET position = (v_item->>'position')::INT,
        updated_at = now()
    WHERE id = (v_item->>'id')::UUID;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_board_positions(JSONB) TO authenticated;
