-- ============================================================================
-- A repository keeps its note, links and comment (Issue #216)
-- ============================================================================
--
-- projectinfo held the note, the links and the comment of one card and was
-- deleted with it (repo_card_id ... ON DELETE CASCADE). Removing a card,
-- deleting its column or deleting its board lost them, and adding the
-- repository again started empty.
--
-- From here on a projectinfo row belongs to a user and a repository:
--   user_id, repo_owner, repo_name, and repo_key = lower(owner)/lower(name),
--   unique per user. That is the key of repocard_unique_repo_per_user (#215),
--   so a repository has at most one card and at most one row per user.
-- A card reaches its row through the computed relationship projectinfo(repocard)
-- (PostgREST embeds it like a foreign key: repocard(..., projectinfo(...))).
-- Deleting a card no longer touches projectinfo. Deleting the user does.
--
-- Each existing row gets the user and repository of the card it sits on.
-- No row is dropped or changed otherwise; updated_at keeps its value.
--
-- It refuses to run, and changes nothing, while
--   - row level security would hide rows from this session
--   - two rows would get the same key (cannot happen while cards are unique
--     per user, counted anyway)
--   - a row has no card to take its repository from
--   - projectinfo has any policy set other than the two the migrations define
-- Messages carry counts only (the job log of a public repository); what to
-- do next is in DETAIL, which the Supabase CLI prints (it leaves HINT out).
--
-- One statement (a DO block), so it is atomic however the CLI wraps the file.
-- A second run after success finds no repo_card_id column and returns at once.
-- ============================================================================

DO $migration$
DECLARE
  v_rows integer;
  v_rows_without_a_card integer;
  v_duplicate_keys integer;
  v_policies integer;
  v_known_policies integer;
  v_rows_filled integer;
BEGIN
  -- 0. Second run: the card column is gone, so everything below happened.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projectinfo'
      AND column_name = 'repo_card_id'
  ) THEN
    RAISE NOTICE 'projectinfo_belongs_to_repository: projectinfo has no repo_card_id, nothing to do.';
    RETURN;
  END IF;

  -- 1. Locks first, so the guard and the writes see the same rows. Cards may
  --    still be read while this runs; they may not be written.
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE projectinfo IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE repocard IN SHARE ROW EXCLUSIVE MODE;

  -- 2. Guard. Everything is checked before the first write.
  IF row_security_active('public.projectinfo')
    OR row_security_active('public.repocard')
  THEN
    RAISE EXCEPTION
      'projectinfo_belongs_to_repository: row level security applies to this session, so it cannot see every row it has to fill.'
      USING DETAIL = 'Nothing was changed. Run the migration as the owner of the tables (the role supabase db push uses).';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE policyname IN (
      'Users can view their project info',
      'Users can manage their project info'
    ))
  INTO v_policies, v_known_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'projectinfo';

  IF v_policies <> 2 OR v_known_policies <> 2 THEN
    RAISE EXCEPTION
      'projectinfo_belongs_to_repository: projectinfo has % row level security policy(ies), % of them defined by the migrations; expected exactly those 2.',
      v_policies, v_known_policies
      USING DETAIL = 'Nothing was changed. Compare the policies of projectinfo with supabase/migrations (supabase db dump --linked --schema public), make them equal, then run the migration again.';
  END IF;

  SELECT count(*) INTO v_rows FROM projectinfo;

  SELECT count(*) INTO v_rows_without_a_card
  FROM projectinfo p
  WHERE NOT EXISTS (SELECT 1 FROM repocard r WHERE r.id = p.repo_card_id);

  SELECT count(*) INTO v_duplicate_keys
  FROM (
    SELECT 1
    FROM projectinfo p
    JOIN repocard r ON r.id = p.repo_card_id
    GROUP BY r.user_id, lower(r.repo_owner), lower(r.repo_name)
    HAVING count(*) > 1
  ) duplicate_keys;

  IF v_rows_without_a_card > 0 OR v_duplicate_keys > 0 THEN
    RAISE EXCEPTION
      'projectinfo_belongs_to_repository: % of % row(s) have no card, % repository key(s) are held by more than one row.',
      v_rows_without_a_card, v_rows, v_duplicate_keys
      USING DETAIL = 'Nothing was changed. A row without a card cannot be given a repository: delete it after copying anything worth keeping. Of rows that share a repository, merge their note, links and comment into one and delete the others. Then run the migration again (production: gh workflow run supabase-production.yml; a local database: pnpm db:reset).';
  END IF;

  -- 3. The new columns, filled from the card each row sits on. Nullable at
  --    first: a default of auth.uid() would be NULL in this session.
  ALTER TABLE projectinfo
    ADD COLUMN user_id uuid,
    ADD COLUMN repo_owner text,
    ADD COLUMN repo_name text;

  -- The trigger is off for this statement only: the notes were not edited,
  -- and updated_at must not say they were.
  ALTER TABLE projectinfo DISABLE TRIGGER update_projectinfo_updated_at;

  UPDATE projectinfo p
  SET user_id = r.user_id,
      repo_owner = r.repo_owner,
      repo_name = r.repo_name
  FROM repocard r
  WHERE r.id = p.repo_card_id;

  GET DIAGNOSTICS v_rows_filled = ROW_COUNT;

  ALTER TABLE projectinfo ENABLE TRIGGER update_projectinfo_updated_at;

  IF v_rows_filled <> v_rows THEN
    RAISE EXCEPTION
      'projectinfo_belongs_to_repository: % of % row(s) got a repository.',
      v_rows_filled, v_rows
      USING DETAIL = 'Nothing was changed. This is a defect of the migration, not of the data: fix the migration file and run it again.';
  END IF;

  -- user_id defaults to the signed-in user, so the app never sends it. A row
  -- goes with its user.
  ALTER TABLE projectinfo
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN user_id SET DEFAULT auth.uid(),
    ALTER COLUMN repo_owner SET NOT NULL,
    ALTER COLUMN repo_name SET NOT NULL,
    ADD CONSTRAINT projectinfo_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- A plain column carries the key, so PostgREST can upsert on it
  -- (on_conflict=user_id,repo_key): on_conflict cannot name an expression.
  ALTER TABLE projectinfo
    ADD COLUMN repo_key text
      GENERATED ALWAYS AS (lower(repo_owner) || '/' || lower(repo_name)) STORED;

  ALTER TABLE projectinfo
    ADD CONSTRAINT projectinfo_unique_repo_per_user UNIQUE (user_id, repo_key);

  -- 4. Policies. They name repo_card_id, so they go before the column.
  DROP POLICY "Users can view their project info" ON projectinfo;
  DROP POLICY "Users can manage their project info" ON projectinfo;

  -- Takes projectinfo_repo_card_id_key, projectinfo_repo_card_id_fkey and
  -- idx_projectinfo_repo_card_id with it
  ALTER TABLE projectinfo DROP COLUMN repo_card_id;

  -- A user reads their own rows. A row is written only for a repository that
  -- has a card of the user, which is the only way the app writes one: a
  -- signed-in browser cannot store notes for repositories it never placed.
  CREATE POLICY "Users can view their project info"
    ON projectinfo FOR SELECT
    USING (user_id = (select auth.uid()));

  CREATE POLICY "Users can manage their project info"
    ON projectinfo FOR ALL
    USING (user_id = (select auth.uid()))
    WITH CHECK (
      user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM repocard r
        WHERE r.user_id = (select auth.uid())
          AND lower(r.repo_owner) = lower(projectinfo.repo_owner)
          AND lower(r.repo_name) = lower(projectinfo.repo_name)
      )
    );

  -- 5. The computed relationship. Named like the table on purpose: the
  --    foreign key it replaces is gone in this same transaction, so the name
  --    is never ambiguous, and the embed string the app already sends
  --    (repocard(..., projectinfo(comment, comment_color))) keeps working.
  --    ROWS 1 tells PostgREST it is to-one (an object or null, not an array);
  --    projectinfo_unique_repo_per_user makes it return 0 or 1 row, never more.
  --    The pinned search_path keeps Postgres from inlining it (about 0.15 ms
  --    per card, measured on 2026-10-14): the convention of the repository's
  --    other functions wins over those 2 ms on a board of 25 cards.
  CREATE FUNCTION public.projectinfo(public.repocard)
    RETURNS SETOF public.projectinfo
    ROWS 1
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    SET search_path = pg_catalog, public
  AS $fn$
    SELECT p.*
    FROM public.projectinfo p
    WHERE p.user_id = $1.user_id
      AND p.repo_key = lower($1.repo_owner) || '/' || lower($1.repo_name)
  $fn$;

  -- PostgREST also serves it at /rpc/projectinfo: visitors have no use for it
  REVOKE ALL ON FUNCTION public.projectinfo(public.repocard) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.projectinfo(public.repocard) TO authenticated, service_role;

  RAISE NOTICE
    'projectinfo_belongs_to_repository: % row(s) now belong to the repository of their card.',
    v_rows_filled;
END
$migration$;
