# Rollout runbook: issue #213, remove Maintenance Mode

Plan: [2026-10-12-issue-213-remove-maintenance-mode.md](./2026-10-12-issue-213-remove-maintenance-mode.md). Migrations: `supabase/migrations/20261012085900_create_board_with_status_lists.sql` and `supabase/migrations/20261012090000_remove_maintenance_mode.sql`.

This is a document. Nothing in it runs in CI or in a test. Every block can be pasted into a bash or zsh shell at the repository root. Each block says what it needs, what it must print and when to stop.

Rules that hold for every block:

- The job log of this repository is public. A command whose output can reach it prints counts, never a repository name or a user id.
- Dumps, manifests and the metadata document hold private repository names and notes. They are written to `~/gitbox-backups/` (directory mode 700, files mode 600) and never committed. The directory is outside the repository and outside `~/.gstack`, which is synced.
- A command with `--linked` talks to production. Run this first, every time:

```bash
cat supabase/.temp/project-ref   # must print zfcwvzazzzsefbkztsyp; stop otherwise
```

- The local database is reached through its container (the host has no `psql`), and local `supabase` commands that reset the stack are run the way `pnpm db:reset` runs them, so the local GitHub sign-in keeps its credentials:

```bash
psql_local() { docker exec -i supabase_db_gitbox psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
supabase_local() { (cd supabase && . ./.env && supabase "$@"); }
mkdir -p ~/gitbox-backups && chmod 700 ~/gitbox-backups && umask 077
```

- The Supabase CLI version is the one `.github/workflows/supabase-production.yml` pins (`supabase --version` must print the same number). The rehearsal below ran on 2.120.0.

What the CLI shows, observed with 2.120.0: a failed migration prints the exception message and its `DETAIL`, then the whole statement. It prints neither a `HINT` nor a `NOTICE`. That is why the next step of every refusal is written into `DETAIL`, and why no step below reads the `NOTICE`.

## 1. Schema comparison

Needs: the local database at the version production has (`20261011030000`), without the two new migrations.

```bash
supabase_local db reset --local --version 20261011030000 --no-seed
supabase db dump --linked --schema public --file /tmp/prod_public_schema.sql
supabase db dump --local  --schema public --file /tmp/local_public_schema.sql
diff /tmp/prod_public_schema.sql /tmp/local_public_schema.sql && echo "schemas are equal"
```

Expected: `schemas are equal`. Stop when `diff` prints a line that concerns `maintenance`, `projectinfo`, `repocard`, `board`, `statuslist`, their policies, triggers, constraints or indexes, or the functions `move_to_maintenance` and `restore_to_board`. A difference is not worked around: the migration is changed to fit production, or the difference is removed first.

## 2. Rehearsal, scenario A: rows built by hand

Needs: the local database of step 1 (version `20261011030000`, no seed).

```bash
psql_local -q <<'SQL'
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'first@rehearsal.test', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'second@rehearsal.test', now(), now());

-- First user: two entries, no board
INSERT INTO maintenance (id, user_id, repo_owner, repo_name, created_at, updated_at) VALUES
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'octo', 'alpha', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'octo', 'beta',  '2026-01-02T00:00:00Z', '2026-03-01T00:00:00Z');

-- Second user: one board, one column, one card, one entry that has a note
INSERT INTO board (id, user_id, name, position) VALUES
  ('b2000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Work', 0);
INSERT INTO statuslist (id, board_id, name, "order", grid_row, grid_col) VALUES
  ('c2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Todo', 0, 0, 0);
INSERT INTO repocard (id, board_id, status_id, repo_owner, repo_name, "order") VALUES
  ('d2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'octo', 'gamma', 0);
INSERT INTO maintenance (id, user_id, repo_owner, repo_name, created_at, updated_at) VALUES
  ('a2000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'octo', 'delta', '2026-01-03T00:00:00Z', '2026-04-01T00:00:00Z');
INSERT INTO projectinfo (id, maintenance_id, note, comment, links, created_at, updated_at) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'note kept on the entry', 'a comment', '{"docs":"https://example.test"}', '2026-01-04T00:00:00Z', '2026-05-01T00:00:00Z');
SQL
```

The refusals, one at a time. Each `supabase_local migration up --local` must fail with the message shown and change nothing; the row that caused it is removed before the next one.

