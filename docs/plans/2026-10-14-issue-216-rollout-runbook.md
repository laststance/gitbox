# Rollout runbook: issue #216, a repository keeps its note, links and comment

Design: [issue-216-repository-memory.md](../designs/issue-216-repository-memory.md). Migration: `supabase/migrations/20261014130000_projectinfo_belongs_to_repository.sql`.

This is a document. Nothing in it runs in CI or in a test. Every block can be pasted into a bash or zsh shell at the repository root. Each block says what it needs, what it must print and when to stop.

Rules that hold for every block:

- The job log of this repository is public. A command whose output can reach it prints counts, never a repository name or a user id.
- Dumps and manifests hold private repository names and notes. They are written to `~/gitbox-backups/` (directory mode 700, files mode 600) and never committed.
- A command with `--linked` talks to production. Run this first, every time:

```bash
cat supabase/.temp/project-ref   # must print zfcwvzazzzsefbkztsyp; stop otherwise
mkdir -p ~/gitbox-backups && chmod 700 ~/gitbox-backups && umask 077
```

- `supabase --version` prints the version `.github/workflows/supabase-production.yml` pins (2.120.0 when this was written).

## Order: deploy first, then migrate

The new code works on the old schema; the old code does not work on the new one (it reads `projectinfo.repo_card_id`). So the build of the merge goes live before the migration runs, and the migration runs by hand right after:

1. Stop the migration workflow, so the merge does not start it (section 2).
2. Merge. Vercel deploys the new build on the old schema (section 3).
3. Start the workflow by hand once that build is live (section 4).
4. Check the result (section 5) and the app (section 6).

Between steps 2 and 3, about a minute, the new build runs on the old schema:

- Boards, notes and the picker read as before. The picker shows no `Saved: ...` marks.
- Saving a note fails with an error and keeps the typed text as a draft.
- Editing or deleting a comment, or changing its color, fails and the comment goes back to what it was: the typed text is lost.
- Remove from Board, Delete Column and Delete Board still delete the note, links and comment of the repositories they remove (the old foreign key cascades), although their dialogs already say they are kept.

So nothing is edited or removed in that minute. A tab opened before the deploy runs the old browser code: its picker breaks on the new answer of `getUserRepoPlacements`. Reload every open GitBox tab after the deploy.

## 1. Rehearsals (done before the PR)

On 2026-10-14, with Supabase CLI 2.120.0, on a local database at the migration before this one, loaded with production's public data (a data-only dump) and a stub `auth.users` row for each board owner:

- `supabase db dump --linked --schema public` equals the dump of the local database built from the migrations.
- The migration applied with `supabase migration up --local`. The manifest below, before and after, was identical for all 10 rows (id, user, repository key, content hash, `created_at`, `updated_at`).
- Run a second time, it printed its notice and changed nothing.
- Deleting the user in a transaction that was rolled back deleted the user's 10 rows.
- With a third policy on `projectinfo`, and with a row whose card is gone (inserted with triggers off), it refused, printed its message and `DETAIL`, and changed nothing. With the data clean again it ran.

## 2. Right before the merge

Needs: the PR green and approved for merge.

```bash
cat supabase/.temp/project-ref
supabase db query --linked "SELECT
  (SELECT count(*) FROM projectinfo) AS rows,
  (SELECT count(DISTINCT r.user_id) FROM projectinfo p JOIN repocard r ON r.id = p.repo_card_id) AS users_holding_rows,
  (SELECT count(*) FROM projectinfo p WHERE NOT EXISTS (SELECT 1 FROM repocard r WHERE r.id = p.repo_card_id)) AS rows_without_a_card,
  (SELECT count(*) FROM (SELECT 1 FROM projectinfo p JOIN repocard r ON r.id = p.repo_card_id
     GROUP BY r.user_id, lower(r.repo_owner), lower(r.repo_name) HAVING count(*) > 1) d) AS duplicate_keys,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projectinfo') AS policies,
  row_security_active('public.projectinfo') OR row_security_active('public.repocard') AS row_security_applies"
supabase db push --linked --dry-run
```

