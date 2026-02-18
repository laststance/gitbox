-- GitBox - Drop Board Theme Column Migration
-- Created: 2026-02-04
-- Purpose: Remove theme column from Board table as theme is no longer board-specific
--
-- This migration:
-- 1. Drops the check_theme constraint
-- 2. Updates create_default_board() trigger to not use theme
-- 3. Drops the theme column from Board table

-- ============================================================================
-- Step 1: Drop the theme constraint
-- ============================================================================

ALTER TABLE board DROP CONSTRAINT IF EXISTS check_theme;

-- ============================================================================
-- Step 2: Update create_default_board() trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_board()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.board (user_id, name)
  VALUES (NEW.id, 'My First Board');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Step 3: Drop the theme column
-- ============================================================================

ALTER TABLE board DROP COLUMN IF EXISTS theme;