```bash
# Overlap: an entry for the repository of the second user's card (other letter case on purpose)
psql_local -q -c "INSERT INTO maintenance (id, user_id, repo_owner, repo_name) VALUES ('a2000000-0000-4000-8000-0000000000ff', '22222222-2222-2222-2222-222222222222', 'Octo', 'GAMMA')"
supabase_local migration up --local   # expect: "1 entry(ies) whose repository is already on a board ..., 0 group(s) ..., 0 entry(ies) whose id ..."
psql_local -q -c "DELETE FROM maintenance WHERE id = 'a2000000-0000-4000-8000-0000000000ff'"

# Letter case: an entry that differs from an existing one only in letter case
psql_local -q -c "INSERT INTO maintenance (id, user_id, repo_owner, repo_name) VALUES ('a1000000-0000-4000-8000-0000000000ff', '11111111-1111-1111-1111-111111111111', 'Octo', 'ALPHA')"
supabase_local migration up --local   # expect counts 0, 1, 0
psql_local -q -c "DELETE FROM maintenance WHERE id = 'a1000000-0000-4000-8000-0000000000ff'"

# Shared id: an entry for another repository that carries the id of the second user's card
psql_local -q -c "INSERT INTO maintenance (id, user_id, repo_owner, repo_name) VALUES ('d2000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'octo', 'epsilon')"
supabase_local migration up --local   # expect counts 0, 0, 1
psql_local -q -c "DELETE FROM maintenance WHERE id = 'd2000000-0000-4000-8000-000000000001'"

# Policies: a third policy on projectinfo
psql_local -q -c 'CREATE POLICY "Rehearsal extra policy" ON projectinfo FOR SELECT USING (false)'
supabase_local migration up --local   # expect: "projectinfo has 3 row level security policy(ies), 2 of them defined by the migrations"
psql_local -q -c 'DROP POLICY "Rehearsal extra policy" ON projectinfo'
```

After the first refusal the function migration is applied and stays applied (it sorts first); the removal is not recorded:

```bash
psql_local -At -c "select (select count(*) from board), to_regclass('public.maintenance') is not null, to_regprocedure('public.create_board_with_status_lists(text,jsonb)') is not null"
# expect: 1|t|t
```

The successful run:

```bash
supabase_local migration up --local   # expect: "Migrations applied"
psql_local -c "select b.user_id::text like '1111%' as first_user, b.name as board, b.position, s.name as col, r.repo_owner||'/'||r.repo_name as repo, r.\"order\", r.meta, r.updated_at, r.user_id = b.user_id as owner_ok from board b join statuslist s on s.board_id=b.id left join repocard r on r.status_id=s.id order by b.user_id, b.position, r.\"order\""
psql_local -c "select id, repo_card_id, note, comment, links, updated_at from projectinfo"
```

Expected: the first user has a board `Maintenance` at position 0 with `octo/beta` (order 0) and `octo/alpha` (order 1); the second user has `Work` at 0 and `Maintenance` at 1 with `octo/delta`; every migrated card has `meta` `{}`, the timestamps of its entry and `owner_ok` true. The one `projectinfo` row hangs on card `a2000000-…-01` with `updated_at` still `2026-05-01`. Then run the verification query of section 6: `table_gone` t, `column_gone` t, 2 boards, 3 cards, 1 note, 2 policies, trigger `O`.

