<!-- /autoplan restore point: "/Users/ryotamurakami/laststance/gitbox/.gstack/tmp/autoplan/main-autoplan-restore-20261011-000642.md" -->

## Implementation plan

# Issue #215: one repo, one card across all of a user's boards

Source: https://github.com/laststance/gitbox/issues/215

## Problem

Same repo can sit on several boards. Each card owns its own `projectinfo` (note, links, comment), so edits diverge and the user can't tell which copy is current.

## Goal

A user can place a given GitHub repo on at most one board. Board-to-board uniqueness is enforced in the DB. Board versus maintenance exclusivity stays app-enforced. Identity is `owner/name`, case-insensitive; renames and transfers are not tracked yet. The UI explains where a repo already lives and how to get there.

Success: the count-only audit on production returns 0 duplicate groups after rollout and stays 0.

## Current state

- `repocard` has `UNIQUE (board_id, repo_owner, repo_name)` (`unique_repo_per_board`). Per-board only.
- `maintenance` has `UNIQUE (user_id, repo_owner, repo_name)`. Already user-wide.
- `repocard` has no `user_id`; ownership goes through `board.user_id` (RLS joins `board`).
- Paths that place a card:
  - `addRepositoriesToBoard` (`src/lib/actions/repo-cards.ts:97`): insert. Dedups against current board + maintenance only.
  - `restoreToBoard` (`repo-cards.ts:280`) -> `restore_to_board` RPC: insert. Dedups against target board only.
  - `moveCardToBoard` (`repo-cards.ts:462`) -> `move_card_to_board` RPC: updates `board_id`, card id kept. Dedups against target board only.
- `AddRepositoryCombobox` (`src/components/Board/AddRepositoryCombobox.tsx:194`) hides repos on the current board and in maintenance. Repos on other boards stay selectable.
- Server compares `owner/name` case-sensitively; the combobox lowercases. GitHub names are case-insensitive.

## Plan

### 1. Audit existing duplicates (read-only, before writing the migration)

Count repos that appear on 2+ boards of one user, on local and production. Counts only; never select repo names or user ids.

Result (production, 2026-10-11): 1 cross-board duplicate group, in the repository owner's own account. 0 repos both on a board and in maintenance. 0 case-variant duplicates. 22 cards, 2 users.

```sql
SELECT count(*) AS cross_board_duplicate_groups FROM (
  SELECT 1 FROM repocard r JOIN board b ON b.id = r.board_id
  GROUP BY b.user_id, lower(r.repo_owner), lower(r.repo_name)
  HAVING count(*) > 1
) d;
```

### 2. Migration `<ts>_repocard_unique_repo_per_user.sql` (one transaction)

- Guard, first statement: raise an exception when any `(board.user_id, lower(repo_owner), lower(repo_name))` has more than one card. The message carries the group count only. A failed guard leaves the schema untouched.
- Add `repocard.user_id uuid DEFAULT auth.uid()` referencing `auth.users(id) ON DELETE CASCADE`; backfill from `board.user_id`; set `NOT NULL`. The default keeps `user_id` optional in the generated `Insert` type, so existing typed inserts compile unchanged.
- `BEFORE INSERT OR UPDATE OF board_id, user_id` trigger (`SECURITY INVOKER`, `SET search_path = pg_catalog, public`) always overwrites `user_id` from the board and raises when the board is not found. No call site or RPC passes `user_id`, and no client can set it.
- No merge logic and no deletes. The one existing duplicate is removed by its owner in the UI before the production migration job is approved.
- `CREATE UNIQUE INDEX repocard_unique_repo_per_user ON repocard (user_id, lower(repo_owner), lower(repo_name))`. The name `unique_repo_per_user` is already taken by the `maintenance` constraint.
- Keep `unique_repo_per_board`. It is redundant after the new index but harmless, and rollback stays a plain drop of the new objects.
- Regenerate Supabase types.

### 3. Server actions (`src/lib/actions/repo-cards.ts`)

- `addRepositoriesToBoard`: dedup against every board of the user plus maintenance. One query replaces the current per-board query: `repocard` joined with `board!inner(user_id, name)`, filtered on `board.user_id = claims.sub`; `owner/name` is compared lowercased in JS (no `ilike`). Report each skipped repo by name with where it lives.
- Expected errors: add `ActionUserError` (an `Error` subclass) to `src/lib/actions/types.ts`. `withAuthResult` and `withAuthResultRateLimit` in `src/lib/actions/auth-guard.ts` return its message verbatim and do not send it to Sentry; every other error keeps the generic message. Only the duplicate messages listed below use it.
- `restoreToBoard`: reject when the repo is on any board; error names the board.
- `moveCardToBoard`: keep the target-board duplicate check. It still matters on the old schema while a legacy duplicate exists.
- Map any Postgres `23505` from the three paths (insert, `restore_to_board`, `move_card_to_board`) to one friendly error, without matching on the constraint name. Covers the check-then-insert race on both schemas.

### 4. UI

- The picker loads the user's repo placements through a server action each time it opens (see the eng amendments). The board page and the Redux `board` slice are not changed.
- `AddRepositoryCombobox`: repos on another board are shown as not selectable with an "On <board name>" label instead of staying selectable, so the user sees why the repo can't be added and can open the board that holds it.
- `RestoreToBoardDialog` and `MoveToAnotherBoardDialog` already render the action's `error` inline. Today the auth guards replace every thrown message with `An unexpected error occurred`, so step 3 adds a pass-through for expected errors.

### 5. Tests

- Unit (Vitest): the pure helper that splits requested repos into addable and held (this board, another board, maintenance; case-insensitive); the `23505` mapper; the combobox renders a repo held by another board as not selectable, with the board label and the control that opens the holding board.
- E2E (Playwright, fixture DB; `move-to-another-board.spec.ts` already proves DB mutations work in test mode): a repo held by another board shows as not selectable with its board label in the picker, and its control opens the holding board; after moving a card to another board the picker on the source board shows it as held without a reload; move-to-another-board still works and keeps `projectinfo`.
- DB (through `e2e/helpers/db-query.ts` against local Supabase): a second card for the same repo on another board of the same user is rejected with `23505`, also when only the letter case differs; the same repo on another user's board is accepted.
- Migration guard (manual, recorded in the PR; seed runs after migrations so `pnpm db:reset` cannot exercise it): on a local DB at the previous migration, insert a second card for an existing repo on another board, apply the new migration and expect the guard's exception with no schema change; delete that card, apply again and expect success.
- Fixtures: `supabase/seed.sql` gains a second user who owns one public board holding `testuser/test-repo` and `testuser/private-project`. `resetRepoCards` in `e2e/helpers/db-query.ts` deletes cards on every board of the test user, not only Test Board.

### 6. Docs

- `SPEC.md` and `CLAUDE.md` schema notes: repo uniqueness is per user, not per board.
- `TODOS.md`: add the four deferred items (one-click "Move here" from the picker; DB-level board/maintenance exclusion; repo search in the command palette; identity by GitHub repo id).

## Rollout

Migration ships through `.github/workflows/supabase-production.yml` on merge to `main` (approval required). Vercel deploys on merge while the migration waits for approval, so the app must work on both schemas.

## Open questions

- Existing cross-board duplicates in production: answered. One group, the owner's own; the owner picks which card to keep. No automatic merge.
- Board and maintenance exclusivity in the DB: answered. Stays app-enforced in this plan; DB enforcement is deferred to TODOS.md.

<!-- autoplan-accepted:ceo -->

