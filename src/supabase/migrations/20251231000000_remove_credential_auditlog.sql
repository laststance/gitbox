-- Remove Credential Storage Feature
-- Reason: Users should use dedicated password managers like 1Password
-- This migration drops Credential and AuditLog tables as they are no longer needed

-- Drop Credential table indexes
DROP INDEX IF EXISTS idx_credential_project_info_id;
DROP INDEX IF EXISTS idx_credential_type;

-- Drop Credential RLS policies
DROP POLICY IF EXISTS "Users can view their credentials" ON credential;
DROP POLICY IF EXISTS "Users can manage their credentials" ON credential;

-- Drop AuditLog indexes
DROP INDEX IF EXISTS idx_auditlog_user_id;
DROP INDEX IF EXISTS idx_auditlog_resource_id;
DROP INDEX IF EXISTS idx_auditlog_created_at;

-- Drop AuditLog RLS policies
DROP POLICY IF EXISTS "Users can view their audit logs" ON auditlog;
DROP POLICY IF EXISTS "Only service role can create audit logs" ON auditlog;
DROP POLICY IF EXISTS "Audit logs are immutable" ON auditlog;
DROP POLICY IF EXISTS "Audit logs cannot be deleted" ON auditlog;

-- Drop tables (CASCADE handles foreign key constraints)
DROP TABLE IF EXISTS credential CASCADE;
DROP TABLE IF EXISTS auditlog CASCADE;
