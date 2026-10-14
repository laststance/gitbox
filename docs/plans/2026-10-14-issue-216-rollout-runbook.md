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

- `gh` acts as `ryota-murakami`. Another signed-in account may only read the repository, and then disabling the workflow, merging or starting the run fails half-way. Run this in the same shell:

```bash
export GH_TOKEN=$(gh auth token --user ryota-murakami)
gh api repos/laststance/gitbox -q .permissions.push   # must print true; stop otherwise
```

- `supabase --version` prints the version `.github/workflows/supabase-production.yml` pins (2.120.0 when this was written).
- `supabase db query` is run with `--agent no`: in an agent's shell the CLI wraps JSON output in `{ boundary, rows, warning }` by itself, and the `jq` filters below read the plain array.
- Whatever happens, the rollout ends with the migration workflow enabled (section 7, last point).

## Order: deploy first, then migrate

The new code works on the old schema; the old code does not work on the new one (it reads `projectinfo.repo_card_id`). So the build of the merge goes live before the migration runs, and the migration runs by hand right after:

1. Stop the migration workflow, so the merge does not start it (section 2).
2. Merge. Vercel deploys the new build on the old schema (section 3).
3. Dump the data, then start the workflow by hand once that build is live (section 4).
4. Check the result (section 5) and the app (section 6).

Between steps 2 and 3, a few minutes, the new build runs on the old schema:

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
  row_security_active('public.projectinfo') OR row_security_active('public.repocard') AS row_security_applies,
  (SELECT count(*) FROM repocard WHERE position('/' in repo_owner) > 0 OR position('/' in repo_name) > 0) AS names_with_a_slash,
  (SELECT count(*) FROM (SELECT 1 FROM repocard
     GROUP BY user_id, lower(repo_owner) || '/' || lower(repo_name) HAVING count(*) > 1) d) AS repo_key_collisions"
supabase db push --linked --dry-run
```

Expected: `rows_without_a_card` and `duplicate_keys` 0, `policies` 2, `row_security_applies` false, and the dry run lists `20261014130000_projectinfo_belongs_to_repository.sql` and nothing else. These are the conditions the migration checks before its first write. Stop when one differs: the migration would refuse (section 7). Note `rows`. On 2026-10-14: 10 rows, held by 1 user, the owner.

`names_with_a_slash` and `repo_key_collisions` must be 0 too, and the migration does not check them. `repo_key` joins the owner and the name with a `/`, which GitHub never puts in either and the server actions refuse, but a signed-in user can write cards through PostgREST: `a/b` + `c` and `a` + `b/c` are two cards for the card's key and one `repo_key`, and the new unique constraint would fail the run (section 7). On 2026-10-15: 0 and 0 of 50 cards. Section 4 checks again.

Note the deployment that serves production now. It is what `vercel rollback` goes back to (section 7); `vercel rollback` without an argument only prints the status of a rollback:

```bash
PREV_DEPLOYMENT=$(vercel inspect gitbox-laststance.vercel.app --scope laststance 2>&1 | awk '$1 == "id" {print $2}')
echo "PREV_DEPLOYMENT=$PREV_DEPLOYMENT"
```

Expected: a `dpl_...` id. Keep it with the `STAMP` of section 4.

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
gh run list --repo laststance/gitbox --workflow supabase-production.yml --commit $MERGE_SHA
```

Expected: the last command prints nothing. A Supabase Production run for the merge commit means the workflow was not disabled and the old build met the new schema for the minute of the deploy: check section 5 at once.

Then wait for Vercel's build of the merge commit. Vercel reports it to GitHub as a deployment of that commit; `vercel ls --meta githubCommitSha=...` is no gate, as it lists every deployment when none matches (CLI 50.1.6):