- CEO review amendments (revision 6: after the production audit, spec reviews 1 to 3, both CEO voices and the section review).
- Alternatives considered: (a) restriction, one card per user and repo, chosen because issue #215 asks for it and a board column is the repo's status, so two placements mean two statuses; (b) shared `projectinfo` keyed by user and repo with several placements, not chosen, would allow one repo on a private and a public board at once. `repocard.user_id` is groundwork for either, so (b) stays possible later.
- Duplicate policy: the migration never merges or deletes cards. Its guard blocks the production run until the owner has removed the extra card of the one existing duplicate group in the UI. Which card survives is the owner's choice.
- Audit scope: the audit also counts, per run, repos that are both on a board and in `maintenance`, and case-variant duplicates. All audit and verification queries return counts only.
- Module placement: the pure split helper, the `23505` mapper and the lookup helper (it takes the Supabase client and user id as arguments) live in a new `src/lib/actions/repo-card-duplicates.ts` without the `'use server'` directive, like `mappers.ts` and `shared-project-info.ts`. `repo-cards.ts` and `board-data.ts` keep only the action wrappers, so no sync function is exported from a `'use server'` file and the lookup never becomes a client-callable action.
- Shared lookup: `addRepositoriesToBoard` and `restoreToBoard` use one helper that loads the user's cards with their board ids and names (`board!inner(id, user_id, name)`, filtered on `board.user_id = claims.sub`) and matches `owner/name` lowercased in JS. The page-level fetch of other-board repos uses the same query shape. The maintenance comparison is lowercased too.
- Owner filter: RLS alone is not enough for these lookups, because the policy "Anyone can view public board repo cards" returns other users' public cards. Verify (E2E): with the seeded second user's public board holding `testuser/private-project`, the picker on Test Board still offers that repo as selectable with no `On ...` label.
- Schema-order tolerance: app code reads ownership and the board name through the `board` join and never selects or writes `repocard.user_id`, so the same build runs before and after the migration.
- Expected-error pass-through verification (Vitest): a thrown `ActionUserError` reaches the caller as `{ success: false, error: <its message> }` and Sentry is not called; a plain `Error` still returns `An unexpected error occurred` and is sent to Sentry.
- Commit order: `ActionUserError` and the guard pass-through land as their own commit before the feature commit.
- `addRepositoriesToBoard` result texts, one sentence per skipped repo in `duplicateWarnings`: `owner/name is already on this board`, `owner/name is already on board "<board name>"`, `owner/name is in Maintenance`. When every requested repo is skipped the action fails with an `ActionUserError` carrying those sentences joined by `; `.
- `restoreToBoard` rejects with `ActionUserError`: `owner/name is already on board "<board name>"`.
- `moveCardToBoard` throws its existing text `Repository already exists in target board` as an `ActionUserError`, so the dialog finally shows it.
- Race text for any `23505` in the three paths, thrown as `ActionUserError`: `A selected repository is already on a board. Reload and try again.` The batch insert is atomic, so nothing is added when it fires.
- Repo identity groundwork: `addRepositoriesToBoard` also stores the GitHub repository id as `meta.githubId` on every new card. No schema change and nothing reads it yet; it shrinks the later backfill for rename-safe identity.
- Page data: the board page loads, in the existing `Promise.all`, the user's repos that sit on other boards as `{ identifier, boardId, boardName }` (lowercase `owner/name`). Only the user's own boards are included.
- Client state: the other-board set lives in the Redux `board` slice. It is dispatched in the existing hydration `useLayoutEffect` in `BoardPageClient.tsx`, so server data overwrites any copy restored from localStorage on every page load.
- Persisted-state safety: the `board` slice is restored from localStorage by a shallow merge, so a copy saved before this release has no other-board key. The selector returns an empty list when the key is missing; no storage `version` bump (a bump without `migrate` would wipe saved theme settings and drafts). Verify (Vitest): with a preloaded `board` state lacking the key, the selector returns `[]` and the picker renders.
- Client freshness after a move: `MoveToAnotherBoardDialog`'s `onMoved` becomes `(cardId, targetBoardId, targetBoardName)`. The board page handler reads the card's `owner/name` from the store before removing it and adds `{ identifier, boardId: targetBoardId, boardName: targetBoardName }` to the other-board set, so the picker shows the repo as held without a reload. Removing a card needs no change.
- Picker rendering: a repo held by another board is never a selectable option. The picker shows where it lives (`On <board name>`) and offers a keyboard-reachable control that opens that board (`/board/<boardId>`). The control sits outside any `role="option"` element. Search still matches these repos. Layout is settled in design review. Verify (E2E): the held repo cannot be selected, and activating the control lands on the holding board.
- One-click "Move here" from the picker stays deferred to TODOS.md.
- Removal confirmation copy (`OverflowMenu.tsx`): the dialog states that the card's note, links and comment are deleted with it, instead of only "You can always add it back later".
- E2E fixture for "held by another board": the test inserts a card for `testuser/private-project` on Work Projects through `e2e/helpers/db-query.ts` before opening the picker on Test Board, and deletes it afterwards. The widened `resetRepoCards` also clears it, so a crashed test cannot block later specs.
- DB tests (through `e2e/helpers/db-query.ts`, service role): a second card for the same repo on another board of the same user fails with `23505`, also when only the letter case differs; the seeded second user holding `testuser/test-repo` proves the same repo coexists across users (the seed itself fails if it does not); an insert carrying a forged `user_id` stores the board owner's id; `UPDATE repocard SET user_id = <other user>` leaves the owner's id in place; an update that only changes `order` succeeds.
- Page fetch failure: when the other-board fetch fails it behaves like `getUserMaintenanceRepoIdentifiers` on failure and the page still renders; the picker then offers those repos and the server check rejects the add with the sentence above.
- Race visibility: because `ActionUserError` skips Sentry, the `23505` path writes one structured warning through the existing logger (action name, user id, no repo names) before throwing, so the frequency of the race stays observable.
- Re-runnable migration: every statement after the guard can run twice without error (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER`, `CREATE UNIQUE INDEX IF NOT EXISTS`), so a partial apply is recoverable regardless of how the CLI wraps the file in a transaction.
- Row cap: the lookup can truncate at PostgREST `max_rows` (1000) for a user with more than 1000 cards. The unique index is the backstop and the race text is what that user sees. No extra handling.
- Regenerate `src/lib/supabase/database.types.ts` after the migration; fix any test fixture that builds a full `repocard` row.
- Rollout order: (1) merge; Vercel deploys and the app-level checks stop new duplicates on the old schema. (2) The owner copies anything worth keeping (links, note, comment) from the card they will remove into the card they keep, then removes the extra card. Removing a card deletes its `projectinfo`. (3) Re-run the count-only audit on production and expect 0. (4) The owner approves the `production` environment job; the guard passes and the index is created. (5) Re-run the count-only audit and expect 0; record it in the PR.
- If the guard still raises (job approved too early, or a new duplicate slipped in through a two-tab race before the index existed), the transaction rolls back and the app keeps working. List the offending card ids and board ids with the service role (ids only, no repo names), remove the extra card with its owner's agreement, and re-run the job.
- Rollback: a new migration that drops `repocard_unique_repo_per_user`, the trigger, its function and `repocard.user_id`. App code needs no revert.

<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->

- Design review amendments. Three earlier items are replaced here: the `addRepositoriesToBoard` result texts and all-skipped failure (now structured `skipped`, below), the single race text (now two texts, below), and the page-data tuple (now carries `cardId`, below).
- Picker structure: the existing `role="listbox"` keeps addable repos only. Repos placed elsewhere render in a sibling `<ul aria-label="Already placed elsewhere">` after the listbox, inside the same panel, under a small heading `Already placed elsewhere (N)`. The list is not virtualized and scrolls on its own above `max-h-40`. Nothing is rendered when N is 0.
- What counts as placed elsewhere: catalog repos on another board of the user (`On <board name>`, links to `/board/<boardId>`) and catalog repos in maintenance (`In Maintenance`, links to `/maintenance`). Repos on the current board stay hidden as today.
- Held row anatomy: two lines. Line 1 is `owner/name` in `text-muted-foreground`, truncated. Line 2 is a `next/link` with the label and a trailing arrow icon, styled `text-primary` with underline on hover, truncated with `title` set to the full label. No description, stars or language. No hover background and no `cursor-pointer` on the row. Row min height 44px. The link shows a `focus-visible` ring. Semantic theme tokens only; no hard-coded colors.
- Accessible names: `Open board <board name>, which holds owner/name` and `Open Maintenance, which holds owner/name`.
- Filtering: the search query, the organization filter and the visibility filter apply to the held list exactly as to the options. Held repos never enter the selection or the selected count. One row per repo; if two cards hold the same repo before the migration, the first wins.
- Keyboard: Enter and Space on a held-row link stop propagation, so the panel's Enter-to-add handler cannot fire from a link. The link navigates in the same tab and any pending selection is dropped. Existing option key handling is unchanged.
- Empty states: `No repositories found matching "<query>"` renders only when both lists are empty and a query exists. When there are no addable repos but held rows exist, the line `No repositories to add. The ones below are already placed.` renders above the held list. When both lists are empty with no query and the catalog loaded without error, the line `No repositories left to add.` renders.
- Add result shape: `addRepositoriesToBoard` returns `skipped: Array<{ fullName, reason: 'this-board' | 'other-board' | 'maintenance', message, boardId?, boardName?, cardId? }>` in place of `duplicateWarnings`. `message` is the sentence defined earlier for that reason. When every requested repo is skipped the action returns success with `addedCount: 0` and the `skipped` list; it does not throw.
- Add result handling in the picker: every `other-board` entry in `skipped` is upserted into the other-board set. Some added and some skipped: one toast titled `<N> added, <M> skipped` with one sentence per line, and the picker closes as today. All added: the existing success toast, with its text built from the created cards instead of `selectedRepos[0]`. None added: no toast, the picker stays open, the skipped repos leave the selection, a neutral notice (not the red alert, no `Error:` prefix) lists the sentences, and the repos appear in the held list.
- Race texts, passed to the `23505` mapper by the caller. Picker: `Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.` Restore and move dialogs: `owner/name was just placed on a board. Close this dialog and try again.`
- Page data tuple: `{ identifier, boardId, boardName, cardId }`. Nothing reads `cardId` yet; it is groundwork for revealing the card on arrival, which is not in this plan.
- Page fetch failure: the hydration effect dispatches an empty list when the other-board fetch failed, so a persisted set from another board never survives a load.
- Stale data: board names in the held list can be stale until the next page load, and a link to a board deleted in another tab lands on the existing board-not-found page. Accepted.
- Move dialog: the inline action error is cleared when the user changes the target board or the target column.
- Removal confirmation, exact copy: `This removes owner/name from this board and permanently deletes its note, links and comment. Adding the repository again will not restore them. The repository on GitHub is not affected.`
- Copy rule: board names are unquoted in the `On <board name>` label and quoted in sentences.
- Tests added (Vitest, component): a search that matches only a held repo shows its row and no `No repositories found` text; a maintenance repo shows `In Maintenance`; an all-skipped result keeps the picker open, removes the chips and shows the neutral notice; a partial result shows one toast `1 added, 1 skipped`; Enter on a held-row link with a pending selection does not call the add action.
- Storybook: one `AddRepositoryCombobox` story with held rows (one on another board, one in maintenance).
- Deferred to TODOS.md by plan step 6, in addition to the four CEO items: a viewport-aware layout for the picker panel (it is a fixed `w-120` panel today); a separate "Adding" state so submission does not show `Loading repositories...`; Open-board links inside the move and restore dialog errors; revealing and focusing the card on arrival at the holding board.

<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:eng -->

- Eng review amendments. These earlier items are replaced: the CEO items "Page data", "Client state", "Persisted-state safety", "Client freshness after a move" and "Page fetch failure"; the design items "Page data tuple" and "Page fetch failure"; and the design sentence that upserts `other-board` entries from `skipped` into an other-board set. Also replaced: the CEO sentence that a page-level fetch shares the lookup query shape (there is no page-level fetch), the CEO row-cap item ending in "No extra handling" (see the row cap item below), and in the design item on stale data "until the next page load" now reads "until the picker is next opened". `cardId` is dropped from every shape. `MoveToAnotherBoardDialog`'s `onMoved`, `BoardPageClient.tsx`, `page.tsx` and the Redux `board` slice are not changed by this plan.
- Placement transport: a new read action `getUserRepoPlacements()` in `src/lib/actions/board-data.ts` (wrapped in `withAuthResult`) returns `{ boards: Array<{ identifier, boardId, boardName }>, maintenance: RepoIdentifier[] }`, built by the shared lookup helper in `repo-card-duplicates.ts`. The picker calls it every time it opens, in parallel with the catalog load, and again after any add result that contains `skipped`. Fresh on every open, so back and forward navigation cannot show stale placements.
- Hook: a new `useRepoPlacements(isOpen)` in `src/hooks/board/` owns that call and follows the loading pattern of `useRepositoryCatalog`, which itself is not modified.
- Picker classification: hidden means on the current board (live Redux cards plus placements whose `boardId` is the current board); held means placements on other boards plus maintenance; the rest is addable. Options and the held list render only after both the catalog and the placements have settled; until then the existing loading state shows.
- Placement fetch failure: log through the module logger, then render as today (page-supplied maintenance identifiers, no held list). The server check still rejects, and the refetch after a `skipped` result heals the list.
- One lookup function: `addRepositoriesToBoard`, `restoreToBoard` and `getUserRepoPlacements` all call the same exported lookup in `repo-card-duplicates.ts`, so the owner filter exists in exactly one place.
- Mutation lookups fail closed: in `addRepositoriesToBoard` and `restoreToBoard`, an error from the cards lookup or from the maintenance lookup aborts the action with a plain `Error` (generic message, Sentry) before any insert. Today the maintenance lookup error is ignored (`repo-cards.ts:139`). Verify (Vitest, stubbed client): a lookup error throws and the insert is never called.
- Request validation: a Zod schema in `src/lib/validations/` for the `repositories` argument. `owner.login` and `name` match `^[A-Za-z0-9_.-]{1,100}$`, `id` is a positive integer, and the list holds at most `MAX_REPOSITORIES_PER_ADD` (100, in the constants file) entries. Invalid input throws before any query. Verify (Vitest): script-bearing names, an oversized list and a non-integer id are rejected.
- Request dedupe: the split helper dedupes the request by lowercased `owner/name`, first entry wins, so a batch cannot collide with itself. Verify (Vitest).
- `meta.githubId` is an untrusted client hint. Any later identity backfill must re-verify it against GitHub; a code comment on the insert says so.
- Enter guard: the panel's Enter-to-add handler does nothing while an add is in flight.
- Held-row links set `prefetch={false}`.
- Row cap: when the lookup returns 1000 rows, send one Sentry warning, as `getBoardBundle` does. Pagination is deferred.
- Migration atomicity: the whole migration body is one `DO $migration$ ... $migration$` statement, so it is atomic without relying on how the CLI wraps the file. The `IF NOT EXISTS` forms stay. The trigger function body uses a different dollar-quote tag.
- Backfill: `UPDATE repocard ... WHERE user_id IS NULL`, with `ALTER TABLE repocard DISABLE TRIGGER USER` before and `ENABLE TRIGGER USER` after, so `update_repocard_updated_at` does not rewrite every card's `updated_at`.
- Manual migration checks, recorded in the PR (extends the guard test): (a) with a duplicate present the guard raises and the schema is unchanged; (b) a copy of the migration with a failing statement appended inside the block leaves the schema unchanged; (c) after success there are zero rows where `repocard.user_id` differs from `board.user_id`, existing rows keep their `updated_at`, the column is `NOT NULL` with its default, and the trigger and the index exist; (d) running the file a second time succeeds and changes nothing.
- Old-schema smoke, manual, recorded in the PR: reset the local DB to the previous migration and run the add, move and restore E2E specs against the new build.
- E2E, server skip: open the picker on Test Board, then insert `testuser/private-project` on Work Projects through `db-query.ts`, select it and click Add. Expect the neutral notice with the sentence, the repo in the held list as `On Work Projects`, and no new card on Test Board.
- E2E, restore rejection: place a maintenance item's repo on a board through `db-query.ts`, try to restore it, expect the inline error naming that board and the maintenance item still present.
- E2E, owner independence: the test first asserts that the second user's board and both of its cards exist, then adds `testuser/private-project` to Test Board and expects success.
- E2E, back navigation: follow a held link to Work Projects, remove the card there, go Back, open the picker and expect the repo to be addable.
- DB tests, added to the earlier list: `restore_to_board` and `move_card_to_board` fail with `23505` on a duplicate; with an authenticated client built from the test JWT the app uses, an insert into the second user's public board fails with `42501`.
- Component tests render the real `AddRepositoryCombobox` with the store provider and mocked catalog, placements and add actions, as `AddRepositoryCombobox.refresh.test.tsx` already does. The older mock-component test file is left alone.
- `resetRepoCards` looks up every board owned by the test user by `user_id` and deletes their cards, instead of a fixed board list.
- Race log: the structured warning also carries the violated constraint name parsed from the Postgres error. Still no repo names.
- Wording: on the old schema the app-level checks are best-effort; a two-tab race can still create a duplicate until the index exists, which is what the guard fallback is for.
- Deferred to TODOS.md by plan step 6, in addition to the earlier items: paginate the placement lookup beyond 1000 rows; make `scripts/e2e-parallel.sh` and the shard restore fail on seed errors; pin the Supabase CLI version in the production workflow; correct the comments in `e2e/auth.setup.ts` and `CLAUDE.md` that say fixture auth cannot mutate.

<!-- /autoplan-accepted:eng -->

## Review record

### Phase 0: intake

- Restore point: `.gstack/tmp/autoplan/main-autoplan-restore-20261011-000642.md`. Base branch `main`. No design doc; `/office-hours` offered and skipped by the user (D1).
- UI scope: yes (combobox, dialog, disabled option, label). DX scope: no (`scope` hash `d63ae7ce…9558`, 1 match `action`, threshold 2; product is an end-user PWA).
- Outside reviewer: Codex, `CODEX_MODE: ready`.
- CEO methodology read: `autoplan-ceo-methodology-hzSuFk/methodology.md` ranges 1-600, 601-1200, 1201-1800, 1801-2400, 2401-2484 of 2484 lines (EOF).

### Phase 1: CEO review (mode: SELECTIVE EXPANSION, /autoplan override)

#### System audit

- `main` is clean against base; 3 `lint-staged` stashes, unrelated. No open PRs. No TODO/FIXME in the files this plan touches.
- Hot files (30d): `AddRepositoryCombobox.tsx`, `useRepositoryCatalog.ts` (v0.3.3.0 picker re-auth fix). This plan edits the same combobox, so its e2e specs are the regression surface.
- TODOS.md overlap: "401 interceptor races" and "rapid combobox open/close" (#180, #181) touch the same picker but not the dedup logic. Not blocked by, not blocking.
- Prior learning applied: `server-actions-inherit-route-config` (confidence 8/10, 2026-05-25). `addRepositoriesToBoard` and `moveCardToBoard` already run about 5 sequential DB waves; the cross-board check must replace a wave, not add one.
- Prior learning applied: `toPass-locator-hang-on-unmount` (8/10, 2026-08-25). New combobox e2e assertions use web-first assertions on a deterministic end state, never count-then-iterate.
- Taste calibration. Good: `move_card_to_board` RPC (atomic, `SECURITY INVOKER`, guards TOCTOU); `maintenance.unique_repo_per_user` (user-wide uniqueness already expressed as a constraint). Avoid: check-then-insert dedup in `addRepositoriesToBoard` with no constraint behind it for the cross-board case.
- Landscape (Aside not installed; one web search). [Layer 1] one item, one home, enforced by a unique constraint. [Layer 2] Trello and Kanban Zone ship "mirror cards": one card visible on several boards, edits synced. [Layer 3] In GitBox a board column is the repo's status. A mirrored repo would carry two statuses at once, which is the same "which one is current" confusion in a different field. Restriction fits this product better than mirroring. No eureka.

#### 0A. Premise challenge

| #   | Premise                                                           | Verdict                                                                                                                                             |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Diverging `projectinfo` across boards is the real pain            | Valid. Each card has its own `projectinfo` row (`repo_card_id UNIQUE`), so two cards cannot share notes or links. Stated by the owner in the issue. |
| P2  | Restriction (one card per repo) is the right fix, not shared data | Accepted. Mirroring keeps multi-board placement but leaves two statuses per repo. The issue asks for restriction.                                   |
| P3  | Uniqueness is per user, not global                                | Valid. A global constraint would leak which repos other users track. `maintenance` already scopes by `user_id`.                                     |
| P4  | Production may hold cross-board duplicates today                  | Unknown until step 1 runs. Drives the size of the migration.                                                                                        |
| P5  | `repocard.user_id` is needed                                      | Valid. A unique index cannot span `repocard` and `board`; the owner must live on the row.                                                           |

Do-nothing cost: every repo on two boards keeps forking its notes and links, and nothing in the product tells the user. The plan fixes the pain directly, not a proxy.

#### 0B. Existing code leverage

| Sub-problem          | Existing code                                                                             | Reuse                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| User-wide uniqueness | `maintenance.unique_repo_per_user`                                                        | Same shape for `repocard`                                        |
| Atomic card moves    | `move_card_to_board`, `restore_to_board` RPCs                                             | Unchanged; the new index guards them                             |
| Server dedup         | `addRepositoriesToBoard` existing-card + maintenance set (`repo-cards.ts:123-152`)        | Widen the first query from one board to all of the user's boards |
| Client filter        | `existingRepoIdentifiers`, `maintenanceIdentifiers` (`AddRepositoryCombobox.tsx:149-168`) | Third set for other boards, same lowercase key                   |
| Page prefetch        | `getUserMaintenanceRepoIdentifiers` (`board-data.ts:77`)                                  | Sibling fetch in the same `Promise.all`                          |
| Inline dialog errors | `MoveToAnotherBoardDialog` and `RestoreToBoardDialog` both already render `error`         | Nothing to build; only the message text changes                  |

#### 0C. Dream state

```
CURRENT                         THIS PLAN                          12-MONTH IDEAL
repo on N boards, N copies -->  one card per repo per user,   -->  one repo record keyed by GitHub repo id,
of notes/links, no warning      DB-enforced, UI says where it      survives renames/transfers, searchable
                                already lives                      from the command palette
```

#### 0D. Approach (auto-decided)

|              | A) Plan as written                                | B) App-level checks only                        | C) Mirror model                                         |
| ------------ | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Mechanism    | `repocard.user_id` + unique index + action checks | Widen the three action checks, no schema change | `projectinfo` keyed by (user, repo), cards reference it |
| Race safety  | DB rejects the second insert                      | Two tabs can still double-add                   | n/a                                                     |
| Effort       | M                                                 | S                                               | L                                                       |
| Completeness | 10                                                | 5                                               | differs in kind                                         |

Decision CEO-A1: A. P1 (completeness) and the reuse ladder (DB constraint over app code). C would change the direction stated in the issue.

#### 0E. Mode

SELECTIVE EXPANSION per /autoplan override. Estimated 16 changed files (1 migration, 6 source, 5 test, 2 fixture, 2 docs). Added capability on an existing system. No question asked; no question log.

#### 0F/0G. Hold-scope checks and cherry-picks

- Complexity: 16 files, 0 new services, 1 new SQL trigger function. Over the 8-file line only because of tests, fixtures and docs. Core is 1 migration + 1 actions file + 1 component. No reduction proposed.
- Minimum for the goal: steps 2 and 3. Step 4 (UI) is what stops the feature from feeling like a bug ("where did my repo go?"), so it stays.
- 10x ambition: repo identity by GitHub repo id with one record across boards, maintenance and renames. Out of reach for this issue; recorded as CEO-S6.

| ID     | Proposal                                                        | Effort | Risk   | Decision                                | Principle                                                               |
| ------ | --------------------------------------------------------------- | ------ | ------ | --------------------------------------- | ----------------------------------------------------------------------- |
| CEO-S1 | "On <board>" label links to the board that holds the repo       | S      | low    | DEFERRED (reversed after spec review 1) | P5: a link inside `role="option"` is invalid nesting; plain label stays |
| CEO-S2 | One-click "Move here" from the combobox                         | M      | medium | DEFERRED (taste)                        | P4: duplicates the existing Move dialog path                            |
| CEO-S3 | DB-enforced exclusion between "on a board" and "in maintenance" | S-M    | medium | DEFERRED (taste); audit count ACCEPTED  | P3: needs its own data cleanup; app check already exists                |
| CEO-S4 | Find-repo search in the command palette                         | M      | low    | DEFERRED                                | Outside blast radius                                                    |
| CEO-S5 | Backup table for every row the dedup merge deletes              | S      | low    | SKIPPED (reversed after audit)          | No merge ships, nothing is deleted                                      |
| CEO-S6 | Key uniqueness on GitHub repo id (rename/transfer safe)         | L      | medium | DEFERRED                                | Outside blast radius; needs backfill from GitHub                        |
| CEO-S7 | Post-migration verification query on production                 | S      | low    | ACCEPTED                                | P1                                                                      |

Open question 1 (merge automatically vs let the user pick): the production audit ran on 2026-10-11 (read-only, counts only): 1 cross-board duplicate group, in the owner's own account; 0 board/maintenance overlaps; 0 case-variant duplicates; 22 cards, 2 users. Decision CEO-Q1 (revised): no automatic merge. The migration carries a guard and the owner removes the extra card by hand before approving the production job. Non-destructive, and the choice of surviving card stays with the owner. Surfaced at the final gate as a taste decision.

Open question 2 (board vs maintenance exclusivity in the DB): CEO-S3, deferred, surfaced at the final gate.

#### Decision ledger (CEO)

| ID and owner | Contract and evidence                                                                                                 | Current                                                                      | Proposed                         | Status                                                  | Exact approval and scope                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| CEO-A1 (0D)  | Enforce one card per (user, repo) in the DB. Evidence: `unique_repo_per_board` is per board; index cannot span tables | Approach A                                                                   | none                             | approved                                                | /autoplan auto-decision, P1; plan steps 2-3 as written |
| CEO-S1 (0G)  | Disabled option tells the user where the repo lives                                                                   | Plain text label `On <board name>`                                           | Link to the board                | deferred (reopened by spec review 1, finding Clarity 3) | auto, P5; TODOS.md on approval                         |
| CEO-S2 (0G)  | Move from combobox                                                                                                    | Not in plan                                                                  | Add                              | deferred                                                | auto, P4; TODOS.md on approval                         |
| CEO-S3 (0G)  | Board/maintenance exclusion in DB                                                                                     | App-enforced                                                                 | DB trigger                       | deferred                                                | auto, P3; audit count only is approved                 |
| CEO-S4 (0G)  | Palette repo search                                                                                                   | Not in plan                                                                  | Add                              | deferred                                                | auto; TODOS.md on approval                             |
| CEO-S5 (0G)  | No row is deleted without a copy                                                                                      | No deletes at all                                                            | Backup table                     | declined (reopened by the audit)                        | auto; moot once the merge was removed                  |
| CEO-S6 (0G)  | Rename-safe identity                                                                                                  | owner/name text                                                              | GitHub repo id                   | deferred                                                | auto; TODOS.md on approval                             |
| CEO-S7 (0G)  | Verify zero duplicates after migration                                                                                | Verification query                                                           | none                             | approved                                                | auto, P1; rollout only                                 |
| CEO-Q1 (0G)  | Policy for the one existing duplicate (audit: owner's own)                                                            | Guard only; owner removes the extra card before approving the production job | Automatic merge in the migration | approved (taste)                                        | auto, conservative non-destructive choice; final gate  |

#### 0H. Spec Review Loop

- CEO scope summary: `~/.gstack/projects/laststance-gitbox/ceo-plans/2026-10-11-one-repo-across-boards.md`.
- Review 1 (input `autoplan-ceo-U47JBo`, sha `1e3206a2…e2d3`): prior review score 4/10, FAIL, 17 issues. 15 accepted and applied in revision 2. 2 rejected with evidence:
  - "e2e cannot verify server mutations": `e2e/logged-in/move-to-another-board.spec.ts:124-176` moves a card through the UI and asserts the DB row, so mutations do run in test mode.
  - "restore while on a board is unreachable": reachable through a legacy duplicate or a two-tab race, so the server check stays.
- Applied from review 1: trigger fires on `UPDATE OF board_id, user_id` (closes a forged-owner hole); index renamed to `repocard_unique_repo_per_user` (name clash with the maintenance constraint); `DEFAULT auth.uid()` keeps the generated `Insert` type compatible; count-only audit SQL; guard runs before the index; move check kept for the old schema; `23505` mapped without matching a constraint name; exact user-facing texts; lookup method fixed (`board!inner`, lowercase in JS); client set updated after a move; link withdrawn (CEO-S1); migration-guard test made manual because seed runs after migrations; tautological "with and without `user_id`" tests dropped; already-implemented dialog work removed.
- Review 2 input: `autoplan-ceo-DxnGtC`, sha `02b813d4…1182`.
- Review 2 result: prior review score 5/10, FAIL, 10 issues, none repeated from review 1. All 10 applied in revision 3. The largest: `withAuthResultRateLimit` replaces every thrown message with `An unexpected error occurred` (`auth-guard.ts:66-68, 113-117`), so no duplicate message could reach the dialogs. Fix: `ActionUserError` pass-through.
- Review 3 (input `autoplan-ceo-qRBzzx`, sha `d419aaf5…a7d8`): score 7/10. Consistency, Scope and Feasibility PASS. 2 issues: the persisted `board` slice lacks the new key for returning users on first render; no module was named for the new sync helpers, which cannot be exported from a `'use server'` file. Both applied in revision 4 (input `autoplan-ceo-We3e5O`, sha `d0bcf378…03a2`). Loop stopped at the three-launch cap; the two revision-4 fixes are not reviewer-confirmed and are carried to the eng phase.
- Metrics: 3 launches, 29 issues found, 25 reviewer-confirmed fixed, 2 remaining at the last review (fixed afterwards, unconfirmed), latest score 7.
- Document approval (admin question, auto A under /autoplan): both documents reflect the decisions above.

#### 0I. Temporal interrogation

```
HOUR 1 (foundations)   Migration statement order: guard, column + default, backfill, NOT NULL, trigger, index.
                       'use server' files export async functions only; helpers go to repo-card-duplicates.ts.
                       The auth guards flatten every thrown message; ActionUserError is the only way through.
HOUR 2-3 (core logic)  PostgREST embed filter: .select('..., board:board_id!inner(user_id, name)').eq('board.user_id', sub).
                       Unique violations surface as error.code === '23505' for both table inserts and RPCs.
                       Batch insert is atomic: one racing duplicate fails the whole batch.
HOUR 4-5 (integration) Returning users restore a board slice without the new key: selector must default to [].
                       The picker's keyboard navigation must skip disabled options.
                       E2E shards are pg_dump clones of the seeded DB, so the second user must be in seed.sql.
HOUR 6+ (polish/tests) Regenerate database.types.ts; fix fixtures that build full repocard rows.
                       resetRepoCards must clear every board of the test user or leftovers block later specs.
```

Effort: human team about 2 days / CC + gstack about 90 minutes. Feasibility blockers: none. Pending choices: none inside CEO scope; picker visual treatment goes to design review.

#### 0.5 Dual voices (input `autoplan-ceo-RWwWs2`, sha `d0bcf378…03a2`)

**Claude CEO subagent** (completed, INPUT hash matched): 7 findings. F1 high: shared `projectinfo` never compared against restriction. F2 high: the only real duplicate is the owner's own, so "no legitimate multi-placement" is an untested premise; public + private board for one repo becomes impossible. F3 medium: picker shows the block but gives no way forward. F4 medium: identity stays `owner/name`; store the GitHub id now. F5 medium: `ActionUserError` rides along; split it; add a success criterion. F6 medium: board vs maintenance not DB-enforced; say so in the Goal. F7 low: direction runs against mirror/multi-view trend.

**Codex CEO voice** (completed, `gpt-6-astra`, `OUTSIDE_STATUS: completed`, verdict `findings`, P1): 5 findings. 1 High: metadata problem turned into a placement restriction; conflicts with public boards. 2 High: the manual cleanup deletes a card and its `projectinfo` (`ON DELETE CASCADE`), and the removal dialog says "You can always add it back later". 3 High: deferring repo identity leaves the invariant as "one lowercased name", not "one repo". 4 Medium: disabled option ends the user's task; give an action outside the listbox. 5 Medium: board + maintenance race remains.

```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                             Claude    Codex     Consensus
  1. Premises valid?                    partly    no        CONFIRMED concern (multi-placement premise untested)
  2. Right problem to solve?            yes/fix?  reframe   CONFIRMED concern -> User Challenge 1
  3. Scope calibration correct?         gaps      gaps      CONFIRMED (recovery path, identity groundwork added)
  4. Alternatives sufficiently explored? no       no        CONFIRMED (alternatives now recorded in the plan)
  5. Competitive/market risks covered?  low risk  medium    DISAGREE (taste: low, single-owner product)
  6. 6-month trajectory sound?          gaps      gaps      CONFIRMED (identity, maintenance exclusivity)
```

Dispositions:

| Finding                                                  | Voices | Disposition                                                                                                                                                         |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reframe to shared `projectinfo` with multiple placements | both   | USER CHALLENGE 1. Not auto-decided. The issue's direction (restriction) stands; alternatives are now written into the plan.                                         |
| No recovery path from the picker                         | both   | Applied: keyboard-reachable control that opens the holding board, outside `role="option"`; page data carries `boardId`. Reopens CEO-S1 as accepted in a valid form. |
| Repo identity deferred                                   | both   | Applied in part: store `meta.githubId` on insert; Goal now states identity is `owner/name`. Index on GitHub id stays deferred (CEO-S6).                             |
| Board vs maintenance not DB-enforced                     | both   | Applied in part: Goal states it is app-enforced. DB enforcement stays deferred (CEO-S3, taste).                                                                     |
| Manual cleanup deletes `projectinfo`                     | Codex  | Applied: rollout step tells the owner to copy links, note and comment first; removal dialog copy states what is deleted.                                            |
| Split `ActionUserError`, add success criterion           | Claude | Applied: own commit; success line in the Goal.                                                                                                                      |
| Ask the owner whether the duplicate was intentional      | Claude | Folded into User Challenge 1.                                                                                                                                       |

#### Review sections

Current scope: mode SELECTIVE EXPANSION (override). Accepted: CEO-A1, CEO-S1 (reopened, valid form), CEO-S7, CEO-Q1 (guard only), `meta.githubId`, removal copy. Deferred: CEO-S2, CEO-S3, CEO-S4, CEO-S6. Declined: CEO-S5. Pending: User Challenge 1 (final gate).

**Section 1: Architecture.** 3 findings, all applied.

```
Browser
  AddRepositoryCombobox <--reads-- Redux board slice { repoCards, otherBoardRepos }
     | submit                         ^ hydrate in useLayoutEffect      ^ after a move
     v                                |                                 |
  addRepositoriesToBoard         BoardPage (RSC) Promise.all       MoveToAnotherBoardDialog
  restoreToBoard                   getBoardBundle                    onMoved(cardId, boardId, boardName)
  moveCardToBoard                  getUserMaintenanceRepoIdentifiers
     |                             getUserOtherBoardRepos (new)
     v                                |
  repo-card-duplicates.ts (new, no 'use server')
     findUserRepoPlacements(supabase, userId)   splitRequestedRepos()   toDuplicateError()
     |
     v  PostgREST: repocard + board!inner(id, user_id, name), board.user_id = sub
  Postgres
     repocard --BEFORE INSERT OR UPDATE OF board_id, user_id--> set_repocard_user_id()
     UNIQUE INDEX repocard_unique_repo_per_user (user_id, lower(repo_owner), lower(repo_name))
```

Data flow for the other-board set: happy path, server list reaches the slice before first paint. Nil path, persisted slice has no key, selector returns `[]`. Empty path, user has one board, list is empty and the picker looks as it does today. Error path, the fetch fails, the page renders, the server check still rejects (finding 1.1, applied). No new state machine. Coupling added: page to one new fetch, slice gains one field, dialog callback gains two arguments; each is the smallest carrier for its data. Scaling: the lookup reads all of one user's cards; at 100x today's 22 cards it is still one indexed query, and past 1000 rows the unique index is the backstop. No new single point of failure. Finding 1.2: migration atomicity depended on how the CLI wraps the file, applied as re-runnable statements. Finding 1.3: the trigger must not fire on order-only updates or every drag pays a board lookup; the column list `OF board_id, user_id` already guarantees it and a DB test asserts it. Rollback: one new migration, about 5 minutes, no app revert.

**Section 2: Error & Rescue Map.** 9 paths mapped, 0 gaps after amendments. See the registry below. The one real gap found here was already fixed in the spec loop: every thrown message was flattened by the auth guards.

**Section 3: Security.** 4 threats examined, all mitigated by the plan. (1) Forged owner: a client updates `repocard.user_id` to another user's id to dodge the index or block a victim; likelihood low, impact medium; the trigger overwrites it on any write to `board_id` or `user_id`. (2) Cross-user leak through public boards: an unfiltered `repocard` read returns other users' public cards and would leak their board names and block adds; likelihood high without the fix, impact medium; explicit owner filter plus an E2E. (3) Error pass-through as a leak channel: only `ActionUserError` passes, and its messages contain the caller's own repo names and own board names. (4) CI log leak: a failed `CREATE UNIQUE INDEX` prints the key values; the guard runs first and prints a count only. No new secrets, dependencies or endpoints. Repo names in messages render as React text nodes, so no injection.

**Section 4: Data flow and interaction edge cases.** 8 edge cases mapped, 0 unhandled, 1 accepted exception.

```
INPUT repos[] -> split (lowercase match) -> insert batch -> index check -> cards[] + warnings[]
   | empty list      | all held                | 23505               | truncated lookup (>1000)
   v                 v                         v                     v
 button disabled   ActionUserError(sentences)  ActionUserError(race)  index rejects -> race text
```

Ordering, invariant "at most one card per user and repo": tab A looks up (no holder), tab B inserts, tab A inserts. After the migration the index rejects A and the user reads the race text. Before the migration both succeed; that window is covered by the guard fallback. Board vs maintenance: an add can pass the maintenance check while another request archives the card, leaving the repo in both places; this is the accepted exception, stated in the Goal as app-enforced and deferred as CEO-S3.

| Interaction | Edge case                                  | Handled | How                                             |
| ----------- | ------------------------------------------ | ------- | ----------------------------------------------- |
| Add         | double click                               | yes     | submit button disabled while loading (existing) |
| Add         | repo moved to another board in another tab | yes     | server sentence names the board                 |
| Add         | all selected repos held                    | yes     | one sentence per repo, nothing added            |
| Picker      | zero held repos                            | yes     | no extra UI                                     |
| Picker      | many held repos                            | yes     | same scroll container, search filters both      |
| Picker      | open holding board with repos selected     | yes     | plain navigation, selection is dropped          |
| Move        | then reopen picker                         | yes     | slice updated in `onMoved`                      |
| Restore     | repo on a board (legacy duplicate or race) | yes     | sentence names the board                        |

**Section 5: Code quality.** 2 notes for the eng phase, no plan change. `moveCardToBoard` and `moveToMaintenance` cast the embedded board with `as`; the new lookup helper should type the embed through the generated types instead of adding a third cast. The split helper keeps `addRepositoriesToBoard` under 5 branches. Naming follows what the code does: `findUserRepoPlacements`, `splitRequestedRepos`, `toDuplicateError`. No new abstraction beyond one error class and one module.

**Section 6: Tests.** Diagram produced, 0 gaps.

```
NEW THING                               TYPE        HAPPY                      FAILURE / EDGE
splitRequestedRepos                     Vitest      addable vs held            case-variant, empty input, maintenance
toDuplicateError (23505 mapper)         Vitest      23505 -> race text         other code -> rethrown unchanged
ActionUserError pass-through            Vitest      message reaches caller     plain Error stays generic, Sentry called
other-board selector                    Vitest      returns list               key missing in persisted state -> []
picker: held repo                       Vitest+E2E  label + control shown      cannot be selected
picker: owner filter                    E2E         other user's repo selectable
move then reopen picker                 E2E         shows as held, no reload
unique index                            DB          second card rejected       case-variant rejected, other user accepted
trigger                                 DB          forged insert corrected    forged update corrected, order-only update ok
migration guard                         manual      passes when clean          raises with duplicates, schema untouched
```

The 2am test: the DB test that a second card on another board fails with `23505`. The hostile test: forged `user_id` update. The chaos test: guard with a duplicate present. Pyramid is sound: 4 Vitest groups, 4 DB assertions, 3 E2E flows. Flake risk: the E2E inserts its own fixture and the widened reset clears it; assertions are web-first.

**Section 7: Performance.** No issues. `addRepositoriesToBoard` keeps its wave count (the per-user query replaces the per-board one). The page gains one query inside the existing `Promise.all`, so no added latency wave; it filters by `board.user_id`, which the RLS-hardening migration already indexes. The trigger adds one primary-key lookup per insert or cross-board move and nothing on reorder. The functional unique index costs one extra index write per card insert.

**Section 8: Observability.** 1 gap, applied. `ActionUserError` skips Sentry by design, which would hide how often the race fires; the `23505` path now logs one structured warning. The success metric is the count-only audit. No dashboard or alert is warranted for a 2-user product; the runbook is the guard-fallback paragraph.

**Section 9: Deployment.** 2 risks flagged, both covered. (1) App and migration land in either order: the app never touches `repocard.user_id`. (2) The production job is approved while the duplicate still exists: guard raises, nothing changes, re-run later. Table locks are irrelevant at 22 rows. No feature flag: the restriction is the feature and rollback is one migration. Post-deploy check: open a board, open the picker, confirm a repo on another board shows as held; run the count-only audit.

**Section 10: Long-term trajectory.** Reversibility 4/5. Debt: 3 items, all recorded (redundant `unique_repo_per_board`; identity by name; board vs maintenance exclusivity in app code). The `user_id` column makes both futures cheaper: identity by GitHub id and, if the owner ever wants it, shared project info. A new engineer finds the rule in one place, the index name.

**Section 11: Design and UX.** 2 notes passed to the design phase. First thing the user sees in the picker stays the selectable list; held repos must not push it down. The held-repo row needs four states defined: default, hover or focus on the control, search-filtered, and empty (not rendered).

```
open picker -> type to search -> [selectable repos]            -> select -> Add
                              -> [held: "On <board>" + Open]   -> Open -> /board/<id> -> card menu -> Move to Another Board
```

#### What already exists

See 0B. Added during review: `getUserMaintenanceRepoIdentifiers` as the failure-behavior model for the new fetch; `e2e/helpers/db-query.ts` as the DB test harness; `OverflowMenu.tsx` removal dialog (copy change only).

#### NOT in scope

Deferred (written to TODOS.md by plan step 6):

- CEO-S2 one-click "Move here" from the picker. The Open control plus the existing Move dialog covers the task.
- CEO-S3 DB-level exclusion between board and maintenance. Audit shows 0 overlap; needs cross-table locking design.
- CEO-S4 repo search in the command palette. Outside blast radius.
- CEO-S6 uniqueness keyed on GitHub repo id. Needs a backfill from GitHub; `meta.githubId` starts collecting now.

Rejected:

- CEO-S5 backup table. Nothing is deleted by the migration.
- Automatic merge of existing duplicates. The only duplicate is the owner's own.
- Dropping `unique_repo_per_board`. Harmless, keeps rollback simple.
- Shared `projectinfo` with multiple placements. Changes the issue's direction; raised as User Challenge 1.

#### Dream state delta

After this plan: one card per user and repo, enforced by the DB between boards, with the picker pointing at the holder. Still missing from the 12-month ideal: identity that survives renames, DB-level exclusivity with maintenance, and repo search from the palette.

#### Error & Rescue Registry

| Codepath                        | What can go wrong    | Class              | Rescued | Rescue action             | User sees                               |
| ------------------------------- | -------------------- | ------------------ | ------- | ------------------------- | --------------------------------------- |
| `addRepositoriesToBoard` lookup | PostgREST error      | `Error`            | yes     | throw, Sentry             | generic error toast                     |
| `addRepositoriesToBoard` split  | every repo held      | `ActionUserError`  | yes     | pass-through              | one sentence per repo                   |
| `addRepositoriesToBoard` insert | `23505` race         | `ActionUserError`  | yes     | warn log, pass-through    | race text                               |
| `addRepositoriesToBoard` insert | other DB error       | `Error`            | yes     | throw, Sentry             | generic error toast                     |
| `restoreToBoard` check          | repo on a board      | `ActionUserError`  | yes     | pass-through              | sentence naming the board, inline       |
| `restore_to_board` RPC          | `23505` race         | `ActionUserError`  | yes     | warn log, pass-through    | race text, inline                       |
| `moveCardToBoard` check         | repo on target board | `ActionUserError`  | yes     | pass-through              | existing text, inline (was hidden)      |
| `move_card_to_board` RPC        | `23505`              | `ActionUserError`  | yes     | warn log, pass-through    | race text, inline                       |
| `getUserOtherBoardRepos`        | PostgREST error      | `Error`            | yes     | same as maintenance fetch | page renders; server check still blocks |
| Trigger                         | board not found      | Postgres exception | yes     | surfaces as DB error      | generic error                           |
| Migration guard                 | duplicate exists     | Postgres exception | yes     | job fails, no change      | owner follows the fallback              |

#### Failure Modes Registry

| Codepath             | Failure mode                        | Rescued              | Test               | User sees               | Logged             |
| -------------------- | ----------------------------------- | -------------------- | ------------------ | ----------------------- | ------------------ |
| add                  | two-tab race after migration        | Y                    | DB + Vitest mapper | race text               | warn               |
| add                  | two-tab race before migration       | Y (guard fallback)   | manual guard test  | duplicate until cleaned | no                 |
| add                  | stale picker (repo moved elsewhere) | Y                    | Vitest split       | sentence naming board   | no                 |
| picker               | persisted slice lacks key           | Y                    | Vitest             | normal picker           | no                 |
| picker               | other user's public card            | Y                    | E2E                | repo stays selectable   | no                 |
| restore              | repo already on a board             | Y                    | Vitest split       | inline sentence         | no                 |
| trigger              | forged `user_id`                    | Y                    | DB                 | nothing                 | no                 |
| migration            | approved before cleanup             | Y                    | manual             | job fails               | CI log, count only |
| board vs maintenance | add races archive                   | N (accepted, CEO-S3) | N                  | repo in both places     | no                 |

Critical gaps: 0. The last row is not silent-critical: it is the documented app-enforced boundary, deferred as CEO-S3.

#### Diagrams

Produced: system architecture (Section 1), data flow with shadow paths (Section 4), user flow (Section 11), test map (Section 6). Deployment sequence and rollback are the numbered rollout items in the plan. No state machine is introduced. Stale diagram audit: no ASCII diagram exists in the touched files.

#### Implementation Tasks (CEO)

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — auth guards — add `ActionUserError` and pass it through `withAuthResult` / `withAuthResultRateLimit`, own commit
  - Surfaced by: spec review 2 Feasibility 1
  - Files: `src/lib/actions/types.ts`, `src/lib/actions/auth-guard.ts`, Vitest case
  - Verify: `pnpm test`
- [ ] **T2 (P1, human: ~4h / CC: ~15min)** — database — migration with guard, `user_id`, trigger, unique index; regenerate types
  - Surfaced by: CEO-A1, spec review 1 Consistency 1 and Feasibility 1-2
  - Files: `supabase/migrations/<ts>_repocard_unique_repo_per_user.sql`, `src/lib/supabase/database.types.ts`
  - Verify: `pnpm db:reset`; manual guard test
- [ ] **T3 (P1, human: ~4h / CC: ~20min)** — server actions — duplicates module, widened checks, messages, `meta.githubId`
  - Surfaced by: CEO-A1, both CEO voices
  - Files: `src/lib/actions/repo-card-duplicates.ts`, `src/lib/actions/repo-cards.ts`, `src/lib/actions/board-data.ts`
  - Verify: `pnpm test`, `pnpm typecheck`
- [ ] **T4 (P1, human: ~6h / CC: ~25min)** — picker and page — other-board data, slice field, held-repo UI with Open control, `onMoved` change, removal copy
  - Surfaced by: both CEO voices (recovery path), spec review 3 Completeness 1
  - Files: `src/app/board/[id]/page.tsx`, `BoardPageClient.tsx`, `src/lib/redux/slices/boardSlice.ts`, `src/components/Board/AddRepositoryCombobox.tsx`, `src/components/Modals/MoveToAnotherBoardDialog.tsx`, `src/components/Board/OverflowMenu.tsx`
  - Verify: `pnpm test`, `pnpm e2e:parallel`
- [ ] **T5 (P1, human: ~4h / CC: ~20min)** — tests and fixtures — second seeded user, widened reset, DB tests, E2E flows
  - Surfaced by: spec review 2 Completeness 1-3
  - Files: `supabase/seed.sql`, `e2e/helpers/db-query.ts`, new specs under `e2e/logged-in/`
  - Verify: `pnpm e2e:parallel`
- [ ] **T6 (P2, human: ~1h / CC: ~5min)** — docs — SPEC.md, CLAUDE.md, TODOS.md
  - Surfaced by: plan step 6
  - Files: `SPEC.md`, `CLAUDE.md`, `TODOS.md`
  - Verify: read-through
- [ ] **T7 (P1, human: ~30min / CC: n/a)** — rollout — owner reconciles and removes the duplicate card, approves the production job, audit returns 0
  - Surfaced by: CEO-Q1, Codex finding 2
  - Files: none
  - Verify: count-only audit on production

#### CEO Completion Summary

```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION (/autoplan override)    |
| System Audit         | clean tree; hot picker files; prod audit: 1 |
|                      | duplicate group (owner's own)               |
| Step 0               | Approach A; 7 proposals; guard-only policy  |
| Section 1  (Arch)    | 3 issues found, 3 applied                   |
| Section 2  (Errors)  | 11 error paths mapped, 0 GAPS               |
| Section 3  (Security)| 4 issues found, 0 High open                 |
| Section 4  (Data/UX) | 8 edge cases mapped, 0 unhandled            |
| Section 5  (Quality) | 2 notes for eng                             |
| Section 6  (Tests)   | Diagram produced, 0 gaps                    |
| Section 7  (Perf)    | 0 issues found                              |
| Section 8  (Observ)  | 1 gap found, applied                        |
| Section 9  (Deploy)  | 2 risks flagged, covered                    |
| Section 10 (Future)  | Reversibility: 4/5, debt items: 3           |
| Section 11 (Design)  | 2 notes passed to design review             |
+--------------------------------------------------------------------+
| NOT in scope         | written (8 items)                           |
| What already exists  | written                                     |
| Dream state delta    | written                                     |
| Error/rescue registry| 11 rows, 0 CRITICAL GAPS                    |
| Failure modes        | 9 total, 0 CRITICAL GAPS                    |
| TODOS.md updates     | 4 items proposed (plan step 6 writes them)  |
| Scope proposals      | 7 proposed, 3 accepted, 4 deferred/declined |
| CEO plan             | written                                     |
| Outside voice        | codex (gpt-6-astra) completed, 5 findings   |
| Lake Score           | 1/1 (0D approach chose the 10/10 option)    |
| Diagrams produced    | 4 (architecture, data flow, user flow, tests)|
| Stale diagrams found | 0                                           |
| Unresolved decisions | 1 (User Challenge 1, final gate)            |
+====================================================================+
```

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"d63ae7ce753e529c1b7b3b4cc6fa1e1255cf70ee198cc80d6f8e22c1a0389558","replacements":[{"oldText":"A user can place a given GitHub repo on at most one board. Enforced in the DB, explained in the UI.","newText":"A user can place a given GitHub repo on at most one board. Board-to-board uniqueness is enforced in the DB. Board versus maintenance exclusivity stays app-enforced. Identity is `owner/name`, case-insensitive; renames and transfers are not tracked yet. The UI explains where a repo already lives and how to get there.\n\nSuccess: the count-only audit on production returns 0 duplicate groups after rollout and stays 0."},{"oldText":"- `AddRepositoryCombobox`: repos on another board render as disabled options with an \"On <board name>\" label instead of vanishing, so the user sees why the repo can't be added.","newText":"- `AddRepositoryCombobox`: repos on another board are shown as not selectable with an \"On <board name>\" label instead of staying selectable, so the user sees why the repo can't be added and can open the board that holds it."},{"oldText":"Count repos that appear on 2+ boards of one user, on local and production. Result decides how much merge logic step 2 needs.","newText":"Count repos that appear on 2+ boards of one user, on local and production. Counts only; never select repo names or user ids.\n\nResult (production, 2026-10-11): 1 cross-board duplicate group, in the repository owner's own account. 0 repos both on a board and in maintenance. 0 case-variant duplicates. 22 cards, 2 users."},{"oldText":"SELECT b.user_id, lower(r.repo_owner), lower(r.repo_name), count(*)\nFROM repocard r JOIN board b ON b.id = r.board_id\nGROUP BY 1, 2, 3 HAVING count(*) > 1;","newText":"SELECT count(*) AS cross_board_duplicate_groups FROM (\n  SELECT 1 FROM repocard r JOIN board b ON b.id = r.board_id\n  GROUP BY b.user_id, lower(r.repo_owner), lower(r.repo_name)\n  HAVING count(*) > 1\n) d;"},{"oldText":"### 2. Migration `<ts>_unique_repo_per_user.sql`","newText":"### 2. Migration `<ts>_repocard_unique_repo_per_user.sql` (one transaction)"},{"oldText":"- Add `repocard.user_id uuid` referencing `auth.users(id) ON DELETE CASCADE`; backfill from `board.user_id`; set `NOT NULL`.","newText":"- Guard, first statement: raise an exception when any `(board.user_id, lower(repo_owner), lower(repo_name))` has more than one card. The message carries the group count only. A failed guard leaves the schema untouched.\n- Add `repocard.user_id uuid DEFAULT auth.uid()` referencing `auth.users(id) ON DELETE CASCADE`; backfill from `board.user_id`; set `NOT NULL`. The default keeps `user_id` optional in the generated `Insert` type, so existing typed inserts compile unchanged."},{"oldText":"- `BEFORE INSERT OR UPDATE OF board_id` trigger sets `user_id` from the board, so no insert call site or RPC has to pass it.","newText":"- `BEFORE INSERT OR UPDATE OF board_id, user_id` trigger (`SECURITY INVOKER`, `SET search_path = pg_catalog, public`) always overwrites `user_id` from the board and raises when the board is not found. No call site or RPC passes `user_id`, and no client can set it."},{"oldText":"- Resolve existing duplicates deterministically before adding the index: keep the oldest card per `(user_id, lower(owner), lower(name))`; merge the others' `projectinfo` into it (union links, join differing notes with a separator, keep first non-empty comment); delete the other cards.\n","newText":"- No merge logic and no deletes. The one existing duplicate is removed by its owner in the UI before the production migration job is approved.\n"},{"oldText":"- `CREATE UNIQUE INDEX unique_repo_per_user ON repocard (user_id, lower(repo_owner), lower(repo_name))`.","newText":"- `CREATE UNIQUE INDEX repocard_unique_repo_per_user ON repocard (user_id, lower(repo_owner), lower(repo_name))`. The name `unique_repo_per_user` is already taken by the `maintenance` constraint."},{"oldText":"- Drop `unique_repo_per_board` (subsumed).","newText":"- Keep `unique_repo_per_board`. It is redundant after the new index but harmless, and rollback stays a plain drop of the new objects."},{"oldText":"- `addRepositoriesToBoard`: dedup against every board of the user (case-insensitive) plus maintenance. Report skipped repos by name and which board holds them.","newText":"- `addRepositoriesToBoard`: dedup against every board of the user plus maintenance. One query replaces the current per-board query: `repocard` joined with `board!inner(user_id, name)`, filtered on `board.user_id = claims.sub`; `owner/name` is compared lowercased in JS (no `ilike`). Report each skipped repo by name with where it lives.\n- Expected errors: add `ActionUserError` (an `Error` subclass) to `src/lib/actions/types.ts`. `withAuthResult` and `withAuthResultRateLimit` in `src/lib/actions/auth-guard.ts` return its message verbatim and do not send it to Sentry; every other error keeps the generic message. Only the duplicate messages listed below use it."},{"oldText":"- `moveCardToBoard`: target-board duplicate check becomes unreachable; remove it.","newText":"- `moveCardToBoard`: keep the target-board duplicate check. It still matters on the old schema while a legacy duplicate exists."},{"oldText":"- Map Postgres `23505` on `unique_repo_per_user` to one friendly error in all three paths (covers the check-then-insert race).","newText":"- Map any Postgres `23505` from the three paths (insert, `restore_to_board`, `move_card_to_board`) to one friendly error, without matching on the constraint name. Covers the check-then-insert race on both schemas."},{"oldText":"- `RestoreToBoardDialog`: show the action's error inline (same pattern `MoveToAnotherBoardDialog` uses).","newText":"- `RestoreToBoardDialog` and `MoveToAnotherBoardDialog` already render the action's `error` inline. Today the auth guards replace every thrown message with `An unexpected error occurred`, so step 3 adds a pass-through for expected errors."},{"oldText":"- Unit: `addRepositoriesToBoard` skips a repo held by another board; `restoreToBoard` rejects it; `23505` maps to the friendly error; combobox renders the disabled option with the board label.","newText":"- Unit (Vitest): the pure helper that splits requested repos into addable and held (this board, another board, maintenance; case-insensitive); the `23505` mapper; the combobox renders a repo held by another board as not selectable, with the board label and the control that opens the holding board."},{"oldText":"- E2E: adding a repo already on another board is blocked in the combobox; restoring from maintenance onto a second board is impossible once the repo is on a board; move-to-another-board still works and keeps `projectinfo`.","newText":"- E2E (Playwright, fixture DB; `move-to-another-board.spec.ts` already proves DB mutations work in test mode): a repo held by another board shows as not selectable with its board label in the picker, and its control opens the holding board; after moving a card to another board the picker on the source board shows it as held without a reload; move-to-another-board still works and keeps `projectinfo`.\n- DB (through `e2e/helpers/db-query.ts` against local Supabase): a second card for the same repo on another board of the same user is rejected with `23505`, also when only the letter case differs; the same repo on another user's board is accepted."},{"oldText":"- Migration: seed a cross-board duplicate locally, run `pnpm db:reset`, assert one card survives with merged `projectinfo`.","newText":"- Migration guard (manual, recorded in the PR; seed runs after migrations so `pnpm db:reset` cannot exercise it): on a local DB at the previous migration, insert a second card for an existing repo on another board, apply the new migration and expect the guard's exception with no schema change; delete that card, apply again and expect success."},{"oldText":"- Update `supabase/seed.sql` and `mocks/handlers` if any fixture relies on cross-board duplicates.","newText":"- Fixtures: `supabase/seed.sql` gains a second user who owns one public board holding `testuser/test-repo` and `testuser/private-project`. `resetRepoCards` in `e2e/helpers/db-query.ts` deletes cards on every board of the test user, not only Test Board."},{"oldText":"- `SPEC.md` and `CLAUDE.md` schema notes: repo uniqueness is per user, not per board.","newText":"- `SPEC.md` and `CLAUDE.md` schema notes: repo uniqueness is per user, not per board.\n- `TODOS.md`: add the four deferred items (one-click \"Move here\" from the picker; DB-level board/maintenance exclusion; repo search in the command palette; identity by GitHub repo id)."},{"oldText":"App code tolerates both old and new schema order only if deployed after the migration, so migrate first, then deploy.","newText":"Vercel deploys on merge while the migration waits for approval, so the app must work on both schemas."},{"oldText":"- Existing cross-board duplicates in production: merge automatically (as above) or stop and let the user pick per repo?\n- Should \"on a board\" and \"in maintenance\" also be mutually exclusive in the DB, or stay app-enforced?","newText":"- Existing cross-board duplicates in production: answered. One group, the owner's own; the owner picks which card to keep. No automatic merge.\n- Board and maintenance exclusivity in the DB: answered. Stays app-enforced in this plan; DB enforcement is deferred to TODOS.md."}]} -->

<!-- autoplan-accepted:ceo -->

- CEO review amendments (revision 6: after the production audit, spec reviews 1 to 3, both CEO voices and the section review).
- Alternatives considered: (a) restriction, one card per user and repo, chosen because issue #215 asks for it and a board column is the repo's status, so two placements mean two statuses; (b) shared `projectinfo` keyed by user and repo with several placements, not chosen, would allow one repo on a private and a public board at once. `repocard.user_id` is groundwork for either, so (b) stays possible later.
- Duplicate policy: the migration never merges or deletes cards. Its guard blocks the production run until the owner has removed the extra card of the one existing duplicate group in the UI. Which card survives is the owner's choice.
- Audit scope: the audit also counts, per run, repos that are both on a board and in `maintenance`, and case-variant duplicates. All audit and verification queries return counts only.
- Module placement: the pure split helper, the `23505` mapper and the lookup helper (it takes the Supabase client and user id as arguments) live in a new `src/lib/actions/repo-card-duplicates.ts` without the `'use server'` directive, like `mappers.ts` and `shared-project-info.ts`. `repo-cards.ts` and `board-data.ts` keep only the action wrappers, so no sync function is exported from a `'use server'` file and the lookup never becomes a client-callable action.
- Shared lookup: `addRepositoriesToBoard` and `restoreToBoard` use one helper that loads the user's cards with their board ids and names (`board!inner(id, user_id, name)`, filtered on `board.user_id = claims.sub`) and matches `owner/name` lowercased in JS. The page-level fetch of other-board repos uses the same query shape. The maintenance comparison is lowercased too.
- Owner filter: RLS alone is not enough for these lookups, because the policy "Anyone can view public board repo cards" returns other users' public cards. Verify (E2E): with the seeded second user's public board holding `testuser/private-project`, the picker on Test Board still offers that repo as selectable with no `On ...` label.
- Schema-order tolerance: app code reads ownership and the board name through the `board` join and never selects or writes `repocard.user_id`, so the same build runs before and after the migration.
- Expected-error pass-through verification (Vitest): a thrown `ActionUserError` reaches the caller as `{ success: false, error: <its message> }` and Sentry is not called; a plain `Error` still returns `An unexpected error occurred` and is sent to Sentry.
- Commit order: `ActionUserError` and the guard pass-through land as their own commit before the feature commit.
- `addRepositoriesToBoard` result texts, one sentence per skipped repo in `duplicateWarnings`: `owner/name is already on this board`, `owner/name is already on board "<board name>"`, `owner/name is in Maintenance`. When every requested repo is skipped the action fails with an `ActionUserError` carrying those sentences joined by `; `.
- `restoreToBoard` rejects with `ActionUserError`: `owner/name is already on board "<board name>"`.
- `moveCardToBoard` throws its existing text `Repository already exists in target board` as an `ActionUserError`, so the dialog finally shows it.
- Race text for any `23505` in the three paths, thrown as `ActionUserError`: `A selected repository is already on a board. Reload and try again.` The batch insert is atomic, so nothing is added when it fires.
- Repo identity groundwork: `addRepositoriesToBoard` also stores the GitHub repository id as `meta.githubId` on every new card. No schema change and nothing reads it yet; it shrinks the later backfill for rename-safe identity.
- Page data: the board page loads, in the existing `Promise.all`, the user's repos that sit on other boards as `{ identifier, boardId, boardName }` (lowercase `owner/name`). Only the user's own boards are included.
- Client state: the other-board set lives in the Redux `board` slice. It is dispatched in the existing hydration `useLayoutEffect` in `BoardPageClient.tsx`, so server data overwrites any copy restored from localStorage on every page load.
- Persisted-state safety: the `board` slice is restored from localStorage by a shallow merge, so a copy saved before this release has no other-board key. The selector returns an empty list when the key is missing; no storage `version` bump (a bump without `migrate` would wipe saved theme settings and drafts). Verify (Vitest): with a preloaded `board` state lacking the key, the selector returns `[]` and the picker renders.
- Client freshness after a move: `MoveToAnotherBoardDialog`'s `onMoved` becomes `(cardId, targetBoardId, targetBoardName)`. The board page handler reads the card's `owner/name` from the store before removing it and adds `{ identifier, boardId: targetBoardId, boardName: targetBoardName }` to the other-board set, so the picker shows the repo as held without a reload. Removing a card needs no change.
- Picker rendering: a repo held by another board is never a selectable option. The picker shows where it lives (`On <board name>`) and offers a keyboard-reachable control that opens that board (`/board/<boardId>`). The control sits outside any `role="option"` element. Search still matches these repos. Layout is settled in design review. Verify (E2E): the held repo cannot be selected, and activating the control lands on the holding board.
- One-click "Move here" from the picker stays deferred to TODOS.md.
- Removal confirmation copy (`OverflowMenu.tsx`): the dialog states that the card's note, links and comment are deleted with it, instead of only "You can always add it back later".
- E2E fixture for "held by another board": the test inserts a card for `testuser/private-project` on Work Projects through `e2e/helpers/db-query.ts` before opening the picker on Test Board, and deletes it afterwards. The widened `resetRepoCards` also clears it, so a crashed test cannot block later specs.
- DB tests (through `e2e/helpers/db-query.ts`, service role): a second card for the same repo on another board of the same user fails with `23505`, also when only the letter case differs; the seeded second user holding `testuser/test-repo` proves the same repo coexists across users (the seed itself fails if it does not); an insert carrying a forged `user_id` stores the board owner's id; `UPDATE repocard SET user_id = <other user>` leaves the owner's id in place; an update that only changes `order` succeeds.
- Page fetch failure: when the other-board fetch fails it behaves like `getUserMaintenanceRepoIdentifiers` on failure and the page still renders; the picker then offers those repos and the server check rejects the add with the sentence above.
- Race visibility: because `ActionUserError` skips Sentry, the `23505` path writes one structured warning through the existing logger (action name, user id, no repo names) before throwing, so the frequency of the race stays observable.
- Re-runnable migration: every statement after the guard can run twice without error (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER`, `CREATE UNIQUE INDEX IF NOT EXISTS`), so a partial apply is recoverable regardless of how the CLI wraps the file in a transaction.
- Row cap: the lookup can truncate at PostgREST `max_rows` (1000) for a user with more than 1000 cards. The unique index is the backstop and the race text is what that user sees. No extra handling.
- Regenerate `src/lib/supabase/database.types.ts` after the migration; fix any test fixture that builds a full `repocard` row.
- Rollout order: (1) merge; Vercel deploys and the app-level checks stop new duplicates on the old schema. (2) The owner copies anything worth keeping (links, note, comment) from the card they will remove into the card they keep, then removes the extra card. Removing a card deletes its `projectinfo`. (3) Re-run the count-only audit on production and expect 0. (4) The owner approves the `production` environment job; the guard passes and the index is created. (5) Re-run the count-only audit and expect 0; record it in the PR.
- If the guard still raises (job approved too early, or a new duplicate slipped in through a two-tab race before the index existed), the transaction rolls back and the app keeps working. List the offending card ids and board ids with the service role (ids only, no repo names), remove the extra card with its owner's agreement, and re-run the job.
- Rollback: a new migration that drops `repocard_unique_repo_per_user`, the trigger, its function and `repocard.user_id`. App code needs no revert.

<!-- /autoplan-accepted:ceo -->

### Phase 2: Design review

- Methodology read: `autoplan-design-methodology-lgK2vS/methodology.md` ranges 1-600, 601-1200, 1201-1800, 1801-1972 of 1972 lines (EOF).
- Input for both voices: `autoplan-design-X5tv0z`, sha `eb38187f…53b8`.
- Scope: review of this plan (the /autoplan target). UI surface: the Add Repositories picker, the move and restore dialogs, the remove-card confirmation.

#### Step 0: design scope

- Initial rating: 3/10. The plan pinned the data layer precisely and left the one visible surface as "layout is settled in design review". A 10 names where held repos sit, what each row contains, every empty and result state, the keyboard contract and the exact copy.
- DESIGN.md: none. Reviewed against universal principles and the tokens the picker already uses (`text-muted-foreground`, `bg-accent`, `border-border`, `text-primary`). `/design-consultation` is the fix for the missing file; not part of this plan.
- Existing patterns to reuse: the option row markup (`AddRepositoryCombobox.tsx:532-577`), the inline `role="alert"` error in both dialogs, `sonner` toasts, `next/link`.
- Mockups (Step 0.5): designer available (`DESIGN_READY`) but not run. The comparison board needs the owner to pick a variant and the owner is away; the change is one list inside an existing panel that reuses the existing row pattern. Recorded as a skipped step, not as completed.
- Focus (0D, auto): all seven passes.

#### Step 0.5: dual voices

**CLAUDE SUBAGENT (design, independent review)** — completed, INPUT hash matched. 16 findings: 2 critical (held rows have no place in the list; required markup contradicts the listbox), 6 high (row anatomy, empty state fires in the main scenario, partial-add toasts, all-skipped styled as failure, journey ends in another search, tests pin the wrong things), 8 medium.

**CODEX SAYS (design, UX challenge)** — completed (`gpt-6-astra`, verdict `findings`, P1). 8 findings: 5 High (no layout or navigation contract for the recovery control; Enter-to-submit conflicts with a link; no responsive strategy and a fixed `w-120` panel; partial success disappears and the success toast can name the skipped repo; failed availability data reads as permission to add), 3 Medium (dialogs dead-end; loading and empty states; contrast and touch targets not acceptance criteria).

```
DESIGN OUTSIDE VOICES — LITMUS SCORECARD:
  Check                                    Claude      Codex       Consensus
  1. Brand unmistakable in first screen?   NOT SPEC'D  YES         NOT SPEC'D (native voice did not rate)
  2. One strong visual anchor?             NOT SPEC'D  YES         NOT SPEC'D
  3. Scannable by headlines only?          NO (F1)     NO          CONFIRMED failure -> fixed (section heading)
  4. Each section has one job?             NO (F1,F2)  NOT SPEC'D  fixed (listbox = add, list = placed elsewhere)
  5. Cards actually necessary?             n/a         YES         flat rows, no cards added
  6. Motion improves hierarchy?            NOT SPEC'D  NOT SPEC'D  NOT SPEC'D (no motion added)
  7. Premium without decorative shadows?   NOT SPEC'D  NOT SPEC'D  NOT SPEC'D
  Hard rejections triggered:               none        none        none
```

#### Passes

| Pass                       | Before | After | What changed                                                                                                                                          |
| -------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Information architecture | 3      | 9     | Two regions: listbox for addable repos, sibling list `Already placed elsewhere (N)` below it. Both voices asked for exactly this split.               |
| 2 Interaction states       | 3      | 9     | State table below; empty states, partial result, all-skipped result, race, fetch failure all specified.                                               |
| 3 Journey                  | 4      | 8     | Dead end becomes "see where it lives, open it". Arriving on the holding board without the card revealed keeps this from a 10 (User Challenge 2).      |
| 4 AI slop                  | 7      | 9     | App UI, flat rows, utility copy, no cards, no decoration. Exact copy written for the removal dialog and every message.                                |
| 5 Design system            | 5      | 8     | No DESIGN.md; the new rows are specified in existing semantic tokens only, which keeps all 14 themes working.                                         |
| 6 Responsive and a11y      | 3      | 7     | Keyboard contract, accessible names, 44px rows, focus ring specified. The panel's fixed `w-120` width on narrow screens is pre-existing and deferred. |
| 7 Decisions                | -      | -     | 14 resolved, 4 deferred, 1 user challenge.                                                                                                            |

```
PICKER PANEL
  [ search ............................ ] [org v] [visibility v]
  [ selected chips ]
  +-- listbox: repos you can add --------------------------------+
  | owner/repo-a                                              ✓  |
  | owner/repo-b                                                 |
  +---------------------------------------------------------------+
  Already placed elsewhere (2)
    owner/repo-c
      On Work Projects →            (link, /board/<id>)
    owner/repo-d
      In Maintenance →              (link, /maintenance)
                                        [ Cancel ] [ Add 1 repository ]
```

```
FEATURE              | LOADING                 | EMPTY                                   | ERROR                         | SUCCESS                         | PARTIAL
---------------------|-------------------------|-----------------------------------------|-------------------------------|---------------------------------|-------------------------------
Addable list         | Loading repositories... | "No repositories left to add."          | existing catalog error        | options listed                  | n/a
Held list            | arrives with the page   | not rendered                            | fetch failed -> not rendered  | rows with links                 | stale names until reload
Search               | deferred value          | "No repositories found matching ..."    | n/a                           | both lists filtered             | only held match -> hint line
                     |                         | only when both lists are empty          |                               |                                 |
Add                  | button shows progress   | n/a                                     | race text in the alert box    | toast from created cards, close | "<N> added, <M> skipped" toast
Add, nothing added   | same                    | n/a                                     | n/a (not an error)            | n/a                             | picker stays, neutral notice
Move / restore       | existing                | n/a                                     | inline sentence, cleared on   | existing                        | n/a
                     |                         |                                         | target change (move)          |                                 |
```

```
STEP | USER DOES                          | USER FEELS             | PLAN SPECIFIES
1    | opens the picker, types a name     | expects to find it     | search filters both lists
2    | sees it under "Already placed"     | "oh, it's over there"  | row with board name, no dead end
3    | follows "On Work Projects"         | in control             | link, same tab, selection dropped
4    | lands on the board                 | has to look for it     | not specified (User Challenge 2)
5    | card menu -> Move to Another Board | task done              | existing dialog; error now readable
```

Decisions (auto unless marked):

| #   | Issue                                               | Decision                                                        | Class          | Principle                                                                                 |
| --- | --------------------------------------------------- | --------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| D1  | Where held rows live                                | Sibling list after the listbox                                  | Mechanical     | P5, both voices                                                                           |
| D2  | Row anatomy                                         | Two lines, tokens only, link on line 2                          | Mechanical     | P5                                                                                        |
| D3  | Enter conflict                                      | Stop propagation on the link; keep panel Enter-to-add           | Taste          | P3. Codex wanted the panel shortcut removed; that changes existing behavior and its tests |
| D4  | Empty states                                        | Three explicit conditions                                       | Mechanical     | P1                                                                                        |
| D5  | Partial result                                      | One toast, picker closes                                        | Taste          | P5. Codex wanted the picker kept open with inline rows; reached only with stale data      |
| D6  | Nothing added                                       | Success with `skipped`, picker stays, neutral notice, self-heal | Mechanical     | P1, both voices                                                                           |
| D7  | Success toast names `selectedRepos[0]`              | Build text from created cards                                   | Mechanical     | bug found by Codex                                                                        |
| D8  | Race text                                           | Two texts, by caller                                            | Mechanical     | P5                                                                                        |
| D9  | Fetch failure                                       | Dispatch `[]`; rely on D6 to self-heal                          | Taste          | P5. Codex wanted a loading/failed/incomplete availability state with Retry                |
| D10 | Maintenance repos                                   | Listed as `In Maintenance` with a link                          | Mechanical     | P2: same dead end, data already on the client                                             |
| D11 | Reveal card on arrival                              | Not added; `cardId` carried now                                 | User Challenge | both voices recommend adding it                                                           |
| D12 | Narrow-screen panel                                 | Deferred                                                        | Taste          | pre-existing `w-120` panel, outside blast radius                                          |
| D13 | Removal dialog copy                                 | Exact text written                                              | Mechanical     | P1                                                                                        |
| D14 | Move dialog stale error                             | Clear on target change                                          | Mechanical     | error becomes visible for the first time with this plan                                   |
| D15 | Dialog Open-board links                             | Deferred                                                        | Taste          | 0 such cases in the audit                                                                 |
| D16 | Separate "Adding" state                             | Deferred                                                        | Mechanical     | pre-existing, unrelated to the restriction                                                |
| D17 | Hint line "Each repository can appear on one board" | Not added                                                       | Taste          | subtraction; the section heading says it                                                  |
| D18 | Tests and story                                     | Added                                                           | Mechanical     | P1                                                                                        |

NOT in scope (design): narrow-screen panel layout; separate "Adding" state; Open-board links in dialog errors; card reveal on arrival; preserving picker state across Back navigation; a hint line about the rule.

What already exists (design): option row markup, inline alert in both dialogs, toasts, theme tokens, the board-not-found page for stale links.

Implementation tasks (design):

- [ ] **T1 (P1, human: ~5h / CC: ~20min)** — picker — held list as a sibling of the listbox with the specified row, filters, empty states and keyboard handling
  - Surfaced by: Claude F1-F3, F5, F10; Codex 1-2, 7
  - Files: `src/components/Board/AddRepositoryCombobox.tsx`
  - Verify: `pnpm test`, picker E2E
- [ ] **T2 (P1, human: ~3h / CC: ~15min)** — add result — `skipped` shape, single toast, nothing-added notice, self-heal, toast text from created cards
  - Surfaced by: Claude F6-F7; Codex 4
  - Files: `src/lib/actions/repo-cards.ts`, `src/lib/actions/repo-card-duplicates.ts`, `src/components/Board/AddRepositoryCombobox.tsx`
  - Verify: `pnpm test`
- [ ] **T3 (P2, human: ~1h / CC: ~5min)** — dialogs — clear move error on target change; exact removal copy; two race texts
  - Surfaced by: Claude F8, F14; Codex 6
  - Files: `src/components/Modals/MoveToAnotherBoardDialog.tsx`, `src/components/Board/OverflowMenu.tsx`
  - Verify: `pnpm test`, `pnpm e2e:parallel`
- [ ] **T4 (P2, human: ~2h / CC: ~10min)** — tests — five component cases and one Storybook story
  - Surfaced by: Claude F16
  - Files: `src/tests/unit/components/Board/AddRepositoryCombobox.test.tsx`, `src/components/Board/AddRepositoryCombobox.stories.tsx`
  - Verify: `pnpm test`

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | no DESIGN.md; UI scope: picker, 2 dialogs,  |
|                      | removal confirmation                        |
| Step 0               | 3/10; all seven passes                      |
| Pass 1  (Info Arch)  | 3/10 → 9/10 after fixes                     |
| Pass 2  (States)     | 3/10 → 9/10 after fixes                     |
| Pass 3  (Journey)    | 4/10 → 8/10 after fixes                     |
| Pass 4  (AI Slop)    | 7/10 → 9/10 after fixes                     |
| Pass 5  (Design Sys) | 5/10 → 8/10 after fixes                     |
| Pass 6  (Responsive) | 3/10 → 7/10 after fixes                     |
| Pass 7  (Decisions)  | 14 resolved, 4 deferred                     |
+--------------------------------------------------------------------+
| NOT in scope         | written (6 items)                           |
| What already exists  | written                                     |
| TODOS.md updates     | 4 items proposed (plan step 6 writes them)  |
| Approved Mockups     | 0 generated, 0 approved (owner away)        |
| Decisions made       | 14 added to plan                            |
| Decisions deferred   | 4, plus User Challenge 2                    |
| Overall design score | 3/10 → 7/10                                 |
+====================================================================+
```

Unresolved (design): User Challenge 2 (reveal the card on arrival); narrow-screen panel layout (deferred, keeps Pass 6 at 7).

<!-- autoplan-accepted:design -->

- Design review amendments. Three earlier items are replaced here: the `addRepositoriesToBoard` result texts and all-skipped failure (now structured `skipped`, below), the single race text (now two texts, below), and the page-data tuple (now carries `cardId`, below).
- Picker structure: the existing `role="listbox"` keeps addable repos only. Repos placed elsewhere render in a sibling `<ul aria-label="Already placed elsewhere">` after the listbox, inside the same panel, under a small heading `Already placed elsewhere (N)`. The list is not virtualized and scrolls on its own above `max-h-40`. Nothing is rendered when N is 0.
- What counts as placed elsewhere: catalog repos on another board of the user (`On <board name>`, links to `/board/<boardId>`) and catalog repos in maintenance (`In Maintenance`, links to `/maintenance`). Repos on the current board stay hidden as today.
- Held row anatomy: two lines. Line 1 is `owner/name` in `text-muted-foreground`, truncated. Line 2 is a `next/link` with the label and a trailing arrow icon, styled `text-primary` with underline on hover, truncated with `title` set to the full label. No description, stars or language. No hover background and no `cursor-pointer` on the row. Row min height 44px. The link shows a `focus-visible` ring. Semantic theme tokens only; no hard-coded colors.
- Accessible names: `Open board <board name>, which holds owner/name` and `Open Maintenance, which holds owner/name`.
- Filtering: the search query, the organization filter and the visibility filter apply to the held list exactly as to the options. Held repos never enter the selection or the selected count. One row per repo; if two cards hold the same repo before the migration, the first wins.
- Keyboard: Enter and Space on a held-row link stop propagation, so the panel's Enter-to-add handler cannot fire from a link. The link navigates in the same tab and any pending selection is dropped. Existing option key handling is unchanged.
- Empty states: `No repositories found matching "<query>"` renders only when both lists are empty and a query exists. When there are no addable repos but held rows exist, the line `No repositories to add. The ones below are already placed.` renders above the held list. When both lists are empty with no query and the catalog loaded without error, the line `No repositories left to add.` renders.
- Add result shape: `addRepositoriesToBoard` returns `skipped: Array<{ fullName, reason: 'this-board' | 'other-board' | 'maintenance', message, boardId?, boardName?, cardId? }>` in place of `duplicateWarnings`. `message` is the sentence defined earlier for that reason. When every requested repo is skipped the action returns success with `addedCount: 0` and the `skipped` list; it does not throw.
- Add result handling in the picker: every `other-board` entry in `skipped` is upserted into the other-board set. Some added and some skipped: one toast titled `<N> added, <M> skipped` with one sentence per line, and the picker closes as today. All added: the existing success toast, with its text built from the created cards instead of `selectedRepos[0]`. None added: no toast, the picker stays open, the skipped repos leave the selection, a neutral notice (not the red alert, no `Error:` prefix) lists the sentences, and the repos appear in the held list.
- Race texts, passed to the `23505` mapper by the caller. Picker: `Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.` Restore and move dialogs: `owner/name was just placed on a board. Close this dialog and try again.`
- Page data tuple: `{ identifier, boardId, boardName, cardId }`. Nothing reads `cardId` yet; it is groundwork for revealing the card on arrival, which is not in this plan.
- Page fetch failure: the hydration effect dispatches an empty list when the other-board fetch failed, so a persisted set from another board never survives a load.
- Stale data: board names in the held list can be stale until the next page load, and a link to a board deleted in another tab lands on the existing board-not-found page. Accepted.
- Move dialog: the inline action error is cleared when the user changes the target board or the target column.
- Removal confirmation, exact copy: `This removes owner/name from this board and permanently deletes its note, links and comment. Adding the repository again will not restore them. The repository on GitHub is not affected.`
- Copy rule: board names are unquoted in the `On <board name>` label and quoted in sentences.
- Tests added (Vitest, component): a search that matches only a held repo shows its row and no `No repositories found` text; a maintenance repo shows `In Maintenance`; an all-skipped result keeps the picker open, removes the chips and shows the neutral notice; a partial result shows one toast `1 added, 1 skipped`; Enter on a held-row link with a pending selection does not call the add action.
- Storybook: one `AddRepositoryCombobox` story with held rows (one on another board, one in maintenance).
- Deferred to TODOS.md by plan step 6, in addition to the four CEO items: a viewport-aware layout for the picker panel (it is a fixed `w-120` panel today); a separate "Adding" state so submission does not show `Loading repositories...`; Open-board links inside the move and restore dialog errors; revealing and focusing the card on arrival at the holding board.

<!-- /autoplan-accepted:design -->

### Phase 2.5: DX review

Skipped: no developer-facing scope detected (`scope` matched 1 term, threshold 2; end-user PWA). This is a skip, not a completed review.

### Phase 3: Eng review

- Methodology read: `autoplan-eng-methodology-NydlF3/methodology.md` ranges 1-600, 601-1200, 1201-1800, 1801-2224 of 2224 lines (EOF).
- Input for both voices: `autoplan-eng-LFLadC`, sha `21fb7bcb…e81d`.

#### Step 0: scope challenge

Code read for this step: `repo-cards.ts`, `auth-guard.ts`, `board-data.ts`, `board/[id]/page.tsx`, `BoardPageClient.tsx`, `AddRepositoryCombobox.tsx`, both dialogs, `OverflowMenu.tsx`, `boardSlice.ts`, `store.ts`, the five schema migrations, `seed.sql`, `db-query.ts`, `playwright.config.ts`, `e2e-parallel.sh`, the production workflow.

| Sub-problem             | Existing code                                                           | Reuse or new                                       |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| Per-user uniqueness     | `unique_repo_per_board`, `maintenance.unique_repo_per_user`             | New index; same idea as the maintenance constraint |
| Ownership on `repocard` | none (`board.user_id` only)                                             | New column + trigger                               |
| Duplicate lookup        | per-board query at `repo-cards.ts:123-136`, maintenance query at `:139` | One shared lookup replaces both                    |
| Readable errors         | `toErrorMessage()` flattens everything                                  | New `ActionUserError` pass-through                 |
| Picker data             | `useRepositoryCatalog`, page-level maintenance identifiers              | New `useRepoPlacements`, same loading pattern      |
| Dialog errors           | inline `role="alert"` in both dialogs                                   | Reused unchanged                                   |
| Request validation      | Zod schemas in `src/lib/validations/`                                   | One new schema, same folder                        |
| E2E DB access           | `e2e/helpers/db-query.ts`                                               | Reused; reset widened                              |

- Complexity check: more than 8 files and 3 new modules. Triggered. Scope is not reduced (override P2). The eng change below removes 4 touched files (`page.tsx`, `BoardPageClient.tsx`, `boardSlice.ts`, the `onMoved` signature) and 5 compensating items from the earlier phases.
- Search check: a unique expression index and a `BEFORE` trigger are Postgres built-ins. No custom locking, no advisory locks. Layer 1.
- TODOS cross-check: the existing "more than 1000 cards truncated" item covers the same cap this plan's lookup hits; the new deferral references it.
- Distribution: no new artifact. Web deploy through Vercel, schema through the existing production workflow.

#### Step 0.5: dual voices

**CLAUDE SUBAGENT (eng, independent review)** — completed, INPUT hash matched. 20 findings, no blocker: 1 High (T1: no automated test reaches the server rejection paths), 6 Medium (A1 placement state at page level plus persisted Redux needs five compensations; A2 two lookups can drift; E1 stale held set on Back; T2 old-schema smoke missing; T4 component tests need the real-component harness; S1 unvalidated `repositories` argument), 13 Low or Info.

**CODEX SAYS (eng, architecture challenge)** — completed (`gpt-6-astra`, verdict `findings`, P1). 8 findings: 2 High (back/forward restores stale placement state; the maintenance lookup in `addRepositoriesToBoard` fails open at `repo-cards.ts:138`), 6 Medium (hydration effect ordering against async storage restore; `skipped` reconciliation covers only `other-board`; the 1000-row cap needs pagination; the guard test does not prove atomicity; service-role DB tests do not exercise the invoker trigger under RLS; the parallel E2E script tolerates seed failure).

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude          Codex           Consensus
  1. Architecture sound?               concern (A1)    concern (1, 3)  CONFIRMED concern -> fixed (fetch on picker open)
  2. Test coverage sufficient?         NO (T1)         NO (6, 7, 8)    CONFIRMED gap -> fixed (7 tests added)
  3. Performance risks addressed?      yes, warn only  NO (5)          DISAGREE -> taste (warn now, paginate later)
  4. Security threats covered?         concern (S1)    concern (7)     CONFIRMED concern -> fixed (Zod, RLS test)
  5. Error paths handled?              concern (E4)    NO (2, 4)       CONFIRMED gap -> fixed (fail closed, refetch)
  6. Deployment risk manageable?       yes with T2,T3  NO (6)          DISAGREE -> taste (one DO block vs CLI pinning)
CONFIRMED = native + outside agree. 4/6 confirmed, 2 disagreements.
Single-voice High: Codex 2 (fail-open maintenance lookup). Verified in code at repo-cards.ts:139. Fixed.
```

#### Section 1: architecture

```
BEFORE (after CEO + design)                      AFTER (eng)

page.tsx ── Promise.all ── other-board fetch     page.tsx            (unchanged)
   │                                             BoardPageClient     (unchanged)
BoardPageClient ── useLayoutEffect ─▶ Redux      boardSlice          (unchanged)
   │                 (persisted, async restore)
   ├─ onMoved(cardId, boardId, boardName)        AddRepositoryCombobox
   ▼                                               ├─ useRepositoryCatalog(isOpen)        existing
AddRepositoryCombobox ◀── selector                 └─ useRepoPlacements(isOpen)           NEW
                                                        │ server action, every open
                                                        ▼
                                                 board-data.ts  getUserRepoPlacements()   NEW (withAuthResult)
                                                        │
repo-cards.ts                                           ▼
  addRepositoriesToBoard ─┐                      repo-card-duplicates.ts                  NEW (no 'use server')
  restoreToBoard ─────────┼────────────────────▶   lookupRepoPlacements(supabase, userId)
  moveCardToBoard ────────┘                        splitRequestedRepos()   pure
        │                                          mapUniqueViolation()    pure
        ▼                                               │
  auth-guard.ts ── ActionUserError passes through       ▼
        │                                        Supabase: repocard ⋈ board!inner (owner filter) + maintenance
        ▼
  Postgres: trigger sets repocard.user_id from board ─▶ UNIQUE (user_id, lower(owner), lower(name))
```

- Coupling: the picker no longer depends on page data, Redux persistence or the move dialog for placement state. One new dependency: picker to `getUserRepoPlacements`.
- Single source of truth: the lookup function. Three callers, one owner filter.
- Scaling: one extra request per picker open, at most 1000 rows of 3 short columns. Breaks first at the 1000-row cap (Section 4).
- Security: lookups filter by `board.user_id`, because the public-board RLS policy returns other users' cards. The trigger makes `user_id` unforgeable. New input validation closes script-bearing names in messages and toasts.
- Rollback: unchanged from the CEO phase. App code needs no revert.
- Rejected: Codex's `revalidatePath` for back/forward staleness. The project rule forbids it with Supabase, and fetching on open solves the same problem without a page reload.

Findings and decisions:

| #               | Finding                                                                                  | Decision                                           | Class                        |
| --------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| A1 / Codex 1, 3 | Page-level fetch + persisted Redux needs five compensations and still goes stale on Back | Fetch through a server action on every picker open | Mechanical (P5, both voices) |
| A2              | Two lookups can drift                                                                    | One exported lookup                                | Mechanical (P4)              |
| A3              | `cardId` is carried and unread                                                           | Dropped                                            | Mechanical (P5)              |
| A4              | `meta.githubId` trusted                                                                  | Marked as untrusted hint                           | Mechanical                   |
| Codex 4         | `skipped` reconciles only `other-board`                                                  | Refetch placements after any skipped result        | Mechanical (P1)              |

#### Section 2: code quality

- DRY: the per-board dedup query and the maintenance query in `addRepositoriesToBoard` and the target check in `restoreToBoard` collapse into the shared lookup. `moveCardToBoard` keeps its own narrow target check (different question: is it on that one board).
- Existing cast: `card.board as { user_id }` in `moveCardToBoard` stays as is. Not touched by this plan beyond the error type.
- Naming: `getUserRepoPlacements`, `useRepoPlacements`, `lookupRepoPlacements`, `splitRequestedRepos`, `mapUniqueViolation`. "Placement" is used for board and maintenance alike.
- Constants: `MAX_REPOSITORIES_PER_ADD` and the lookup row cap go in the constants file.
- Rejected: replacing `instanceof ActionUserError` with a brand property. One process, one module graph; `instanceof` is the explicit form.
- No ASCII diagram comments needed in code; the flow above goes in the PR description.

#### Section 3: test review

Framework: Vitest (`pnpm test`), Playwright (`pnpm e2e:parallel`), Storybook. Existing coverage of the touched code: no unit test for `repo-cards.ts` or `auth-guard.ts`; `add-repository-combobox.spec.ts`, `move-to-another-board.spec.ts`, `remove-from-board.spec.ts`, `maintenance-crud.spec.ts` cover the happy flows.

```
CODE PATHS                                                    USER FLOWS
[+] migration                                                 [+] Add from the picker
  ├── [MANUAL] guard raises, schema unchanged (a)               ├── [PLAN →E2E] held repo listed with board link
  ├── [MANUAL] injected failure rolls back (b)                  ├── [PLAN →E2E] link opens the holding board
  ├── [MANUAL] backfill matches board owner, updated_at kept (c)├── [PLAN →E2E] server skip: neutral notice, held row   (eng)
  ├── [MANUAL] second run is a no-op (d)                        ├── [PLAN →E2E] Back from holding board, repo addable    (eng)
  ├── [PLAN DB] trigger overwrites forged user_id               ├── [PLAN →E2E] other user's public card does not block  (eng: fixture asserted)
  ├── [PLAN DB] cross-board + case-variant duplicate -> 23505   ├── [PLAN unit] only-held search shows row, no empty text
  ├── [PLAN DB] restore_to_board / move_card_to_board -> 23505 (eng) ├── [PLAN unit] partial result: one toast
  └── [PLAN DB] authenticated insert into foreign board -> 42501 (eng) ├── [PLAN unit] all skipped: picker stays, notice
[+] repo-card-duplicates.ts                                     └── [PLAN unit] Enter on link does not add
  ├── [PLAN unit] split: this board / other board / maintenance [+] Restore from Maintenance
  ├── [PLAN unit] split: case-insensitive, request dedupe (eng)   ├── [★★ TESTED] restore works — maintenance-crud.spec.ts
  ├── [PLAN unit] 23505 mapper                                    └── [PLAN →E2E] rejected, board named, item stays       (eng)
  └── [PLAN unit] lookup error -> action throws, no insert (eng) [+] Move to another board
[+] validation schema                                             ├── [★★★ TESTED] move keeps projectinfo — move-to-another-board.spec.ts
  └── [PLAN unit] bad name / oversized list / bad id (eng)        └── [PLAN unit] error clears on target change
[+] auth-guard pass-through                                    [+] Remove card
  ├── [PLAN unit] ActionUserError message reaches caller          └── [★★ TESTED] removal — remove-from-board.spec.ts (copy assertion updated)
  └── [PLAN unit] plain Error stays generic, goes to Sentry    [+] Old schema, new build
[+] getUserRepoPlacements                                         └── [MANUAL] add / move / restore specs on previous migration (eng)
  └── [PLAN →E2E] covered by the picker flows

COVERAGE after plan: 28/28 paths have a named check (23 automated, 5 manual)  |  GAPS: 0
Before the eng review: 8 paths had no check (marked eng above)
```

- Regression rule: the removal dialog copy change and the `duplicateWarnings` to `skipped` change alter existing behavior. `remove-from-board.spec.ts`, `OverflowMenu.test.tsx` and the combobox tests are updated in the same PR; `move-to-another-board.spec.ts` must pass unchanged (CRITICAL: `projectinfo` survives a move).
- E2E decision: server skip, restore rejection, owner independence and Back flow cross the client, the server action and the DB, so they are E2E. The split, the mapper, validation and the guard pass-through are pure and stay in Vitest.
- LLM/eval scope: none. No prompt files touched.
- Tests made obsolete: assertions on `duplicateWarnings` and on the old removal copy `You can always add it back later.`. They are rewritten, not deleted.
- Codex 7 (service role bypasses RLS): accepted. One DB test uses an authenticated client built from the app's test JWT.
- Codex 8 (seed failure tolerated by the shard script): the owner-independence test asserts its fixtures first; hardening the script is deferred.
- Test plan artifact: `~/.gstack/projects/laststance-gitbox/ryotamurakami-main-eng-review-test-plan-20261011-011147.md`.

#### Section 4: performance

| #            | Finding                                | Decision                                                                                                      | Class      |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| P1           | One extra request per picker open      | Accepted; runs in parallel with the catalog load, which is slower                                             | Mechanical |
| P2 / Codex 5 | Lookup truncates at 1000 rows          | Sentry warning at the cap now; pagination deferred. Production has 22 cards; the unique index is the backstop | Taste (P3) |
| P3           | Backfill rewrites every `repocard` row | 22 rows in production; `updated_at` trigger disabled around it                                                | Mechanical |
| P4           | Unique index build locks writes        | Milliseconds at this size; `CONCURRENTLY` cannot run inside the migration block                               | Mechanical |
| P5           | Held-row links prefetch board pages    | `prefetch={false}`                                                                                            | Mechanical |

No N+1: the lookup is one query with an inner join plus one maintenance query.

#### Failure modes

| Path                                | Realistic failure      | Test                 | Handling                               | User sees                                                   |
| ----------------------------------- | ---------------------- | -------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Placement fetch on open             | Network or auth error  | unit (hook fallback) | log, fall back to page maintenance set | picker without held list; add is still rejected server-side |
| Lookup in add / restore             | Supabase error         | unit                 | fail closed, Sentry                    | generic error, nothing inserted                             |
| Two tabs add the same repo          | Check passes twice     | DB `23505` test      | index rejects, mapper text, warn log   | race sentence                                               |
| Migration with a leftover duplicate | Job approved too early | manual (a)           | guard raises, block rolls back         | nothing; app keeps working                                  |
| Migration fails midway              | Statement error        | manual (b)           | single block, nothing applied          | nothing                                                     |
| Forged `user_id`                    | Crafted insert         | DB test              | trigger overwrites                     | nothing                                                     |
| Foreign public board insert         | Crafted request        | DB test (`42501`)    | RLS                                    | error                                                       |
| More than 1000 cards                | Truncated lookup       | none                 | Sentry warning; index backstop         | race sentence instead of a named board                      |
| Stale board name in held row        | Renamed in another tab | none                 | accepted (design)                      | old name until next open                                    |

Critical gaps (no test, no handling, silent): 0. The 1000-row case has handling and a visible error, so it is not critical.

#### NOT in scope (eng)

- Pagination of the placement lookup: 22 cards today; the index is the backstop.
- Hardening `scripts/e2e-parallel.sh` against seed failures: test infrastructure, separate change.
- Pinning the Supabase CLI version in the production workflow: the single block removes the dependency on CLI transaction behavior.
- Correcting the "fixture auth cannot mutate" comments: documentation of test infrastructure, separate change.
- `revalidatePath`: forbidden by the project rule for Supabase data.

#### What already exists (eng)

- `withAuthResult` / `withAuthResultRateLimit`: reused; one branch added.
- `useRepositoryCatalog`: the pattern `useRepoPlacements` copies. Not modified.
- `getUserMaintenanceRepoIdentifiers`: stays for the page; it is the fallback when the placement fetch fails.
- `e2e/helpers/db-query.ts`: reused for fixtures and DB assertions.
- `AddRepositoryCombobox.refresh.test.tsx`: the real-component harness the new component tests reuse.
- Sentry row-cap warning in `getBoardBundle`: same pattern for the lookup.

#### Parallelization

| Step                                      | Modules touched                          | Depends on |
| ----------------------------------------- | ---------------------------------------- | ---------- |
| A. `ActionUserError` + guard              | `src/lib/actions`                        | —          |
| B. Migration + types + seed               | `supabase/`, `src/lib/supabase`          | —          |
| C. Duplicates module, validation, actions | `src/lib/actions`, `src/lib/validations` | A          |
| D. Hook + picker + dialogs                | `src/hooks/board`, `src/components`      | C          |
| E. E2E + DB tests                         | `e2e/`                                   | B, C, D    |

Lane 1: A → C → D. Lane 2: B. Then E. A and C share `src/lib/actions`, so they are sequential. In practice one worktree, in that order; the lanes are small.

#### Implementation tasks (eng)

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — actions — `ActionUserError` and guard pass-through, own commit
  - Surfaced by: CEO spec review 2; eng Section 3 (no unit test for `auth-guard.ts`)
  - Files: `src/lib/actions/types.ts`, `src/lib/actions/auth-guard.ts`, `src/tests/unit/lib/actions/auth-guard.test.ts`
  - Verify: `pnpm test`
- [ ] **T2 (P1, human: ~4h / CC: ~20min)** — database — migration as one block, backfill without touching `updated_at`, regenerated types, four manual checks
  - Surfaced by: Claude C1, T3; Codex 6
  - Files: `supabase/migrations/<ts>_repocard_unique_repo_per_user.sql`, `src/lib/supabase/database.types.ts`
  - Verify: manual checks (a) to (d), `pnpm db:reset`, `pnpm typecheck`
- [ ] **T3 (P1, human: ~4h / CC: ~20min)** — actions — duplicates module, request schema, fail-closed lookups, `getUserRepoPlacements`
  - Surfaced by: Claude A1, A2, S1, E2, E4; Codex 2
  - Files: `src/lib/actions/repo-card-duplicates.ts`, `src/lib/actions/repo-cards.ts`, `src/lib/actions/board-data.ts`, `src/lib/validations/repo-card.ts`, constants file
  - Verify: `pnpm test`
- [ ] **T4 (P1, human: ~3h / CC: ~15min)** — picker — `useRepoPlacements`, classification, refetch after `skipped`, Enter guard, `prefetch={false}`
  - Surfaced by: Claude A1, E1, E2, E5; Codex 1, 3, 4
  - Files: `src/hooks/board/useRepoPlacements.ts`, `src/components/Board/AddRepositoryCombobox.tsx`
  - Verify: `pnpm test`, picker E2E
- [ ] **T5 (P1, human: ~5h / CC: ~25min)** — tests — server skip, restore rejection, RPC `23505`, authenticated `42501`, owner independence, Back flow
  - Surfaced by: Claude T1, T5; Codex 7, 8
  - Files: `e2e/logged-in/one-repo-across-boards.spec.ts`, `e2e/helpers/db-query.ts`, `supabase/seed.sql`
  - Verify: `pnpm e2e:parallel`
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — rollout — old-schema smoke and the migration checks recorded in the PR
  - Surfaced by: Claude T2
  - Files: PR description
  - Verify: add, move and restore specs pass on the previous migration
- [ ] **T7 (P2, human: ~1h / CC: ~5min)** — observability — row-cap Sentry warning, constraint name in the race log
  - Surfaced by: Claude E3, C3; Codex 5
  - Files: `src/lib/actions/repo-card-duplicates.ts`
  - Verify: `pnpm test`

#### Completion summary (eng)

- Step 0: Scope Challenge — scope accepted as-is; complexity check triggered, not reduced (override), 4 touched files removed by A1
- Architecture Review: 5 issues found, 5 fixed
- Code Quality Review: 3 issues found (duplicate lookups, constants, naming), 3 fixed; 1 suggestion rejected
- Test Review: diagram produced, 8 gaps identified, 8 closed in the plan
- Performance Review: 5 issues found, 4 fixed or accepted, 1 deferred (pagination, taste)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 12 items written (4 CEO, 4 design, 4 eng)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 2 taste (pagination; atomicity by one block instead of CLI pinning)
- Outside voice: codex, completed (8 concerns)
- Parallelization: 2 lanes, 1 parallel / 1 sequential
- Lake Score: N/A (no completeness-scored questions asked; decisions were auto-decided)

Unresolved (eng): taste decisions on pagination and on the atomicity approach; both go to the final gate.

<!-- autoplan-baseline-edits:eng {"sourceSha256":"d31702ff7ae49ba76d987616a3e102e74c9c0c3fe626451980dda0275f73c358","replacements":[{"oldText":"- Board page (`src/app/board/[id]/page.tsx:71`) fetches identifiers of repos on the user's other boards, alongside the maintenance identifiers.","newText":"- The picker loads the user's repo placements through a server action each time it opens (see the eng amendments). The board page and the Redux `board` slice are not changed."}]} -->

<!-- autoplan-accepted:eng -->

- Eng review amendments. These earlier items are replaced: the CEO items "Page data", "Client state", "Persisted-state safety", "Client freshness after a move" and "Page fetch failure"; the design items "Page data tuple" and "Page fetch failure"; and the design sentence that upserts `other-board` entries from `skipped` into an other-board set. Also replaced: the CEO sentence that a page-level fetch shares the lookup query shape (there is no page-level fetch), the CEO row-cap item ending in "No extra handling" (see the row cap item below), and in the design item on stale data "until the next page load" now reads "until the picker is next opened". `cardId` is dropped from every shape. `MoveToAnotherBoardDialog`'s `onMoved`, `BoardPageClient.tsx`, `page.tsx` and the Redux `board` slice are not changed by this plan.
- Placement transport: a new read action `getUserRepoPlacements()` in `src/lib/actions/board-data.ts` (wrapped in `withAuthResult`) returns `{ boards: Array<{ identifier, boardId, boardName }>, maintenance: RepoIdentifier[] }`, built by the shared lookup helper in `repo-card-duplicates.ts`. The picker calls it every time it opens, in parallel with the catalog load, and again after any add result that contains `skipped`. Fresh on every open, so back and forward navigation cannot show stale placements.
- Hook: a new `useRepoPlacements(isOpen)` in `src/hooks/board/` owns that call and follows the loading pattern of `useRepositoryCatalog`, which itself is not modified.
- Picker classification: hidden means on the current board (live Redux cards plus placements whose `boardId` is the current board); held means placements on other boards plus maintenance; the rest is addable. Options and the held list render only after both the catalog and the placements have settled; until then the existing loading state shows.
- Placement fetch failure: log through the module logger, then render as today (page-supplied maintenance identifiers, no held list). The server check still rejects, and the refetch after a `skipped` result heals the list.
- One lookup function: `addRepositoriesToBoard`, `restoreToBoard` and `getUserRepoPlacements` all call the same exported lookup in `repo-card-duplicates.ts`, so the owner filter exists in exactly one place.
- Mutation lookups fail closed: in `addRepositoriesToBoard` and `restoreToBoard`, an error from the cards lookup or from the maintenance lookup aborts the action with a plain `Error` (generic message, Sentry) before any insert. Today the maintenance lookup error is ignored (`repo-cards.ts:139`). Verify (Vitest, stubbed client): a lookup error throws and the insert is never called.
- Request validation: a Zod schema in `src/lib/validations/` for the `repositories` argument. `owner.login` and `name` match `^[A-Za-z0-9_.-]{1,100}$`, `id` is a positive integer, and the list holds at most `MAX_REPOSITORIES_PER_ADD` (100, in the constants file) entries. Invalid input throws before any query. Verify (Vitest): script-bearing names, an oversized list and a non-integer id are rejected.
- Request dedupe: the split helper dedupes the request by lowercased `owner/name`, first entry wins, so a batch cannot collide with itself. Verify (Vitest).
- `meta.githubId` is an untrusted client hint. Any later identity backfill must re-verify it against GitHub; a code comment on the insert says so.
- Enter guard: the panel's Enter-to-add handler does nothing while an add is in flight.
- Held-row links set `prefetch={false}`.
- Row cap: when the lookup returns 1000 rows, send one Sentry warning, as `getBoardBundle` does. Pagination is deferred.
- Migration atomicity: the whole migration body is one `DO $migration$ ... $migration$` statement, so it is atomic without relying on how the CLI wraps the file. The `IF NOT EXISTS` forms stay. The trigger function body uses a different dollar-quote tag.
- Backfill: `UPDATE repocard ... WHERE user_id IS NULL`, with `ALTER TABLE repocard DISABLE TRIGGER USER` before and `ENABLE TRIGGER USER` after, so `update_repocard_updated_at` does not rewrite every card's `updated_at`.
- Manual migration checks, recorded in the PR (extends the guard test): (a) with a duplicate present the guard raises and the schema is unchanged; (b) a copy of the migration with a failing statement appended inside the block leaves the schema unchanged; (c) after success there are zero rows where `repocard.user_id` differs from `board.user_id`, existing rows keep their `updated_at`, the column is `NOT NULL` with its default, and the trigger and the index exist; (d) running the file a second time succeeds and changes nothing.
- Old-schema smoke, manual, recorded in the PR: reset the local DB to the previous migration and run the add, move and restore E2E specs against the new build.
- E2E, server skip: open the picker on Test Board, then insert `testuser/private-project` on Work Projects through `db-query.ts`, select it and click Add. Expect the neutral notice with the sentence, the repo in the held list as `On Work Projects`, and no new card on Test Board.
- E2E, restore rejection: place a maintenance item's repo on a board through `db-query.ts`, try to restore it, expect the inline error naming that board and the maintenance item still present.
- E2E, owner independence: the test first asserts that the second user's board and both of its cards exist, then adds `testuser/private-project` to Test Board and expects success.
- E2E, back navigation: follow a held link to Work Projects, remove the card there, go Back, open the picker and expect the repo to be addable.
- DB tests, added to the earlier list: `restore_to_board` and `move_card_to_board` fail with `23505` on a duplicate; with an authenticated client built from the test JWT the app uses, an insert into the second user's public board fails with `42501`.
- Component tests render the real `AddRepositoryCombobox` with the store provider and mocked catalog, placements and add actions, as `AddRepositoryCombobox.refresh.test.tsx` already does. The older mock-component test file is left alone.
- `resetRepoCards` looks up every board owned by the test user by `user_id` and deletes their cards, instead of a fixed board list.
- Race log: the structured warning also carries the violated constraint name parsed from the Postgres error. Still no repo names.
- Wording: on the old schema the app-level checks are best-effort; a two-tab race can still create a duplicate until the index exists, which is what the guard fallback is for.
- Deferred to TODOS.md by plan step 6, in addition to the earlier items: paginate the placement lookup beyond 1000 rows; make `scripts/e2e-parallel.sh` and the shard restore fail on seed errors; pin the Supabase CLI version in the production workflow; correct the comments in `e2e/auth.setup.ts` and `CLAUDE.md` that say fixture auth cannot mutate.

<!-- /autoplan-accepted:eng -->

## Decision Audit Trail

<!-- AUTONOMOUS DECISION LOG -->

| #   | Phase      | Decision                                                                                    | Classification | Principle | Rationale                                                                                                                                                                                                                                                                         | Rejected                          |
| --- | ---------- | ------------------------------------------------------------------------------------------- | -------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | CEO 0A     | Accept premises P1-P5                                                                       | Mechanical     | P6        | Each is backed by schema or the issue text                                                                                                                                                                                                                                        | none                              |
| 2   | CEO 0D     | Approach A: `user_id` column + unique index                                                 | Mechanical     | P1, P5    | Only option that closes the two-tab race; native DB feature                                                                                                                                                                                                                       | B app-only checks, C mirror model |
| 3   | CEO 0E     | Mode SELECTIVE EXPANSION                                                                    | Mechanical     | override  | /autoplan fixes the mode                                                                                                                                                                                                                                                          | other modes                       |
| 4   | CEO 0G     | CEO-S1 accept: label links to holding board                                                 | Mechanical     | P2        | Same component, small                                                                                                                                                                                                                                                             | no link                           |
| 5   | CEO 0G     | CEO-S2 defer: "Move here" in combobox                                                       | Taste          | P4        | Existing Move dialog covers it once the link exists                                                                                                                                                                                                                               | add now                           |
| 6   | CEO 0G     | CEO-S3 defer DB exclusion with maintenance; accept audit count                              | Taste          | P3        | Needs its own cleanup of existing overlap; app check exists                                                                                                                                                                                                                       | add trigger now                   |
| 7   | CEO 0G     | CEO-S4 defer palette repo search                                                            | Mechanical     | P2        | Outside blast radius                                                                                                                                                                                                                                                              | add now                           |
| 8   | CEO 0G     | CEO-S5 accept backup table                                                                  | Mechanical     | P1        | Merge deletes rows; needs recovery                                                                                                                                                                                                                                                | delete without copy               |
| 9   | CEO 0G     | CEO-S6 defer GitHub-id identity                                                             | Mechanical     | P2        | Outside blast radius, needs GitHub backfill                                                                                                                                                                                                                                       | add now                           |
| 10  | CEO 0G     | CEO-S7 accept post-migration verification                                                   | Mechanical     | P1        | One query                                                                                                                                                                                                                                                                         | skip                              |
| 11  | CEO 0G     | CEO-Q1: audit decides; auto-merge + backup if any duplicate                                 | Taste          | P1, P6    | Other users cannot be asked to clean up by hand; backup makes it recoverable                                                                                                                                                                                                      | manual pick per repo              |
| 12  | CEO audit  | Run the count-only duplicate audit on production now                                        | Mechanical     | P6        | Plan step 1; read-only; settles the largest open question                                                                                                                                                                                                                         | wait for implementation           |
| 13  | CEO 0G     | CEO-Q1 revised: guard only, owner removes the one duplicate by hand                         | Taste          | P5        | Only the owner's own data is affected; no delete without the owner choosing                                                                                                                                                                                                       | automatic merge + backup          |
| 14  | CEO 0G     | CEO-S5 reversed: no backup table                                                            | Mechanical     | P5        | Nothing is deleted any more                                                                                                                                                                                                                                                       | keep table                        |
| 15  | CEO 0H     | CEO-S1 reversed: plain label, link deferred                                                 | Taste          | P5        | Link inside `role="option"` is invalid and keyboard-unreachable                                                                                                                                                                                                                   | link now                          |
| 16  | CEO 0H     | Accept 15 of 17 spec-review-1 fixes; reject 2 with evidence                                 | Mechanical     | P1        | Each accepted fix prevents a failed migration, a security hole or an ambiguous implementation                                                                                                                                                                                     | accept all / none                 |
| 17  | CEO 0H     | Keep `unique_repo_per_board`                                                                | Mechanical     | P5        | Harmless redundancy; rollback stays a plain drop                                                                                                                                                                                                                                  | drop it                           |
| 18  | CEO 0H     | Accept all 10 spec-review-2 fixes                                                           | Mechanical     | P1        | Largest: guards hid every message, so `ActionUserError` pass-through is required                                                                                                                                                                                                  | none                              |
| 19  | CEO 0H     | Accept both spec-review-3 fixes; stop loop at 3 launches                                    | Mechanical     | P1        | Selector default avoids a crash for returning users; helper module avoids a build failure                                                                                                                                                                                         | bump storage version              |
| 20  | CEO 0H     | Approve scope documents (admin)                                                             | Mechanical     | P6        | Documents match the ledger                                                                                                                                                                                                                                                        | revise                            |
| 21  | CEO voices | Reframe to shared projectinfo (both voices)                                                 | User Challenge | n/a       | Changes the direction stated in issue #215; never auto-decided                                                                                                                                                                                                                    | n/a                               |
| 22  | CEO voices | Add an Open-holding-board control outside role="option" (both voices)                       | Mechanical     | P1, P2    | Valid form of CEO-S1; turns a dead end into a next step                                                                                                                                                                                                                           | plain label only                  |
| 23  | CEO voices | Store meta.githubId on insert; state identity in the Goal (both voices)                     | Mechanical     | P2        | A few lines now shrink a later backfill                                                                                                                                                                                                                                           | defer entirely                    |
| 24  | CEO voices | Keep board vs maintenance exclusion app-enforced; say so in the Goal                        | Taste          | P3        | 0 overlap today; cross-table enforcement needs its own design                                                                                                                                                                                                                     | add trigger now                   |
| 25  | CEO voices | Rollout tells the owner to copy links/note/comment first; removal dialog copy fixed (Codex) | Mechanical     | P1        | Cleanup would otherwise delete data silently                                                                                                                                                                                                                                      | leave copy                        |
| 26  | CEO voices | ActionUserError as its own commit; success criterion in the Goal (Claude)                   | Mechanical     | P5        | Bisectable; measurable                                                                                                                                                                                                                                                            | single commit                     |
| 27  | CEO S1     | Migration statements re-runnable                                                            | Mechanical     | P1        | Does not depend on CLI transaction wrapping                                                                                                                                                                                                                                       | rely on wrapping                  |
| 28  | CEO S8     | Warn-log the 23505 race path                                                                | Mechanical     | P1        | ActionUserError skips Sentry                                                                                                                                                                                                                                                      | no signal                         |
| 29  | CEO S1     | Other-board fetch failure mirrors the maintenance fetch                                     | Mechanical     | P4        | Reuse existing behavior                                                                                                                                                                                                                                                           | new error UI                      |
| 30  | Design 0.5 | Skip mockup generation                                                                      | Taste          | P6        | Board needs the owner to pick; owner away; one list in an existing panel                                                                                                                                                                                                          | generate variants                 |
| 31  | Design P1  | Held repos in a sibling list after the listbox (D1, D2)                                     | Mechanical     | P5        | Only valid markup; both voices                                                                                                                                                                                                                                                    | interleave as disabled options    |
| 32  | Design P6  | Stop propagation on the link; keep panel Enter-to-add (D3)                                  | Taste          | P3        | Smallest change; Codex wanted the shortcut removed                                                                                                                                                                                                                                | remove panel shortcut             |
| 33  | Design P2  | Three empty-state conditions (D4)                                                           | Mechanical     | P1        | Old message fired in the main scenario                                                                                                                                                                                                                                            | leave as is                       |
| 34  | Design P2  | Partial result: one toast, picker closes (D5)                                               | Taste          | P5        | Reached only with stale data                                                                                                                                                                                                                                                      | keep picker open with inline rows |
| 35  | Design P2  | Nothing added: success with skipped, picker stays, self-heal (D6)                           | Mechanical     | P1        | Both voices; replaces the thrown error                                                                                                                                                                                                                                            | red error box                     |
| 36  | Design P2  | Success toast text from created cards (D7)                                                  | Mechanical     | P1        | Existing bug surfaced by Codex                                                                                                                                                                                                                                                    | leave                             |
| 37  | Design P2  | Fetch failure: dispatch [] and self-heal (D9)                                               | Taste          | P5        | Codex wanted an availability state machine with Retry                                                                                                                                                                                                                             | availability states               |
| 38  | Design P1  | List maintenance repos as In Maintenance (D10)                                              | Mechanical     | P2        | Same dead end, data already on the client                                                                                                                                                                                                                                         | defer                             |
| 39  | Design P3  | Reveal card on arrival (D11)                                                                | User Challenge | n/a       | Scope addition both voices recommend; not auto-decided; cardId carried                                                                                                                                                                                                            | n/a                               |
| 40  | Design P6  | Defer narrow-screen panel layout (D12)                                                      | Taste          | P3        | Pre-existing fixed-width panel                                                                                                                                                                                                                                                    | redesign now                      |
| 41  | Design P4  | Exact removal copy; clear move error on target change (D13, D14)                            | Mechanical     | P1        | Copy was described, not written                                                                                                                                                                                                                                                   | leave to implementer              |
| 42  | Design P3  | Defer dialog Open-board links and Adding state; no hint line (D15-D17)                      | Taste          | P3        | Outside the restriction itself                                                                                                                                                                                                                                                    | add now                           |
| 43  | Eng S1     | Placement state fetched by a server action on every picker open (A1)                        | Mechanical     | P5        | Both voices; removes page fetch, persisted Redux field and five compensating items; fixes Back staleness                                                                                                                                                                          | page-level fetch + Redux          |
| 44  | Eng S1     | One exported lookup; drop `cardId`; `githubId` is an untrusted hint (A2-A4)                 | Mechanical     | P4, P5    | Owner filter in one place; no unread fields                                                                                                                                                                                                                                       | two lookups                       |
| 45  | Eng S1     | Reject `revalidatePath` (Codex 1 remedy)                                                    | Mechanical     | P5        | Project rule forbids it with Supabase; fetch on open solves it                                                                                                                                                                                                                    | revalidatePath                    |
| 46  | Eng err    | Mutation lookups fail closed (Codex 2)                                                      | Mechanical     | P1        | Verified fail-open at `repo-cards.ts:139`                                                                                                                                                                                                                                         | keep ignoring the error           |
| 47  | Eng sec    | Zod validation, request dedupe, Enter guard (S1, E2)                                        | Mechanical     | P1        | Names end up in messages and toasts                                                                                                                                                                                                                                               | trust the client                  |
| 48  | Eng S4     | Row cap: Sentry warning now, pagination deferred (Codex 5)                                  | Taste          | P3        | 22 cards in production; index is the backstop                                                                                                                                                                                                                                     | paginate now                      |
| 49  | Eng deploy | Atomicity by one `DO` block; CLI pinning deferred (Codex 6)                                 | Taste          | P5        | Does not depend on CLI behavior                                                                                                                                                                                                                                                   | pin CLI + DDL-then-fail harness   |
| 50  | Eng S3     | Add 7 automated tests, 4 manual migration checks, old-schema smoke (T1-T5, Codex 6-8)       | Mechanical     | P1        | Server rejection paths had no automated check                                                                                                                                                                                                                                     | leave to manual QA                |
| 51  | Eng S2     | Keep `instanceof ActionUserError`                                                           | Mechanical     | P5        | One module graph; explicit                                                                                                                                                                                                                                                        | brand property                    |
| 52  | Eng TODOS  | Write 12 deferred items to TODOS.md                                                         | Mechanical     | P2        | Collected from all phases                                                                                                                                                                                                                                                         | leave in the plan only            |
| 53  | Gate       | Approve as-is (option A)                                                                    | Delegated      | owner     | The owner delegated every decision to the recommended option before leaving ("/ship -> /land-and-deploy までrecommendで進めておいて"). User Challenges 1 and 2 keep the owner's original direction. Taste decisions take the recommendation and are listed for the owner's review | B, B2, C, D, E                    |

Status: APPROVED (2026-10-11, delegated approval; taste decisions and both User Challenges remain open for the owner to revisit).

## Implementation notes

Recorded after the build, where the code differs from the plan text above.

- Storybook: the held-rows story lives on the new `HeldRepositoryList` component (`HeldRepositoryList.stories.tsx`), not on `AddRepositoryCombobox`. The picker loads its data through server actions, and Storybook here has no per-story server-action mocking; mocking those modules globally would change every other story. The list is a pure component, so its story shows the same rows.
- Supabase types: `user_id` was added by hand to the `repocard` entries of `src/lib/supabase/types.ts` and `database.types.ts`, matching `supabase gen types` output for that table. A full regenerate rewrites both files (they have drifted from the generator: missing RPCs and columns in `database.types.ts`, key order in `types.ts`), which is outside this change.
- `move_card_to_board` and `23505`: once the index exists, one user cannot hold two cards for the same repository, so a same-user move can no longer collide. The DB test moves a card onto the second user's board instead, which proves the trigger reassigns `user_id` and the index is re-checked on a board change.
- Constants: `MAX_REPOSITORIES_PER_ADD` sits in `src/lib/validations/repo-card.ts` beside its schema, like the other validation limits. `POSTGREST_MAX_ROWS` moved to `src/lib/constants/postgrest.ts` and replaces the private constant in `board-data.ts`.
- Picker placement failure is reported from the client hook through Sentry (as `useRepositoryCatalog` does); the server lookup logs through the module logger.
- Migration checks run locally on 2026-10-11 against the previous schema plus seed: (a) with a duplicate present the guard raised and no column, trigger, function or index existed afterwards; (b) a copy with `PERFORM 1 / 0` before `END` left the schema untouched; (c) after a clean run: 0 rows where `repocard.user_id` differs from `board.user_id`, `updated_at` checksum unchanged, column `NOT NULL` with default `auth.uid()`, both user triggers enabled, index present; (d) a second run succeeded and changed nothing.
- Old-schema smoke run locally on 2026-10-11: with the migration withheld and the new build, the picker, move, remove, restore and maintenance specs passed (44 of 45; the one failure was the removal-dialog copy assertion, updated in this change).

### Changes from the pre-landing review (2026-10-11)

- Migration `20261011011500`: takes `LOCK TABLE repocard IN ACCESS EXCLUSIVE MODE` before the duplicate guard and sets `lock_timeout` to 5s, so a card committed between the guard and the index build cannot fail the build with key values in the public workflow log, and the job fails fast instead of queueing. The owner column is added without a default, backfilled where it differs from the board owner, and only then gets `DEFAULT auth.uid()`, so the backfill no longer depends on `auth.uid()` being NULL in the migration session.
- New migration `20261011020000_repocard_status_board_guard.sql`: the trigger `check_repocard_status_board` refuses a card whose column belongs to another board. The red team pass found that undoing a drag after "Move to Another Board" (or dragging in a stale tab) wrote the old board's column onto the moved card. Such a card is rendered nowhere, and with the new unique index its repository could no longer be added anywhere. Existing rows are not validated; the migration header carries the count query for stranded cards.
- Undo (`useKanbanUndo`, `reconcileUndoSnapshot`): an undo now restores only cards that are still on the board and leaves cards added since the snapshot alone.
- Picker: Enter submits only from the search box and only when the Add button is enabled; a failed add and a "nothing added" result both refetch placements; an active filter that hides everything says so instead of "No repositories left to add."; the panel height is capped to the viewport.
- Held rows: link in `text-foreground` with underline (AA contrast in every theme), hit area stretched over the row, accessible name starts with the visible label (`On <board>, which holds owner/name`), list height cut mid-row to show that it scrolls.
- Placement lookup: the truncation warning also covers the Maintenance query, which has no unique-index backstop.
- Not changed, tracked in `TODOS.md`: metadata validation of add requests, the owner filter of the board page, placement loading performance, parallel queries, composite foreign keys, copy polish. The suggested `auth.uid()` comparison inside `set_repocard_user_id` was left out: the E2E shard databases grant no USAGE on schema `auth`, so a name lookup of `auth.uid()` inside a function body fails there, and the repocard `WITH CHECK` policy already refuses the write.
- Migration checks and the old-schema smoke were repeated after these changes; results are in the pull request.

### Changes from the second review pass (2026-10-11)

- Migration `20261011020000` also adds `forbid_statuslist_board_change` (a column cannot be moved to another board, which would strand its cards from the other side through a direct API call) and reports the number of already stranded cards as a WARNING in the migration output (count only).
- Undo writes each card's position as shown on screen instead of the card's `order` field, which drags never update (`toColumnPositions`); it says "Nothing to undo on this board" when the dragged card has left the board, and puts the cards back when the database refuses the write.
- Picker: Enter and Escape that confirm or cancel an IME conversion are ignored; a placement refresh that returns after the picker closed is dropped; "Nothing to add matches the search or filters." replaces "No repositories to add." when a search or filter is active.
- Held rows: the row-wide hit area applies to touch screens only, so the repository name can be selected with a mouse; hover and focus styles added; the now unneeded key handler on the link is gone.
- The add limit has one owner: the schema's `too_big` issue carries the sentence and the action passes it on.
- Tests: the cross-user move test now uses a move only the per-user index can reject and asserts the index name; picker tests for the store-based "already on this board" path, the notice after Cancel, and IME Enter.
