-- Validate the slash checks outside the migration that added them.
--
-- Adding a check and scanning every row in one transaction holds the lock
-- that blocks writes for the whole scan. NOT VALID already refuses a new
-- owner or name that contains a slash. This scan allows reads and writes.
-- The migration that added the checks counted the rows and refused to run
-- when any of them contained a slash, so this scan accepts the rows that
-- are already stored.

ALTER TABLE public.repocard
  VALIDATE CONSTRAINT repocard_owner_name_no_slash;

ALTER TABLE public.projectinfo
  VALIDATE CONSTRAINT projectinfo_owner_name_no_slash;
