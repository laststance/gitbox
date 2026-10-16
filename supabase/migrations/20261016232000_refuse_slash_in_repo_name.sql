-- Refuse a slash in a repository owner or name.
--
-- repo_key is lower(owner) || '/' || lower(name). A card is unique on
-- (user_id, lower(owner), lower(name)), so owner "a/b" with name "c" and
-- owner "a" with name "b/c" are two cards and one repo_key. GitHub never
-- puts a slash in either, and the server actions refuse one. A signed-in
-- browser can still write the tables through PostgREST.
--
-- One transaction. It counts the rows it would refuse and raises before the
-- first write, so a refusal changes nothing. The counts are in DETAIL: the
-- CLI prints a failed migration's message and DETAIL, not a NOTICE. A second
-- run returns when both checks already exist. NOT VALID refuses a new row
-- without scanning the ones already stored; the next migration validates.

DO $migration$
DECLARE
  card_slashes bigint;
  info_slashes bigint;
  card_constraint boolean;
  info_constraint boolean;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'repocard_owner_name_no_slash'
      AND conrelid = 'public.repocard'::regclass
  ) INTO card_constraint;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'projectinfo_owner_name_no_slash'
      AND conrelid = 'public.projectinfo'::regclass
  ) INTO info_constraint;

  -- Done before: a second run changes nothing
  IF card_constraint AND info_constraint THEN
    RETURN;
  END IF;

  SELECT count(*) INTO card_slashes
  FROM public.repocard
  WHERE strpos(repo_owner, '/') > 0 OR strpos(repo_name, '/') > 0;

  SELECT count(*) INTO info_slashes
  FROM public.projectinfo
  WHERE strpos(repo_owner, '/') > 0 OR strpos(repo_name, '/') > 0;

  -- A row that cannot be carried stops the migration before any write
  IF card_slashes > 0 OR info_slashes > 0 THEN
    RAISE EXCEPTION 'repo_name_no_slash: a repository name contains a slash'
      USING DETAIL = format(
        'repocard %s, projectinfo %s. Remove the slash from repo_owner and repo_name, then run this migration again. Nothing was changed.',
        card_slashes,
        info_slashes
      );
  END IF;

  IF NOT card_constraint THEN
    ALTER TABLE public.repocard
      ADD CONSTRAINT repocard_owner_name_no_slash
      CHECK (
        strpos(repo_owner, '/') = 0 AND strpos(repo_name, '/') = 0
      ) NOT VALID;
  END IF;

  IF NOT info_constraint THEN
    ALTER TABLE public.projectinfo
      ADD CONSTRAINT projectinfo_owner_name_no_slash
      CHECK (
        strpos(repo_owner, '/') = 0 AND strpos(repo_name, '/') = 0
      ) NOT VALID;
  END IF;
END
$migration$;