```bash
for i in {1..60}; do
  DEPLOYMENT=$(gh api "repos/laststance/gitbox/deployments?sha=$MERGE_SHA&environment=Production" -q '.[0].id')
  STATE=none; [ -n "$DEPLOYMENT" ] && STATE=$(gh api repos/laststance/gitbox/deployments/$DEPLOYMENT/statuses -q '.[0].state')
  echo "$i $STATE"; [ "$STATE" = success ] && break; sleep 10
done
NEW_URL=$(gh api repos/laststance/gitbox/deployments/$DEPLOYMENT/statuses -q '.[0].environment_url'); echo "NEW_URL=$NEW_URL"
if [ "$STATE" = success ] && [ -n "$NEW_URL" ] \
  && vercel inspect gitbox-laststance.vercel.app --scope laststance 2>&1 | grep -qF "$NEW_URL"; then
  echo "GATE PASSED"
else
  echo "GATE FAILED"
fi
```

Expected: `GATE PASSED`: the build of the merge commit succeeded and the production domain serves it. `GATE FAILED` stops the rollout here, also when `NEW_URL` is empty (no deployment was found, so there is nothing to compare). When the state is `failure` or `error`, or the loop ended without `success`, the old build still serves production on the old schema, so nothing is broken; fix the build and start section 3 again with the new merge commit. Do not go on to section 4 without `GATE PASSED`.

## 4. Run the migration

Right after the build is live. The dump and the manifest are taken now, not before the merge: what users do in between (a card removed with the old cascade, a comment edited) would otherwise show as a difference in section 5.

```bash
cat supabase/.temp/project-ref
STAMP=$(date +%Y%m%d-%H%M); B=~/gitbox-backups
supabase db dump --linked --data-only --schema public --file $B/prod-public-data-before-216-$STAMP.sql
supabase db query --linked --agent no --output-format json "SELECT p.id || ',' || r.user_id || ',' ||
       lower(r.repo_owner) || '/' || lower(r.repo_name) || ',' ||
       md5(coalesce(p.note, '') || '|' || coalesce(p.comment, '') || '|' ||
           coalesce(p.comment_color, '') || '|' || coalesce(p.links::text, '')) || ',' ||
       p.created_at || ',' || p.updated_at AS line
FROM projectinfo p JOIN repocard r ON r.id = p.repo_card_id ORDER BY p.id" 2>/dev/null \
  | jq -r '.[].line' > $B/prod-manifest-before-216-$STAMP.txt
wc -l < $B/prod-manifest-before-216-$STAMP.txt
ls -l $B/ | grep 216
echo "STAMP=$STAMP"   # sections 5 and 7 start from it
```

Expected: the line count equals `rows` of section 2 (a row removed since then lowers it), the files are `-rw-------`, and the last line prints the `STAMP`. An empty manifest stops the rollout here.

Check the two keys the migration does not check (section 2) once more, now that the window is short:

```bash
supabase db query --linked "SELECT
  (SELECT count(*) FROM repocard WHERE position('/' in repo_owner) > 0 OR position('/' in repo_name) > 0) AS names_with_a_slash,
  (SELECT count(*) FROM (SELECT 1 FROM repocard
     GROUP BY user_id, lower(repo_owner) || '/' || lower(repo_name) HAVING count(*) > 1) d) AS repo_key_collisions"
```

Expected: 0 and 0. Stop otherwise (section 7).

Then start the run and follow it. The run is picked by its trigger and its start time, not as the newest run, which can be an older one while GitHub has not listed the new one yet:

```bash
gh workflow enable supabase-production.yml --repo laststance/gitbox
T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh workflow run supabase-production.yml --repo laststance/gitbox --ref main
RUN=
for i in {1..12}; do
  RUN=$(gh run list --repo laststance/gitbox --workflow supabase-production.yml --event workflow_dispatch --limit 5 \
    --json databaseId,createdAt -q "[.[] | select(.createdAt >= \"$T0\")][0].databaseId // empty")
  [ -n "$RUN" ] && break; sleep 5
done
echo "RUN=$RUN"
gh run watch $RUN --repo laststance/gitbox --exit-status
```

