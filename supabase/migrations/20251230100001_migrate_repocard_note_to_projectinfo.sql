-- Migrate note data from repocard to projectinfo
-- Phase 1.2: Data migration - preserves all existing rich text notes
-- Issue: https://github.com/laststance/gitbox/issues/20

-- Copy note content from repocard to corresponding projectinfo
-- Only update where repocard has a note and projectinfo exists
UPDATE projectinfo
SET note = repocard.note,
    updated_at = now()
FROM repocard
WHERE projectinfo.repo_card_id = repocard.id
  AND repocard.note IS NOT NULL
  AND repocard.note != '';

-- Log migration result (informational)
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM projectinfo
  WHERE note IS NOT NULL AND note != '';

  RAISE NOTICE 'Migrated % note(s) from repocard to projectinfo', migrated_count;
END $$;
