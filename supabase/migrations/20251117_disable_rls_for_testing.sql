-- Temporary: Disable RLS for E2E testing
-- Historical note: RLS was re-enabled by 20260208_reenable_rls_optimized_policies.sql

-- Disable RLS on all tables
ALTER TABLE Board DISABLE ROW LEVEL SECURITY;
ALTER TABLE StatusList DISABLE ROW LEVEL SECURITY;
ALTER TABLE RepoCard DISABLE ROW LEVEL SECURITY;
ALTER TABLE ProjectInfo DISABLE ROW LEVEL SECURITY;
ALTER TABLE Maintenance DISABLE ROW LEVEL SECURITY;