Expected: `RUN` is a number and the run ends green in about 35 seconds. Its log shows the notice with the number of rows that now belong to a repository, which equals the line count of the manifest. A red run changed nothing: section 7.

## 5. After the run

```bash
cat supabase/.temp/project-ref
supabase db query --linked "SELECT
  (SELECT count(*) FROM projectinfo) AS rows,
  (SELECT count(*) FROM projectinfo WHERE user_id IS NULL OR repo_owner IS NULL OR repo_name IS NULL) AS rows_without_key,
  (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.projectinfo'::regclass AND attname = 'repo_card_id' AND NOT attisdropped) AS repo_card_id_columns,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'projectinfo_unique_repo_per_user') AS unique_constraints,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'projectinfo_user_id_fkey' AND confdeltype = 'c') AS cascading_user_fks,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projectinfo') AS policies,
  has_function_privilege('anon', 'public.projectinfo(public.repocard)', 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', 'public.projectinfo(public.repocard)', 'EXECUTE') AS authenticated_can_execute,
  (SELECT count(*) FROM repocard r WHERE EXISTS (SELECT 1 FROM projectinfo p WHERE p.user_id = r.user_id
     AND p.repo_key = lower(r.repo_owner) || '/' || lower(r.repo_name))) AS cards_that_reach_a_row"
```

Expected: `rows` equal to the line count of the manifest, `rows_without_key` 0, `repo_card_id_columns` 0, `unique_constraints` 1, `cascading_user_fks` 1, `policies` 2, `anon_can_execute` false, `authenticated_can_execute` true, and `cards_that_reach_a_row` equal to `rows` (every existing row sits on a card). The proof is the manifest:

```bash
STAMP=   # the value section 4 printed
B=~/gitbox-backups
supabase db query --linked --agent no --output-format json "SELECT id || ',' || user_id || ',' || repo_key || ',' ||
       md5(coalesce(note, '') || '|' || coalesce(comment, '') || '|' ||
           coalesce(comment_color, '') || '|' || coalesce(links::text, '')) || ',' ||
       created_at || ',' || updated_at AS line
FROM projectinfo ORDER BY id" 2>/dev/null | jq -r '.[].line' > $B/prod-manifest-after-216-$STAMP.txt
diff $B/prod-manifest-before-216-$STAMP.txt $B/prod-manifest-after-216-$STAMP.txt > /dev/null \
  && echo "manifest: identical ($(wc -l < $B/prod-manifest-after-216-$STAMP.txt) rows)" \
  || echo "manifest: DIFFERENT: stop and compare the two files by hand"
```

Expected: `manifest: identical`. A row that differs lost or changed data: section 7. A note saved in the seconds between the manifest and the run shows as a changed `updated_at` and hash of one row; compare the two files by hand before calling it lost.

PostgREST reads the new schema after the run (Supabase reloads its schema cache on a schema change). A board that fails to load in the first seconds after the run is that reload, not a failed migration. When a board still fails a minute later: `supabase db query --linked "NOTIFY pgrst, 'reload schema'"`, then load it again.

## 6. The app, as `ryota-murakami`

Read-only checks on the owner's boards: a board loads with its comments, a note opens with its text and links. Everything that removes or deletes runs on scratch boards made for the check (CLAUDE.md): add repositories that sit on no board, give one a note, two links and a comment, then Remove from Board and add it again, Delete Column and add it again, Delete Board and add it again on another scratch board. The picker shows `Saved: note, 2 links, comment` for it while it sits on no board. Delete the scratch boards afterwards.

Pick the scratch repositories before the check, and make sure none of them holds a memory yet, so the cleanup below deletes only what the check wrote:

