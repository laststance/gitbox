-- GitBox - Drop Stale create_default_board Trigger
-- Created: 2026-02-12
-- Purpose: Remove the auth.users INSERT trigger that auto-creates a board.
--
-- The app-level createFirstBoardIfNeeded() in the OAuth callback is the
-- preferred mechanism: it creates both the board AND its 5 default status
-- lists atomically. The trigger only created a bare board without columns.
--
-- History:
--   20251115 initial_schema.sql — created trigger + function
--   20260204 drop_board_theme.sql — updated function to remove theme param
--   This migration — drops both trigger and function

-- ============================================================================
-- Step 1: Drop the trigger on auth.users
-- ============================================================================

DROP TRIGGER IF EXISTS on_user_created ON auth.users;

-- ============================================================================
-- Step 2: Drop the function (no longer referenced)
-- ============================================================================

DROP FUNCTION IF EXISTS create_default_board();
