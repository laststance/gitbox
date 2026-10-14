-- ============================================================================
-- Remove Maintenance Mode (Issue #213)
-- ============================================================================
--
-- Maintenance Mode was a second place to keep a repository: its own table,
-- its own foreign key on projectinfo and two functions to move a repository
-- in and out. A board does the same job, so the feature is removed.
--
-- What this does, per user who has entries:
--   - a new board named "Maintenance" after the user's last board, with one
--     column "Repositories"
--   - one card per entry on that board. The card keeps the entry's id,
--     repository and timestamps, so the projectinfo row of an entry (note,
--     links, comment) simply continues on the card with the same id
-- Then projectinfo.maintenance_id, the two functions and the table are
-- dropped, and projectinfo.repo_card_id is NOT NULL again.
--
-- What this never does: drop an entry or a note. It refuses to run, and
-- changes nothing, while
--   - row level security would hide rows from this session (the counts below
--     would read 0 and the table would be dropped with its rows)
--   - an entry's repository is already on a board of the same user
--   - two entries of one user differ only in letter case
--   - an entry's id is already the id of a card
--   - projectinfo has any policy set other than the two the migrations define
-- Messages carry counts only: no repository name and no user id (the job log
-- of a public repository). What to do next is written into DETAIL, not HINT:
-- the Supabase CLI prints the message and its DETAIL and leaves the HINT out.
-- The queries that list the conflicts and resolve them are in
-- docs/plans/2026-10-12-issue-213-rollout-runbook.md (section 7) and are run
-- by hand. A conflict is resolved by deleting the entry, never a card: a card
-- that has the id of an entry can belong to another user. Deleting an entry
-- deletes its note with it, so the note is copied into the card first.
--
-- The whole body is ONE statement (a DO block), so it is atomic no matter how
-- the CLI wraps the file. A second run after success finds no table and
-- returns at once.
--
-- No reverse migration: the code that read the table is gone. A wrong result
-- is repaired forward from the data dump and the manifest taken before the
-- run (see the runbook).
-- ============================================================================

DO $migration$
DECLARE
  v_entries integer;
  v_entries_on_a_board integer;
  v_case_variant_groups integer;
  v_entries_sharing_a_card_id integer;
  v_policies integer;
  v_known_policies integer;
  v_owner record;
  v_board_id uuid;
  v_status_id uuid;
  v_boards_created integer := 0;
  v_cards_created integer := 0;
  v_cards_of_owner integer;
  v_projectinfo_repointed integer;
  v_entries_without_a_card integer;
BEGIN
  -- 0. Second run: the table is gone, so everything below already happened.
  IF to_regclass('public.maintenance') IS NULL THEN
    RAISE NOTICE 'remove_maintenance_mode: table maintenance does not exist, nothing to do.';
    RETURN;
  END IF;

  -- 1. Take the locks before the guard, so the guard and the writes see the
  --    same rows. Fail fast instead of queueing behind a long transaction;
  --    the job can simply be run again.
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE maintenance, projectinfo, repocard IN ACCESS EXCLUSIVE MODE;

  -- 2. Guard. Everything is checked before the first write.
  --    A session that row level security applies to would count 0 entries
  --    here and then drop the table with all of them in it.
  IF row_security_active('public.maintenance')
    OR row_security_active('public.projectinfo')
    OR row_security_active('public.repocard')
    OR row_security_active('public.board')
    OR row_security_active('public.statuslist')
  THEN
    RAISE EXCEPTION
      'remove_maintenance_mode: row level security applies to this session, so it cannot see every row it has to move.'
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

  -- Step 6 drops and recreates the policies of projectinfo. A policy this
  -- repository does not define is never dropped: refuse instead.
  IF v_policies <> 2 OR v_known_policies <> 2 THEN
    RAISE EXCEPTION
      'remove_maintenance_mode: projectinfo has % row level security policy(ies), % of them defined by the migrations; expected exactly those 2.',
      v_policies, v_known_policies
      USING DETAIL = 'Nothing was changed. Compare the policies of projectinfo with supabase/migrations (supabase db dump --linked --schema public), make them equal, then run the migration again.';
  END IF;

  SELECT count(*) INTO v_entries FROM maintenance;

  -- lower() on both sides: the key of repocard_unique_repo_per_user
  SELECT count(*) INTO v_entries_on_a_board
  FROM maintenance m
  JOIN repocard r
    ON r.user_id = m.user_id
    AND lower(r.repo_owner) = lower(m.repo_owner)
    AND lower(r.repo_name) = lower(m.repo_name);

  SELECT count(*) INTO v_case_variant_groups
  FROM (
    SELECT 1
    FROM maintenance
    GROUP BY user_id, lower(repo_owner), lower(repo_name)
    HAVING count(*) > 1
  ) case_variant_groups;

  -- Step 3 gives each card the id of its entry
  SELECT count(*) INTO v_entries_sharing_a_card_id
  FROM maintenance m
  JOIN repocard r ON r.id = m.id;

  IF v_entries_on_a_board > 0
    OR v_case_variant_groups > 0
    OR v_entries_sharing_a_card_id > 0
  THEN
    RAISE EXCEPTION
      'remove_maintenance_mode: % entry(ies) whose repository is already on a board of the same user, % group(s) of entries that differ only in letter case, % entry(ies) whose id is already the id of a card.',
      v_entries_on_a_board, v_case_variant_groups, v_entries_sharing_a_card_id
      USING DETAIL = 'Nothing was changed. Resolve each conflict by deleting the entry, never a card: a card that has the id of an entry can belong to another user. Deleting an entry deletes its note, so copy the note into the card first. Of a group of entries that differ only in letter case, keep one. Then run the migration again (production: gh workflow run supabase-production.yml; a local database: pnpm db:reset). The queries that list the conflicts, print the note of an entry and delete an entry are in docs/plans/2026-10-12-issue-213-rollout-runbook.md, section 7.';
  END IF;

  -- 3. One board, one column and the cards for each user who has entries.
  --    Board and column come first: the card triggers set_repocard_user_id
  --    and check_repocard_status_board read them.
  FOR v_owner IN
    SELECT DISTINCT user_id FROM maintenance ORDER BY user_id
  LOOP
    -- After the user's last board. Board names are not unique, so a user who
    -- already has a board with this name gets a second one. The position is
    -- added as bigint and capped at the top of the integer range: one board
    -- that sits there must not abort the migration for every user.
    INSERT INTO board (user_id, name, position)
    VALUES (
      v_owner.user_id,
      'Maintenance',
      (
        SELECT LEAST(COALESCE(MAX(position), -1)::bigint + 1, 2147483647)::integer
        FROM board
        WHERE user_id = v_owner.user_id
      )
    )
    RETURNING id INTO v_board_id;

    -- The color is left to the column default
    INSERT INTO statuslist (board_id, name, "order", grid_row, grid_col)
    VALUES (v_board_id, 'Repositories', 0, 0, 0)
    RETURNING id INTO v_status_id;

    -- meta is empty, as it was for a card restored from Maintenance. The
    -- order is the one the Maintenance page showed: newest change first.
    -- update_repocard_updated_at fires on UPDATE only, so the timestamps
    -- arrive as they are.
    INSERT INTO repocard (
      id, board_id, status_id, user_id, repo_owner, repo_name,
      "order", meta, created_at, updated_at
    )
    SELECT
      m.id, v_board_id, v_status_id, m.user_id, m.repo_owner, m.repo_name,
      (row_number() OVER (ORDER BY m.updated_at DESC NULLS LAST, m.id) - 1)::integer,
      '{}'::jsonb, m.created_at, m.updated_at
    FROM maintenance m
    WHERE m.user_id = v_owner.user_id;

    GET DIAGNOSTICS v_cards_of_owner = ROW_COUNT;
    v_cards_created := v_cards_created + v_cards_of_owner;
    v_boards_created := v_boards_created + 1;
  END LOOP;

  -- 4. Hand each projectinfo row from its entry to the card with the same id.
  --    Both columns change in one statement, so the exclusive CHECK holds.
  --    The trigger is off for this statement only: the notes were not edited,
  --    and updated_at must not say they were.
  ALTER TABLE projectinfo DISABLE TRIGGER update_projectinfo_updated_at;

  UPDATE projectinfo
  SET repo_card_id = maintenance_id,
      maintenance_id = NULL
  WHERE maintenance_id IS NOT NULL;

  GET DIAGNOSTICS v_projectinfo_repointed = ROW_COUNT;

  ALTER TABLE projectinfo ENABLE TRIGGER update_projectinfo_updated_at;

  -- Before anything is dropped: every entry is a card with its id and
  -- repository, and no projectinfo row is left behind on an entry.
  SELECT count(*) INTO v_entries_without_a_card
  FROM maintenance m
  WHERE NOT EXISTS (
    SELECT 1
    FROM repocard r
    WHERE r.id = m.id
      AND r.user_id = m.user_id
      AND r.repo_owner = m.repo_owner
      AND r.repo_name = m.repo_name
  );

  IF v_cards_created <> v_entries
    OR v_entries_without_a_card > 0
    OR EXISTS (SELECT 1 FROM projectinfo WHERE maintenance_id IS NOT NULL)
  THEN
    RAISE EXCEPTION
      'remove_maintenance_mode: % of % entry(ies) became a card and % entry(ies) have no card; the move is incomplete.',
      v_cards_created, v_entries, v_entries_without_a_card
      USING DETAIL = 'Nothing was changed. This is a defect of the migration, not of the data: fix the migration file and run it again.';
  END IF;

  -- 5. The functions that moved a repository in and out
  DROP FUNCTION IF EXISTS move_to_maintenance(uuid, uuid, text, text);
  DROP FUNCTION IF EXISTS restore_to_board(uuid, uuid, uuid, text, text, integer);

  -- 6. projectinfo belongs to a card again, and only to a card. The policies
  --    go first because they name the column and the table that are dropped.
  DROP POLICY "Users can view their project info" ON projectinfo;
  DROP POLICY "Users can manage their project info" ON projectinfo;

  ALTER TABLE projectinfo DROP CONSTRAINT projectinfo_target_exclusive_check;
  -- Takes projectinfo_maintenance_id_key, the foreign key and
  -- idx_projectinfo_maintenance_id with it
  ALTER TABLE projectinfo DROP COLUMN maintenance_id;
  ALTER TABLE projectinfo ALTER COLUMN repo_card_id SET NOT NULL;

  -- The card path of 20260208_reenable_rls_optimized_policies.sql, unchanged
  CREATE POLICY "Users can view their project info"
    ON projectinfo FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM repocard
        JOIN board ON board.id = repocard.board_id
        WHERE repocard.id = projectinfo.repo_card_id
        AND board.user_id = (select auth.uid())
      )
    );

  CREATE POLICY "Users can manage their project info"
    ON projectinfo FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM repocard
        JOIN board ON board.id = repocard.board_id
        WHERE repocard.id = projectinfo.repo_card_id
        AND board.user_id = (select auth.uid())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM repocard
        JOIN board ON board.id = repocard.board_id
        WHERE repocard.id = projectinfo.repo_card_id
        AND board.user_id = (select auth.uid())
      )
    );

  -- 7. The table, with its policies, trigger and index
  DROP TABLE maintenance;

  -- 8. A convenience for whoever reads the log; the manifest is the record.
  RAISE NOTICE
    'remove_maintenance_mode: moved % entry(ies) onto % new board(s) and re-pointed % projectinfo row(s).',
    v_cards_created, v_boards_created, v_projectinfo_repointed;
END
$migration$;
