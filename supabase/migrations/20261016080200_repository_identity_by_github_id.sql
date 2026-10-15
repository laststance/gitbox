-- ============================================================================
-- Repository identity is the GitHub repository id
-- ============================================================================
--
-- owner/name changes when a repository is renamed or transferred, so a second
-- card could be added under the new name. The id GitHub assigns does not.
--
-- What this adds, and nothing else:
--   repocard.github_repo_id     - null until the app has confirmed it with
--                                 the GitHub API. meta.githubId is a value the
--                                 browser sent, so this migration does not
--                                 copy it and no constraint reads it.
--   repocard.github_identity_checked_at
--                               - when confirmation was last tried. A miss is
--                                 remembered so the next batch is not the same
--                                 rows. The app tries again after a day.
--   projectinfo.github_repo_id  - the same id, so the note, links and comment
--                                 follow the repository rather than its name.
--   partial unique indexes      - one card, and one memory, per user and
--                                 confirmed id. Rows still waiting for
--                                 confirmation are not in the index (many
--                                 nulls are allowed). The owner/name indexes
--                                 stay until every row has an id.
--
-- The computed relationship matches on the id when both sides have one, and
-- on owner/name otherwise. A rename therefore keeps the memory once both the
-- card and the memory have been confirmed.
--
-- The whole body is one statement, so a refusal changes nothing. Re-runnable.
-- ============================================================================

DO $migration$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE repocard, projectinfo IN ACCESS EXCLUSIVE MODE;

  ALTER TABLE repocard
    ADD COLUMN IF NOT EXISTS github_repo_id bigint,
    ADD COLUMN IF NOT EXISTS github_identity_checked_at timestamptz;

  ALTER TABLE projectinfo
    ADD COLUMN IF NOT EXISTS github_repo_id bigint;

  -- Confirmed ids only. Unconfirmed rows stay out of the index.
  CREATE UNIQUE INDEX IF NOT EXISTS repocard_unique_github_repo_per_user
    ON repocard (user_id, github_repo_id)
    WHERE github_repo_id IS NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS projectinfo_unique_github_repo_per_user
    ON projectinfo (user_id, github_repo_id)
    WHERE github_repo_id IS NOT NULL;

  -- A memory with an id must be the same card: that id and that owner/name.
  -- A memory without an id may still match the card by owner/name. An id of
  -- a different card is refused, so the relationship cannot hand one card
  -- another repository's memory.
  DROP POLICY IF EXISTS "Users can manage their project info" ON projectinfo;

  CREATE POLICY "Users can manage their project info"
    ON projectinfo FOR ALL
    USING (user_id = (select auth.uid()))
    WITH CHECK (
      user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM repocard r
        WHERE r.user_id = (select auth.uid())
          AND (
            (
              projectinfo.github_repo_id IS NOT NULL
              AND r.github_repo_id = projectinfo.github_repo_id
              AND lower(r.repo_owner) = lower(projectinfo.repo_owner)
              AND lower(r.repo_name) = lower(projectinfo.repo_name)
            )
            OR (
              projectinfo.github_repo_id IS NULL
              AND lower(r.repo_owner) = lower(projectinfo.repo_owner)
              AND lower(r.repo_name) = lower(projectinfo.repo_name)
            )
          )
      )
    );

  -- Same signature as the function it replaces, so the existing grants stand.
  CREATE OR REPLACE FUNCTION public.projectinfo(public.repocard)
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
      AND (
        (
          $1.github_repo_id IS NOT NULL
          AND p.github_repo_id IS NOT NULL
          AND p.github_repo_id = $1.github_repo_id
        )
        OR (
          ($1.github_repo_id IS NULL OR p.github_repo_id IS NULL)
          AND p.repo_key = lower($1.repo_owner) || '/' || lower($1.repo_name)
        )
      )
  $fn$;
END
$migration$;