Expected: `rows_without_a_card` and `duplicate_keys` 0, `policies` 2, `row_security_applies` false, and the dry run lists `20261014130000_projectinfo_belongs_to_repository.sql` and nothing else. These are the conditions the migration checks before its first write. Stop when one differs: the migration would refuse (section 7). Note `rows`. On 2026-10-14: 10 rows, held by 1 user, the owner.

Then the dump and the manifest before:

```bash
STAMP=$(date +%Y%m%d-%H%M); B=~/gitbox-backups
supabase db dump --linked --data-only --schema public --file $B/prod-public-data-before-216-$STAMP.sql
supabase db query --linked --output-format json "SELECT p.id || ',' || r.user_id || ',' ||
       lower(r.repo_owner) || '/' || lower(r.repo_name) || ',' ||
       md5(coalesce(p.note, '') || '|' || coalesce(p.comment, '') || '|' ||
           coalesce(p.comment_color, '') || '|' || coalesce(p.links::text, '')) || ',' ||
       p.created_at || ',' || p.updated_at AS line
FROM projectinfo p JOIN repocard r ON r.id = p.repo_card_id ORDER BY p.id" 2>/dev/null \
  | jq -r '.rows[].line' > $B/prod-manifest-before-216-$STAMP.txt
wc -l < $B/prod-manifest-before-216-$STAMP.txt
ls -l $B/ | grep 216
echo "STAMP=$STAMP"   # sections 5 and 7 start from it
```

Expected: the line count equals `rows` above, the files are `-rw-------`, and the last line prints the `STAMP`. An empty manifest stops the rollout here.

Then stop the workflow:

```bash
gh workflow disable supabase-production.yml --repo laststance/gitbox
gh workflow list --repo laststance/gitbox --all | grep -i "supabase production"
```

Expected: the workflow is listed as `disabled_manually`. Do not merge before it is.

## 3. Merge, and wait for the build

```bash
gh pr merge <number> --repo laststance/gitbox --merge --match-head-commit <head sha>
MERGE_SHA=$(gh pr view <number> --repo laststance/gitbox --json mergeCommit -q .mergeCommit.oid); echo $MERGE_SHA
gh run list --repo laststance/gitbox --workflow supabase-production.yml --limit 3   # no run for MERGE_SHA
vercel ls gitbox --scope laststance --environment production | head -8
```

Wait until the newest production deployment is `Ready` and serves the merge commit (`vercel inspect <url> --scope laststance` names the commit). Stop when a Supabase Production run started for the merge commit: the workflow was not disabled, and the old build met the new schema for the minute of the deploy. Check section 5 at once.

## 4. Run the migration

Right after the build is live:

```bash
gh workflow enable supabase-production.yml --repo laststance/gitbox
gh workflow run supabase-production.yml --repo laststance/gitbox --ref main
sleep 5; RUN=$(gh run list --repo laststance/gitbox --workflow supabase-production.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch $RUN --repo laststance/gitbox --exit-status
```

Expected: the run ends green in about 35 seconds. Its log shows the notice with the number of rows that now belong to a repository, which equals `rows`. A red run changed nothing: section 7.

## 5. After the run

```bash
cat supabase/.temp/project-ref
supabase db query --linked "SELECT
  (SELECT count(*) FROM projectinfo) AS rows,
  (SELECT count(*) FROM projectinfo WHERE user_id IS NULL OR repo_owner IS NULL OR repo_name IS NULL) AS rows_without_key,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projectinfo' AND column_name = 'repo_card_id') AS repo_card_id_columns,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'projectinfo_unique_repo_per_user') AS unique_constraints,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'projectinfo_user_id_fkey' AND confdeltype = 'c') AS cascading_user_fks,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projectinfo') AS policies,
  has_function_privilege('anon', 'public.projectinfo(public.repocard)', 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', 'public.projectinfo(public.repocard)', 'EXECUTE') AS authenticated_can_execute,
  (SELECT count(*) FROM repocard r WHERE EXISTS (SELECT 1 FROM projectinfo p WHERE p.user_id = r.user_id
     AND p.repo_key = lower(r.repo_owner) || '/' || lower(r.repo_name))) AS cards_that_reach_a_row"
```

