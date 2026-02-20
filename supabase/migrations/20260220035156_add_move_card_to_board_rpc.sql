-- Move Card to Another Board RPC
-- Issue #133: Atomically transfers a repocard to a different board/status
-- Uses SECURITY INVOKER to respect existing RLS policies
-- projectinfo FK is preserved automatically (card ID unchanged)

CREATE OR REPLACE FUNCTION move_card_to_board(
  p_card_id UUID,
  p_target_board_id UUID,
  p_target_status_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_next_order INTEGER;
BEGIN
  -- Validate that the target status belongs to the target board
  IF NOT EXISTS (
    SELECT 1 FROM statuslist
    WHERE id = p_target_status_id AND board_id = p_target_board_id
  ) THEN
    RAISE EXCEPTION 'status % does not belong to board %', p_target_status_id, p_target_board_id;
  END IF;

  -- Calculate next order position in target status column (atomic)
  SELECT COALESCE(MAX("order"), -1) + 1 INTO v_next_order
  FROM repocard WHERE status_id = p_target_status_id;

  -- Move the card to the target board and status
  UPDATE repocard
  SET board_id = p_target_board_id,
      status_id = p_target_status_id,
      "order" = v_next_order,
      updated_at = now()
  WHERE id = p_card_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'repocard % not found', p_card_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION move_card_to_board(UUID, UUID, UUID) TO authenticated;
