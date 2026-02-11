-- GitBox - Add UNIQUE constraint on projectinfo.maintenance_id
-- Created: 2026-02-12
-- Purpose: Enable Supabase .upsert({ onConflict: 'maintenance_id' })
--
-- repo_card_id already has UNIQUE from the initial schema.
-- maintenance_id only had a regular INDEX. Adding UNIQUE allows both FK
-- columns to be used as upsert conflict targets.
--
-- PostgreSQL allows multiple NULLs in UNIQUE columns by default, so rows
-- where maintenance_id IS NULL are unaffected.

ALTER TABLE projectinfo
ADD CONSTRAINT projectinfo_maintenance_id_key UNIQUE (maintenance_id);