Expected: `rows` as before, `rows_without_key` 0, `repo_card_id_columns` 0, `unique_constraints` 1, `cascading_user_fks` 1, `policies` 2, `anon_can_execute` false, `authenticated_can_execute` true, and `cards_that_reach_a_row` equal to `rows` (every existing row sits on a card). The proof is the manifest:

```bash
STAMP=   # the value section 2 printed
B=~/gitbox-backups
supabase db query --linked --output-format json "SELECT id || ',' || user_id || ',' || repo_key || ',' ||
       md5(coalesce(note, '') || '|' || coalesce(comment, '') || '|' ||
           coalesce(comment_color, '') || '|' || coalesce(links::text, '')) || ',' ||
       created_at || ',' || updated_at AS line
FROM projectinfo ORDER BY id" 2>/dev/null | jq -r '.rows[].line' > $B/prod-manifest-after-216-$STAMP.txt
diff $B/prod-manifest-before-216-$STAMP.txt $B/prod-manifest-after-216-$STAMP.txt > /dev/null \
  && echo "manifest: identical ($(wc -l < $B/prod-manifest-after-216-$STAMP.txt) rows)" \
  || echo "manifest: DIFFERENT: stop and compare the two files by hand"
```

Expected: `manifest: identical`. A row that differs lost or changed data: section 7.

PostgREST reads the new schema after the run (Supabase reloads its schema cache on a schema change). A board that fails to load in the first seconds after the run is that reload, not a failed migration. When a board still fails a minute later: `supabase db query --linked "NOTIFY pgrst, 'reload schema'"`, then load it again.

## 6. The app, as `ryota-murakami`

Read-only checks on the owner's boards: a board loads with its comments, a note opens with its text and links. Everything that removes or deletes runs on scratch boards made for the check (CLAUDE.md): add repositories that sit on no board, give one a note, two links and a comment, then Remove from Board and add it again, Delete Column and add it again, Delete Board and add it again on another scratch board. The picker shows `Saved: note, 2 links, comment` for it while it sits on no board. Delete the scratch boards afterwards.

The scratch repositories keep their memory after their boards are gone. Delete those rows by their exact keys and report what is left:

```bash
cat supabase/.temp/project-ref
KEYS="'owner/one', 'owner/two'"   # the lowercase keys of the scratch repositories, nothing else
supabase db query --linked "SELECT count(*) AS scratch_rows FROM projectinfo WHERE repo_key IN ($KEYS)
  AND NOT EXISTS (SELECT 1 FROM repocard r WHERE r.user_id = projectinfo.user_id
    AND lower(r.repo_owner) || '/' || lower(r.repo_name) = projectinfo.repo_key)"
supabase db query --linked "DELETE FROM projectinfo WHERE repo_key IN ($KEYS)
  AND NOT EXISTS (SELECT 1 FROM repocard r WHERE r.user_id = projectinfo.user_id
    AND lower(r.repo_owner) || '/' || lower(r.repo_name) = projectinfo.repo_key)"
supabase db query --linked "SELECT count(*) AS rows FROM projectinfo"
```

Expected: the delete removes the number the first query counted, and `rows` is the count of section 5 plus the rows the check made for repositories that are on a board again (usually 0). The `NOT EXISTS` keeps a row whose repository is on a board.

## 7. When something fails

- **The migration refused.** It changed nothing. Its message and `DETAIL` (the CLI prints both) say what to do: a row without a card is deleted after copying anything worth keeping; rows that share a repository are merged into one; extra policies are made equal to the migrations. Then section 4 again. The new build keeps running on the old schema meanwhile, with the limits listed at the top.
- **The new build misbehaves before the migration ran.** `vercel rollback --scope laststance` to the previous production deployment is safe: the schema is still the old one.
- **Something is wrong after the migration ran.** There is no reverse migration and no code rollback: the old build reads `repo_card_id`, which is gone. Fix forward. The dump and the manifest of section 2 hold every row as it was.