```bash
if [ "$(cat supabase/.temp/project-ref)" != zfcwvzazzzsefbkztsyp ]; then echo "not production: stop"; else
KEYS="'owner/one', 'owner/two'"   # the lowercase keys of the scratch repositories, nothing else
GITHUB_ID=$(gh api users/ryota-murakami -q .id)
OWNER="(SELECT user_id FROM auth.identities WHERE provider = 'github' AND provider_id = '$GITHUB_ID')"
supabase db query --linked "SELECT
  (SELECT count(*) FROM auth.identities WHERE provider = 'github' AND provider_id = '$GITHUB_ID') AS owner_identities,
  (SELECT count(*) FROM projectinfo WHERE user_id = $OWNER AND repo_key IN ($KEYS)) AS rows_before_the_check"
fi
```

Expected: `owner_identities` 1 and `rows_before_the_check` 0. Pick other repositories when a row is there: it is a memory of the owner that the cleanup must not touch. The owner is found by the GitHub account id that GitHub sign-in stored, not by `auth.users.raw_user_meta_data`, which a signed-in user can change for their own account. On 2026-10-15 the id resolved to one identity, the user who holds 5 boards.

The scratch repositories keep their memory after their boards are gone. Delete those rows by their exact keys and report what is left. Run it in the same shell, after the scratch boards are deleted:

```bash
if [ "$(cat supabase/.temp/project-ref)" != zfcwvzazzzsefbkztsyp ]; then echo "not production: stop"; else
supabase db query --linked "WITH deleted AS (
    DELETE FROM projectinfo WHERE user_id = $OWNER AND repo_key IN ($KEYS)
      AND NOT EXISTS (SELECT 1 FROM repocard r WHERE r.user_id = projectinfo.user_id
        AND lower(r.repo_owner) || '/' || lower(r.repo_name) = projectinfo.repo_key)
    RETURNING 1)
  SELECT count(*) AS deleted_rows FROM deleted"
supabase db query --linked "SELECT count(*) AS rows FROM projectinfo"
fi
```

Expected: `deleted_rows` is at most the number of keys in `KEYS` (one row per scratch repository that got a note, a link or a comment), and `rows` is the count of section 5. The `NOT EXISTS` keeps a row whose repository is on a board again.

## 7. When something fails

- **The migration refused.** It changed nothing. Its message and `DETAIL` (the CLI prints both) say what to do: a row without a card is deleted after copying anything worth keeping; rows that share a repository are merged into one; extra policies are made equal to the migrations. Then section 4 again (a new `STAMP`). The new build keeps running on the old schema meanwhile, with the limits listed at the top.
- **The run failed on a lock.** `canceling statement due to lock timeout` or `deadlock detected`: a request held `projectinfo` or `repocard` when the run wanted them (the header of the migration says when). Nothing was changed. Run section 4 again.
- **The run failed on `projectinfo_unique_repo_per_user`.** Two cards of one user name the same `repo_key`: a `/` in an owner or a name (section 2). Nothing was changed. Copy what is worth keeping from the two rows, delete the card whose owner or name holds the `/`, then section 4 again.
- **The new build misbehaves before the migration ran.** Rolling back is safe while the schema is still the old one: `vercel rollback $PREV_DEPLOYMENT --scope laststance` (the id noted in section 2), then `vercel inspect gitbox-laststance.vercel.app --scope laststance` names that id. Do not run the migration while the old build serves production. A rollback stops Vercel from giving the production domain to new builds: when the fixed build of `main` is ready, `vercel promote <its url> --scope laststance` puts it in production and turns the automatic assignment on again. Until then a merge to `main` deploys nothing that users see.
- **Something is wrong after the migration ran.** There is no reverse migration and no code rollback: the old build reads `repo_card_id`, which is gone. Fix forward. The dump and the manifest of section 4 hold every row as it was.
- **Every way out.** Whether the rollout finished, stopped or failed, the workflow ends enabled, or the next migration merged to `main` would not run:

```bash
gh workflow enable supabase-production.yml --repo laststance/gitbox
gh workflow list --repo laststance/gitbox --all | grep -i "supabase production"
```

Expected: the workflow is listed as `active`. Enabling it starts no run; the next push to `main` that changes `supabase/migrations/` does.