Each user reads only their own notes (role `authenticated` with that user's claims):

```bash
for uid in 11111111-1111-1111-1111-111111111111 22222222-2222-2222-2222-222222222222; do
psql_local -At <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"$uid","role":"authenticated"}', true);
SELECT 'notes visible: ' || count(*) FROM projectinfo;
WITH changed AS (UPDATE projectinfo SET note = 'overwritten' RETURNING 1) SELECT 'notes writable: ' || count(*) FROM changed;
ROLLBACK;
SQL
done
# expect: 0 and 0 for the first user, 1 and 1 for the second
```

A second run does nothing. Without the repair the CLI skips the file and the early return is never executed:

```bash
supabase_local migration repair --status reverted 20261012090000 --local
supabase_local migration up --local   # expect: "Migrations applied"; the counts above are unchanged
```

The function, called as a signed-in user and as nobody:

```bash
psql_local -At <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
SELECT create_board_with_status_lists('  Side Projects  ', '[{"name":"Todo","color":"#111111"},{"name":" Doing ","color":"#222222"},{"name":"Done","color":"#333333"}]'::jsonb);
SELECT b.name, b.position, s.name, s."order", s.grid_row, s.grid_col FROM board b JOIN statuslist s ON s.board_id = b.id WHERE b.name = 'Side Projects' ORDER BY s."order";
ROLLBACK;
SQL
# expect: the name trimmed, the board after the user's last one, columns Todo/Doing/Done with order 0,1,2, grid_row 0, grid_col 0,1,2
```

Refused, each with no board left behind: an empty list (`'[]'`), a column without a name, a color that is not `#RRGGBB`, a name of 51 characters, a call as role `anon` (`permission denied for function`), and a call as `authenticated` without claims (`the caller is not signed in`).

## 3. Rehearsal, scenario B: a copy of production

Needs: production reachable, the local database free to be reset.

```bash
cat supabase/.temp/project-ref
DUMP=~/gitbox-backups/prod-public-data-$(date +%Y%m%d-%H%M).sql
supabase db dump --linked --data-only --schema public --file "$DUMP"   # no auth data is dumped
supabase_local db reset --local --version 20261011030000 --no-seed
psql_local -q < "$DUMP"   # the dump turns foreign key checks off while it loads

# One stub auth.users row per user id the copied rows reference
psql_local -q <<'SQL'
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
SELECT referenced.user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'stub-' || referenced.user_id || '@rehearsal.test', now(), now()
FROM (
  SELECT user_id FROM board
  UNION SELECT user_id FROM maintenance
  UNION SELECT user_id FROM repocard
  UNION SELECT user_id FROM user_settings
  UNION SELECT user_id FROM user_link_presets
) referenced
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = referenced.user_id);
SQL
```

The manifest before. One row per entry, per note, per card, per board and per column. The same statement is used on production in section 5 (`--linked` in place of `--local`).

```bash
cat > ~/gitbox-backups/manifest-before.sql <<'SQL'
SELECT kind, id, holder, repo, created_at, updated_at, extra FROM (
  SELECT 'entry' AS kind, m.id::text AS id, m.user_id::text AS holder,
         m.repo_owner || '/' || m.repo_name AS repo,
         coalesce(m.created_at::text, '') AS created_at, coalesce(m.updated_at::text, '') AS updated_at,
         '' AS extra
  FROM maintenance m
  UNION ALL
  SELECT 'entry_note', p.id::text, p.maintenance_id::text, '',
         coalesce(p.created_at::text, ''), coalesce(p.updated_at::text, ''),
         md5(concat_ws('|', coalesce(p.note, ''), coalesce(p.comment, ''), coalesce(p.comment_color, ''), coalesce(p.links::text, '')))
  FROM projectinfo p WHERE p.maintenance_id IS NOT NULL
  UNION ALL
  SELECT 'card', r.id::text, r.user_id::text, r.repo_owner || '/' || r.repo_name,
         coalesce(r.created_at::text, ''), coalesce(r.updated_at::text, ''),
         r.board_id::text || '|' || r.status_id::text || '|' || r."order"::text || '|' || md5(coalesce(r.meta::text, ''))
  FROM repocard r
  UNION ALL
  SELECT 'card_note', p.id::text, p.repo_card_id::text, '',
         coalesce(p.created_at::text, ''), coalesce(p.updated_at::text, ''),
         md5(concat_ws('|', coalesce(p.note, ''), coalesce(p.comment, ''), coalesce(p.comment_color, ''), coalesce(p.links::text, '')))
  FROM projectinfo p WHERE p.repo_card_id IS NOT NULL
  UNION ALL
  SELECT 'board', b.id::text, b.user_id::text, b.name,
         coalesce(b.created_at::text, ''), coalesce(b.updated_at::text, ''), b.position::text
  FROM board b
  UNION ALL
  SELECT 'column', s.id::text, s.board_id::text, s.name,
         coalesce(s.created_at::text, ''), coalesce(s.updated_at::text, ''),
         s."order"::text || '|' || s.grid_row::text || '|' || s.grid_col::text
  FROM statuslist s
) manifest
ORDER BY kind, id;
SQL

TSV='.rows[] | [.kind, .id, .holder, .repo, .created_at, .updated_at, .extra] | @tsv'
supabase db query --local -f ~/gitbox-backups/manifest-before.sql 2>/dev/null > ~/gitbox-backups/manifest-before.json
jq -r "$TSV" ~/gitbox-backups/manifest-before.json > ~/gitbox-backups/manifest-before.tsv
cut -f1 ~/gitbox-backups/manifest-before.tsv | sort | uniq -c   # counts per kind
```

The manifest after reads the same rows back by id. The ids of the entries and of their notes come from the manifest before; the block refuses to go on when a value in them is not a uuid.

```bash
ENTRY_IDS=$(jq -r '[.rows[] | select(.kind == "entry") | .id] | map("'"'"'" + . + "'"'"'") | join(",")' ~/gitbox-backups/manifest-before.json)
NOTE_IDS=$(jq -r '[.rows[] | select(.kind == "entry_note") | .id] | map("'"'"'" + . + "'"'"'") | join(",")' ~/gitbox-backups/manifest-before.json)
printf '%s' "$ENTRY_IDS$NOTE_IDS" | grep -Eq "^('[0-9a-f-]{36}',?)+$" && echo "uuid lists ok" || echo "NOT a uuid list: stop here"

cat > ~/gitbox-backups/manifest-after.sql <<SQL
WITH entry_ids(id) AS (SELECT unnest(ARRAY[$ENTRY_IDS]::uuid[])),
     entry_note_ids(id) AS (SELECT unnest(ARRAY[$NOTE_IDS]::uuid[]))
SELECT kind, id, holder, repo, created_at, updated_at, extra FROM (
  -- A former entry is now the card with its id
  SELECT 'entry' AS kind, r.id::text AS id, r.user_id::text AS holder,
         r.repo_owner || '/' || r.repo_name AS repo,
         coalesce(r.created_at::text, '') AS created_at, coalesce(r.updated_at::text, '') AS updated_at,
         '' AS extra
  FROM repocard r WHERE r.id IN (SELECT id FROM entry_ids)
  UNION ALL
  -- Its note now hangs on that card: the holder id is the same value
  SELECT 'entry_note', p.id::text, p.repo_card_id::text, '',
         coalesce(p.created_at::text, ''), coalesce(p.updated_at::text, ''),
         md5(concat_ws('|', coalesce(p.note, ''), coalesce(p.comment, ''), coalesce(p.comment_color, ''), coalesce(p.links::text, '')))
  FROM projectinfo p WHERE p.id IN (SELECT id FROM entry_note_ids)
  UNION ALL
  SELECT 'card', r.id::text, r.user_id::text, r.repo_owner || '/' || r.repo_name,
         coalesce(r.created_at::text, ''), coalesce(r.updated_at::text, ''),
         r.board_id::text || '|' || r.status_id::text || '|' || r."order"::text || '|' || md5(coalesce(r.meta::text, ''))
  FROM repocard r WHERE r.id NOT IN (SELECT id FROM entry_ids)
  UNION ALL
  SELECT 'card_note', p.id::text, p.repo_card_id::text, '',
         coalesce(p.created_at::text, ''), coalesce(p.updated_at::text, ''),
         md5(concat_ws('|', coalesce(p.note, ''), coalesce(p.comment, ''), coalesce(p.comment_color, ''), coalesce(p.links::text, '')))
  FROM projectinfo p WHERE p.id NOT IN (SELECT id FROM entry_note_ids)
  UNION ALL
  SELECT 'board', b.id::text, b.user_id::text, b.name,
         coalesce(b.created_at::text, ''), coalesce(b.updated_at::text, ''), b.position::text
  FROM board b
  UNION ALL
  SELECT 'column', s.id::text, s.board_id::text, s.name,
         coalesce(s.created_at::text, ''), coalesce(s.updated_at::text, ''),
         s."order"::text || '|' || s.grid_row::text || '|' || s.grid_col::text
  FROM statuslist s
) manifest
ORDER BY kind, id;
SQL

supabase_local migration up --local   # expect: both migrations applied
supabase db query --local -f ~/gitbox-backups/manifest-after.sql 2>/dev/null > ~/gitbox-backups/manifest-after.json
jq -r "$TSV" ~/gitbox-backups/manifest-after.json > ~/gitbox-backups/manifest-after.tsv
diff ~/gitbox-backups/manifest-before.tsv ~/gitbox-backups/manifest-after.tsv | grep '^[<>]' | awk -F'\t' '{print $1, $4, $7}' | sed 's/[0-9a-f]\{8\}-[0-9a-f-]\{27\}/<uuid>/g'
```

Expected: no line that starts with `<` (nothing was removed or changed), and one `> board Maintenance <position>` plus one `> column Repositories 0|0|0` for each user who had entries. Every `entry`, `entry_note`, `card` and `card_note` line is the same before and after: each entry is a card with the same id, owner, repository and timestamps, each note hangs on the id it hung on with the same content hash and `updated_at`, and every card that existed before is where it was. Stop on any other line. Then run the verification query of section 6 and the early return of section 2 (repair, `migration up`, the manifest after is unchanged).

The local database now holds a copy of production, the second user's rows included. It stays for the local check and the screenshots only; `pnpm db:reset` puts the seed back.

## 4. Local check: hand the copy to the local account

Needs: the database of section 3, the app running on `http://localhost:3008`, signed in as `ryota-murakami` (local GoTrue gives the account a new id and the sign-in creates "First Board"). First, with only that board: add a repository, open its menu, Move to Another Board, create the destination board in the dialog and finish the move. Then:

```bash
STUB=$(jq -r '[.rows[] | select(.kind == "entry") | .holder] | unique | .[]' ~/gitbox-backups/manifest-before.json)   # one id expected
LOCAL=$(psql_local -At -c "select id from auth.users where email not like 'stub-%@rehearsal.test'")                      # one id expected
psql_local -v stub="$STUB" -v local="$LOCAL" <<'SQL'
BEGIN;
-- The boards of the first-board journey go first: their cards would collide with the same
-- repositories on the copied boards (one card per user and repository).
DELETE FROM board WHERE user_id = :'local';
UPDATE board SET user_id = :'local' WHERE user_id = :'stub';
-- set_repocard_user_id copies the owner from the board; it fires only when the card row is updated
UPDATE repocard SET user_id = :'local' WHERE user_id = :'stub';
DELETE FROM user_settings WHERE user_id = :'local';
UPDATE user_settings SET user_id = :'local' WHERE user_id = :'stub';
DELETE FROM user_link_presets WHERE user_id = :'local';
UPDATE user_link_presets SET user_id = :'local' WHERE user_id = :'stub';
DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM repocard r JOIN board b ON b.id = r.board_id WHERE r.user_id <> b.user_id) THEN
    RAISE EXCEPTION 'a card and its board have different owners; nothing was changed';
  END IF;
END
$check$;
COMMIT;
SQL
```

Expected: `COMMIT`. Stop on any error (the transaction rolls back). Reload the app: the copied boards, the board `Maintenance` among them, belong to the signed-in account.

## 5. Right before the merge

Needs: the PR green, production reachable. Nothing below changes production.

```bash
cat supabase/.temp/project-ref
supabase db query --linked "SELECT
  (SELECT count(*) FROM maintenance) AS entries,
  (SELECT count(DISTINCT user_id) FROM maintenance) AS users_with_entries,
  (SELECT count(*) FROM projectinfo WHERE maintenance_id IS NOT NULL) AS projectinfo_on_entries,
  (SELECT count(*) FROM maintenance m JOIN repocard r ON r.user_id = m.user_id
     AND lower(r.repo_owner) = lower(m.repo_owner)
     AND lower(r.repo_name) = lower(m.repo_name)) AS entries_also_on_a_board,
  (SELECT count(*) FROM (SELECT 1 FROM maintenance
     GROUP BY user_id, lower(repo_owner), lower(repo_name)
     HAVING count(*) > 1) d) AS case_variant_groups,
  (SELECT count(*) FROM maintenance m JOIN repocard r ON r.id = m.id)
     AS entries_sharing_an_id_with_a_card,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'projectinfo') AS projectinfo_policies"
supabase db push --linked --dry-run
```

Expected: `entries_also_on_a_board`, `case_variant_groups` and `entries_sharing_an_id_with_a_card` are 0, `projectinfo_policies` is 2, and the dry run lists the two migrations of this PR and nothing else. Note the `entries` count. Stop when a conflict count is above 0 (section 7) or the dry run lists another file.

Then the dump and the manifest of production, as in section 3 with `--linked`:

```bash
STAMP=$(date +%Y%m%d-%H%M)
supabase db dump --linked --data-only --schema public --file ~/gitbox-backups/prod-public-data-before-merge-$STAMP.sql
supabase db query --linked -f ~/gitbox-backups/manifest-before.sql 2>/dev/null > ~/gitbox-backups/prod-manifest-before-$STAMP.json
jq -r "$TSV" ~/gitbox-backups/prod-manifest-before-$STAMP.json > ~/gitbox-backups/prod-manifest-before-$STAMP.tsv
cut -f1 ~/gitbox-backups/prod-manifest-before-$STAMP.tsv | sort | uniq -c
ls -l ~/gitbox-backups/
```

Expected: the `entry` count equals `entries` above, and every file is `-rw-------`. Between this step and the migration nothing may write to Maintenance, and no check on production or on a preview deployment may add a repository that is in Maintenance to a board.

## 6. After the merge

Needs: the `Supabase Production Migration` run of the merge commit finished green (`gh run list --workflow supabase-production.yml --limit 1`).

```bash
supabase db query --linked "SELECT
  to_regclass('public.maintenance') IS NULL AS table_gone,
  NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projectinfo'
      AND column_name = 'maintenance_id') AS column_gone,
  (SELECT count(*) FROM board WHERE name = 'Maintenance') AS boards_named_maintenance,
  (SELECT count(*) FROM repocard r JOIN board b ON b.id = r.board_id
    WHERE b.name = 'Maintenance') AS cards_on_them,
  (SELECT count(*) FROM projectinfo p JOIN repocard r ON r.id = p.repo_card_id
    JOIN board b ON b.id = r.board_id WHERE b.name = 'Maintenance') AS projectinfo_on_them,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projectinfo') AS projectinfo_policies,
  (SELECT tgenabled FROM pg_trigger WHERE tgname = 'update_projectinfo_updated_at'
    AND tgrelid = 'public.projectinfo'::regclass) AS projectinfo_trigger"
```

Expected: `table_gone` and `column_gone` true, one board per user who had entries, `cards_on_them` equal to the `entries` count of section 5, `projectinfo_on_them` equal to `projectinfo_on_entries`, 2 policies, trigger `O`. This is the summary. The proof is the manifest:

```bash
# ENTRY_IDS and NOTE_IDS as in section 3, taken from prod-manifest-before-$STAMP.json; write manifest-after.sql the same way
supabase db query --linked -f ~/gitbox-backups/manifest-after.sql 2>/dev/null > ~/gitbox-backups/prod-manifest-after-$STAMP.json
jq -r "$TSV" ~/gitbox-backups/prod-manifest-after-$STAMP.json > ~/gitbox-backups/prod-manifest-after-$STAMP.tsv
diff ~/gitbox-backups/prod-manifest-before-$STAMP.tsv ~/gitbox-backups/prod-manifest-after-$STAMP.tsv | grep '^[<>]' | awk -F'\t' '{print $1, $4, $7}' | sed 's/[0-9a-f]\{8\}-[0-9a-f-]\{27\}/<uuid>/g'
```

How to read it:

- `entry` and `entry_note` lines must not appear at all. One of them means an entry or a note is not where it has to be: stop the rollout and repair from the dump (section 9).
- One `> board Maintenance` and one `> column Repositories` per user who had entries are the expected additions.
- A `card`, `card_note`, `board` or `column` line of a row that existed before means a user wrote something after the manifest was taken (a moved card has another column, `order` or `updated_at`). Look at it by hand; it is not a loss as long as the id, the board and the repository are still there.

## 7. The query that lists the conflicts

Run by hand, never in CI: its output names repositories.

```bash
supabase db query --linked "
SELECT 'also on a board' AS conflict, m.id AS entry_id, m.repo_owner || '/' || m.repo_name AS entry_repo, r.id AS card_id, b.name AS board
FROM maintenance m
JOIN repocard r ON r.user_id = m.user_id AND lower(r.repo_owner) = lower(m.repo_owner) AND lower(r.repo_name) = lower(m.repo_name)
JOIN board b ON b.id = r.board_id
UNION ALL
SELECT 'letter case', m.id, m.repo_owner || '/' || m.repo_name, NULL, NULL
FROM maintenance m
WHERE (m.user_id, lower(m.repo_owner), lower(m.repo_name)) IN (
  SELECT user_id, lower(repo_owner), lower(repo_name) FROM maintenance
  GROUP BY 1, 2, 3 HAVING count(*) > 1)
UNION ALL
SELECT 'id is a card id', m.id, m.repo_owner || '/' || m.repo_name, r.id, NULL
FROM maintenance m JOIN repocard r ON r.id = m.id"
```

Resolve each row by deleting the board card or the entry (for "letter case": all but one entry of the group), then run the migration again: `gh workflow run supabase-production.yml` on production, `pnpm db:reset` locally. No commit is needed.

## 8. The metadata fill

The removed feature never stored GitHub metadata, so the migrated cards show a bare title. This fills `meta` once. Needs: section 6 passed, the manifest before of section 5, `gh` signed in as `ryota-murakami`. Try it on the local copy first (`--local` in place of `--linked`).

```bash
export GH_TOKEN=$(gh auth token --user ryota-murakami)
gh api user --jq .login   # must print ryota-murakami; stop otherwise
B=~/gitbox-backups; MANIFEST=$B/prod-manifest-before-$STAMP.json
: > $B/meta-fill.jsonl; : > $B/meta-gone.txt; : > $B/meta-failed.txt
jq -r '.rows[] | select(.kind == "entry") | [.id, .repo] | @tsv' "$MANIFEST" |
while IFS=$'\t' read -r card_id repo; do
  response=$(gh api -i "repos/$repo" 2>/dev/null)
  http_status=$(printf '%s\n' "$response" | head -1 | awk '{print $2}')
  case "$http_status" in
    200)
      # The fields addRepositoriesToBoard stores, under the same keys
      printf '%s\n' "$response" | sed '1,/^\r\{0,1\}$/d' | jq -c --arg id "$card_id" --arg repo "$repo" '{
        id: $id, repo_owner: ($repo | split("/")[0]), repo_name: ($repo | split("/")[1]),
        meta: { stars: .stargazers_count, language: .language, topics: (.topics // []),
                visibility: .visibility, description: .description, updatedAt: .updated_at, githubId: .id } }' >> $B/meta-fill.jsonl ;;
    404) echo "$card_id" >> $B/meta-gone.txt ;;
    *)   echo "$card_id $http_status" >> $B/meta-failed.txt ;;
  esac
done
wc -l $B/meta-fill.jsonl $B/meta-gone.txt $B/meta-failed.txt
```

Three groups: returned (filled), gone (404: the card keeps its empty `meta` and is named in the report), failed (anything else, such as a rate limit, 401 or 5xx). Stop when `meta-failed.txt` is not empty: the fill is not complete; run this block again later. The three counts add up to the `entry` count.

The write. The values travel as one JSON document inside a dollar-quoted literal, so nothing is escaped by hand; both tags are random and the block refuses to send when the document contains one of them.

```bash
DOC=$(jq -s -c '.' $B/meta-fill.jsonl)
TAG_BLOCK="block_$(openssl rand -hex 8)"; TAG_DOC="doc_$(openssl rand -hex 8)"
case "$DOC" in *"$TAG_BLOCK"*|*"$TAG_DOC"*) echo "a tag occurs in the document: stop and run this block again" ;; *) echo "tags ok" ;; esac
cat > $B/meta-fill.sql <<SQL
DO \$$TAG_BLOCK\$
DECLARE
  v_document jsonb := \$$TAG_DOC\$$DOC\$$TAG_DOC\$::jsonb;
  v_expected integer := jsonb_array_length(v_document);
  v_changed integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  -- The cards were not edited, so updated_at must not say they were
  ALTER TABLE repocard DISABLE TRIGGER update_repocard_updated_at;
  UPDATE repocard r
  SET meta = element.value->'meta'
  FROM jsonb_array_elements(v_document) AS element(value)
  WHERE r.id = (element.value->>'id')::uuid
    AND r.repo_owner = element.value->>'repo_owner'
    AND r.repo_name = element.value->>'repo_name'
    AND r.meta = '{}'::jsonb;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  ALTER TABLE repocard ENABLE TRIGGER update_repocard_updated_at;
  IF v_changed <> v_expected THEN
    RAISE EXCEPTION 'meta fill: % of % card(s) matched by id, owner, repository and an empty meta; nothing was changed.', v_changed, v_expected;
  END IF;
END
\$$TAG_BLOCK\$;
SQL
supabase db query --linked -f $B/meta-fill.sql
```

A card changes only when its id, owner and repository all match and its `meta` is still empty, and the block raises when the number of changed rows differs from the number of elements. So a value cannot land on another card, and a second run raises with `0 of N` and changes nothing.

The check, by id and not by count:

```bash
FILLED_IDS=$(jq -s -r 'map("'"'"'" + .id + "'"'"'") | join(",")' $B/meta-fill.jsonl)
supabase db query --linked "SELECT id::text AS id, meta FROM repocard WHERE id = ANY(ARRAY[$FILLED_IDS]::uuid[]) ORDER BY id" 2>/dev/null | jq -S -c '.rows[] | {id, meta}' > $B/meta-read-back.jsonl
jq -S -c '{id, meta}' $B/meta-fill.jsonl | sort > $B/meta-sent.jsonl
sort $B/meta-read-back.jsonl | diff - $B/meta-sent.jsonl && echo "every card holds what was sent"
supabase db query --linked "SELECT tgenabled FROM pg_trigger WHERE tgname = 'update_repocard_updated_at' AND tgrelid = 'public.repocard'::regclass"   # expect O
```

Then read the manifest after once more (section 6) and compare it with the one taken after the migration: `diff` prints nothing. The filled cards are `entry` lines, which carry their timestamps and no hash of `meta`, so an unchanged line shows that `updated_at` was kept; every other card's line ends in a hash of its `meta`, so an unchanged line shows that the fill touched no other card.

On the local copy also compare the keys the fill writes with those of a card added through the picker; both must be `description,githubId,language,stars,topics,updatedAt,visibility`:

```bash
psql_local -At -c "select distinct (select string_agg(k, ',' order by k) from jsonb_object_keys(meta) k) from repocard where meta <> '{}'::jsonb"
```

To take the fill back: `UPDATE repocard SET meta = '{}'::jsonb WHERE id = ANY(...)` with the same ids, inside the same trigger toggle.

## 9. When something fails

The log of the migration run says which case it is.

| The log shows                                                                          | What it means                                                                                                                                                                                                                                                 | What to do                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `canceling statement due to lock timeout`, or `deadlock detected` (`40P01`)            | Another transaction held one of the three tables. The two functions this migration drops lock the same tables in the opposite order, so a running call of one of them can also end in a deadlock. Nothing is wrong with the migration and nothing was changed | `gh workflow run supabase-production.yml`                                                                                                                                |
| A message that starts with `remove_maintenance_mode:` and counts conflicts or policies | The migration is right; the data or the schema is not what it expects. Nothing was changed                                                                                                                                                                    | Section 7 for conflicts; for policies compare `supabase db dump --linked --schema public` with the migrations. Then `gh workflow run supabase-production.yml`. No commit |
| `remove_maintenance_mode: row level security applies to this session`                  | The role that ran the migration is not the owner of the tables. Nothing was changed                                                                                                                                                                           | Run it as the role `supabase db push` uses                                                                                                                               |
| `remove_maintenance_mode: … the move is incomplete`, or any other error                | A defect of the migration. The database is unchanged (one transaction) and the migration is not recorded                                                                                                                                                      | Fix the same migration file in a new commit on `main`; the push runs it again                                                                                            |

While the removal has not run, the new build works on a schema that still has the table (the plan's table of builds and schemas says what works). The entries are intact and shown nowhere. Do not add a repository that is in Maintenance to a board in that state: the card would make the migration refuse.

When the migration succeeded and section 6 shows a wrong result: the lines of the manifest comparison name the rows. Rebuild them by hand from the dump of section 5; its `maintenance` inserts target a table that no longer exists, so the file is a source of values and is not replayed. Point-in-time recovery is the last resort: it also takes back every other write made since.

The files in `~/gitbox-backups/` can be deleted two weeks after the rollout, once the board has been looked at.
