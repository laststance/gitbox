-- Migration: Remove WIP limit feature
-- Description: WIP limits were removed from the application as they don't fit
-- the repository-level status tracking model (granularity is much larger than task-level tools)

-- Drop the wip_limit column from statuslist table
ALTER TABLE statuslist DROP COLUMN IF EXISTS wip_limit;
