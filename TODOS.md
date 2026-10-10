# TODOs

Follow-up items surfaced during code review. Not ship-blockers — captured here so they don't get lost.

## Silent GitHub Token Refresh — P2 follow-ups

From the `/ship` adversarial review of `feat/silent-github-token-refresh` (PR #176).

> All items below are tracked as GitHub issues (#177-#187). Update issue status there; this file remains as the source narrative for context.

### UX

- [ ] **Clear refresh attempt counter on `/login?error=token_refresh_failed`** — [#178](https://github.com/laststance/gitbox/issues/178)

### Concurrency / correctness

- [ ] **Multi-tab PKCE collision** — [#179](https://github.com/laststance/gitbox/issues/179)
- [ ] **401 interceptor races freshly-set cookie** — [#180](https://github.com/laststance/gitbox/issues/180)
- [ ] **Race on rapid combobox open/close** — [#181](https://github.com/laststance/gitbox/issues/181)

### Security / rate-limit

- [ ] **`x-forwarded-for` first-IP spoofing on Vercel** — [#182](https://github.com/laststance/gitbox/issues/182)
- [ ] **Server-side `attempt` cap bypassed when `sessionStorage` unavailable** — [#183](https://github.com/laststance/gitbox/issues/183)
- [ ] **Error message reflection in `/login?error=...`** — [#184](https://github.com/laststance/gitbox/issues/184)

### Tests

- [ ] **Dedicated unit tests for `sanitizeNextPath`** — [#185](https://github.com/laststance/gitbox/issues/185)
- [ ] **Dedicated unit tests for `getForwardedClientIp`** — [#186](https://github.com/laststance/gitbox/issues/186)

### Risk acceptance

- [ ] **30-day provider token cookie TTL — risk re-confirm** — [#187](https://github.com/laststance/gitbox/issues/187)

## Board Read-Path Embed Optimization — P3 follow-ups

From the `/review` of `perf/board-read-embed` (the `/board/[id]` single-embed read path).
All items are **P3, non-blocking** for that PR: the refactor preserves behavior, and the
items below are either pre-existing conditions surfaced by the adversarial review or
explicit risk acceptances. Captured here; the P3 items below remain open. The **T5 cleanup
is done as of v0.3.1.3** — the dead `getStatusLists` / `getRepoCards` / `getBoardData`
(`board.ts`) and `getCommentsForCards` (`project-info.ts`) read-path functions are removed
(static analysis proved zero callers post-embed-migration, so the prod-confirmation gate was
obviated). `fetchBoardInitialData` was already removed by the v0.3.1.0 embed migration.

### Tests (paired with T5 cleanup, prod-confirmation gated)

- [ ] **`getBoardBundle` async DB-contract tests** — cover embed-error ⇒ throw (never a 404),
      `null` data ⇒ `null` ⇒ `notFound()`, zero-column ⇒ `createDefaultStatusLists`, and the
      `repocard.length >= 1000` truncation Sentry warning. Out of scope of the pure
      `remapBoardEmbed` unit suite (needs Supabase + PostgREST + RLS).
      _v0.3.1.0: the malformed-id ⇒ `null` path (404, never reaches Postgres) is now covered by
      `src/tests/unit/lib/actions/board-data.test.ts`; the Supabase-backed paths above remain._
- [x] **`logBoardTiming` flag tests** — assert no-op when `BOARD_TIMING_LOG` is unset and one
      structured line when set (the "1 line = deduped" dedup proof).
      _v0.3.1.1: covered by `src/tests/unit/lib/utils/board-timing.test.ts` — flag off ⇒ no-op,
      flag on ⇒ exactly one `board-timing` line carrying the board id + every segment, plus a
      module-tag lock. The per-call `toHaveBeenCalledTimes(1)` proves one line per call; the
      "1 line per request = React.cache dedup" property lives in `getBoardBundle`, not this unit._
- [x] **E2E `/board/[nonexistent-uuid]` ⇒ 404** — the not-found contract
      (`.maybeSingle()` null ⇒ `notFound()`) now has direct E2E cover.
      _v0.3.1.2: `e2e/logged-in/board-not-found.spec.ts` asserts the segment-local
      "Board not found" boundary renders for both a malformed board id (rejected by
      `boardIdSchema` before Postgres) and a well-formed but unseeded board UUID
      (`.maybeSingle()` null). Asserts page content, not HTTP status, since the App
      Router may stream a 200 before `notFound()` throws._

### Pre-existing product concerns (NOT introduced by this PR)

> These conditions exist in `main` today; they were **surfaced — not introduced** — by this
> PR's adversarial review. The single-embed refactor preserves the prior read behavior.

- [ ] **>1000 cards/columns silently truncated at the PostgREST `db-max-rows` cap** — the old
      `getRepoCards`/`getStatusLists` had the same cap with no warning; this PR added a Sentry
      warning for `repocard` only. A partial board can undercount cards before a destructive
      column-delete (`BoardPageClient` counts only loaded `repoCards`). Needs hard-fail / exact
      count / pagination before mutation-capable UI. Also add a `statuslist` cap check.
      _v0.3.1.0: the embed now orders `repocard` by `order` ascending, so truncation drops the
      highest-order cards deterministically rather than an arbitrary subset; the silent
      undercount / hard-fail / pagination work above remains open._
- [ ] **`/board/[id]` passes the full `board` row (incl. `user_id`) to the client for public
      boards** — pre-existing: the old page also used `select('*')` and passed the raw row.
      Public-board RLS lets any authenticated user read a public board by UUID, so consider
      stripping `user_id`/owner-only `settings` on this path the way `public-board.ts` already does.

### Accepted tradeoff

- [ ] **`generateMetadata` shares the full bundle fetch (and may create default columns)** —
      intentional: `React.cache` dedups it with the page render, which is the whole point of
      eliminating the duplicate board fetch. Reverting to a name-only metadata query would
      re-introduce the second round-trip. Revisit only if metadata-only prefetch paths emerge.

## One Repo Across Boards (#215) — deferred follow-ups

From the `/autoplan` review of issue #215 (one card per user and repository). None blocks that change.

### Paginate the repo placement lookup beyond 1000 rows

**What:** Page through `repocard` in the shared placement lookup instead of stopping at the PostgREST `max_rows` cap.

**Why:** A user with more than 1000 cards gets a truncated lookup, so the picker can offer a repo that is already placed and the add ends in the generic race sentence instead of naming the board.

**Context:** The lookup lives in `src/lib/actions/repo-card-duplicates.ts` and sends one Sentry warning when it returns exactly 1000 rows. The unique index `repocard_unique_repo_per_user` still blocks the duplicate. Related to the existing "more than 1000 cards silently truncated" item above. Start with `.range()` pages ordered by `id`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Reveal and focus the card when arriving from the picker's "On <board>" link

**What:** After following a held-row link, scroll to the card on the holding board and focus it.

**Why:** Today the user lands on the board and has to find the card by eye before moving it.

**Context:** Both design review voices recommended this; it was left out because it adds scope to #215 (User Challenge 2). Needs a card id in the link (query or hash), a scroll and focus on mount, and care with the virtualized columns.

**Effort:** M
**Priority:** P2
**Depends on:** None

### One-click "Move here" from the picker

**What:** Let a held row move the card to the current board directly.

**Why:** Moving a repo now takes: follow link, open card menu, Move to Another Board, pick board and column.

**Context:** `moveCardToBoard` already does the work and keeps `projectinfo`. The picker knows the current board; it needs a target column choice and a confirmation.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Enforce board vs Maintenance exclusivity in the database

**What:** Make it impossible at the DB level for one repo to be on a board and in `maintenance` at once.

**Why:** The rule is app-enforced only, so a race between restore and add can still produce both.

**Context:** Production had 0 overlaps on 2026-10-11. Needs a cross-table mechanism (trigger on both tables or a shared placement table) and its own audit and cleanup step.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Identify repositories by GitHub id instead of `owner/name`

**What:** Key uniqueness on the GitHub repository id so renames and transfers keep one identity.

**Why:** A renamed repo can be added a second time under its new name.

**Context:** New cards store `meta.githubId` as an untrusted client hint. A backfill must re-verify every id against the GitHub API before any constraint uses it.

**Effort:** L
**Priority:** P3
**Depends on:** None

### Repo search in the command palette

**What:** Find a repo across all boards from `⌘K` and jump to its board.

**Why:** With one placement per repo, "where is it" becomes the common question.

**Context:** `getUserRepoPlacements()` in `src/lib/actions/board-data.ts` already returns repo, board id and board name.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Viewport-aware layout for the Add Repositories panel

**What:** Make the picker panel fit narrow screens.

**Why:** The panel is a fixed `w-120`, which overflows narrow viewports. Its height is capped to the viewport since #215 (the panel scrolls), but the Cancel / Add row is not pinned: with both lists full the panel is about 700px tall, so at viewport heights of about 800px and below the Add button needs a scroll inside the panel, past two nested scrolling lists. A `flex flex-col` panel with a `shrink-0` footer and a shrinking listbox fixes it.

**Context:** Pre-existing. `src/components/Board/AddRepositoryCombobox.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Separate "Adding" state in the picker

**What:** Show an adding state on submit instead of `Loading repositories...`.

**Why:** Submitting reuses the catalog loading text, which reads as if the list were reloading.

**Context:** Pre-existing. Same component.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Open-board links inside the move and restore dialog errors

**What:** Turn the board name in the duplicate error into a link.

**Why:** The error names the holding board but offers no way to get there.

**Context:** The error is a plain string from `ActionUserError`. Would need a structured error payload. 0 such cases in the production audit.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Fail the parallel E2E run when seeding fails

**What:** Make `scripts/e2e-parallel.sh` and the shard restore stop on seed or restore errors (`ON_ERROR_STOP`).

**Why:** A failed seed leaves shards running against a partial fixture set, and tests that expect a fixture to be absent pass for the wrong reason.

**Context:** Found by the Codex eng review. The owner-independence test asserts its fixtures as a local guard.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Pin the Supabase CLI version in the production migration workflow

**What:** Pin the CLI version used by `.github/workflows/supabase-production.yml`.

**Why:** Migration behavior (transaction wrapping, history handling) can change between CLI releases.

**Context:** The #215 migration is one `DO` block so it does not depend on wrapping, but later migrations may.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Correct the "fixture auth cannot mutate" notes

**What:** Update the comments in `e2e/auth.setup.ts` and the E2E fixture section of `CLAUDE.md`.

**Why:** They say server-side mutations are not exercised under fixture auth, but `move-to-another-board.spec.ts` asserts DB rows after a server action in test mode.

**Context:** Test mode uses the `E2E_TEST_JWT` constant with the authenticated role (`src/lib/supabase/server.ts`). The real-account rule for local verification stays as is.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Validate the display metadata of an add request

**What:** Extend `addRepositoriesRequestSchema` to the fields stored in `repocard.meta` (description, language, topics, stars, visibility, updated date) and build the insert from the parsed data.

**Why:** Only `id`, `name` and `owner.login` are checked. A hand-crafted request can store a non-string description or an oversized payload, which breaks the render of the caller's own board and its public page.

**Context:** Found by the pre-landing security review of #215; the gap is older than that change and affects only the caller's own boards. Keep the schema as loose as the real GitHub payload (`visibility` may be `internal`, `description` and `language` may be null, `topics` may be missing), or legitimate repositories stop being addable. A database CHECK is needed if direct PostgREST inserts must obey it too.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Filter the board page by owner

**What:** Add the owner filter to `getBoardBundle` (`src/lib/actions/board-data.ts`) or strip `user_id` before passing the board to the client.

**Why:** The bundle relies on RLS alone, and RLS also returns other users' public boards. A signed-in user who opens `/board/<id>` of someone else's public board gets the owner UI (every write is still refused by RLS) and the raw board row, including `board.user_id`.

**Context:** Found by the red team pass of #215; older than that change. The board id is discoverable from the public page. While there, select explicit `repocard` columns in `public-board.ts` and in the bundle embed so the new `repocard.user_id` column cannot leak through a future mapper change.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Load placements without waiting behind the catalog action

**What:** Fetch the picker's placements through a GET route handler (or return them with the catalog), and keep the cached options on screen, non-interactive, while only placements are pending.

**Why:** Server Actions run one at a time on the client, so on first open the placement request waits for the catalog request. Every reopen also shows the spinner and resizes the panel, where it used to be instant.

**Context:** `src/hooks/board/useRepoPlacements.ts` resets on close on purpose: a held repository must never flash as selectable. A stale-while-revalidate variant has to keep that guarantee (options disabled until fresh placements arrive). Related: the "Separate Adding state" item above.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Run the independent queries of add and restore in parallel

**What:** Use `Promise.all` for the board check, the placement lookup and the max-order query in `addRepositoriesToBoard`, and for the sequential lookups in `restoreToBoard`.

**Why:** Each action makes three to five round trips in sequence; most do not depend on each other.

**Context:** `src/lib/actions/repo-cards.ts`. The unit tests stub the queries in call order, so they need updating together. Once the production migration is applied and no legacy duplicate remains, the target-board pre-check in `moveCardToBoard` can go as well (the unique index covers it).

**Effort:** S
**Priority:** P3
**Depends on:** Production migration of #215 applied

### Tie `repocard.user_id` and `repocard.status_id` to the board declaratively

**What:** Replace the two triggers with composite foreign keys: `repocard (board_id, user_id) -> board (id, user_id) ON UPDATE CASCADE` and `repocard (status_id, board_id) -> statuslist (id, board_id)`.

**Why:** Triggers keep these invariants: `set_repocard_user_id` and `check_repocard_status_board` on `repocard`, `forbid_statuslist_board_change` on `statuslist`. Nothing covers a change of `board.user_id`: if a board ever changes owner, its cards keep the old `user_id` (and the direct cascade from `auth.users` would then delete them with the old owner's account).

**Context:** Board ownership cannot change today (the board UPDATE policy pins `user_id` to the caller, and the app has no transfer). Needs `UNIQUE (id, user_id)` on `board`, `UNIQUE (id, board_id)` on `statuslist`, and an audit that no stranded card exists (`s.board_id <> r.board_id`) before the constraint is added.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Keep Redux in step when a column is deleted, and drop late picker notices

**What:** (1) When a column is deleted, also remove its cards from the Redux store. (2) When an add finishes after the picker was closed, do not show its error or "not added" notice on the next opening.

**Why:** (1) The database deletes the column's cards by cascade, but the store keeps them until reload: an undo can bring such a card back on screen although its row is gone, and the picker hides its repository as already on this board. (2) Cancel and Escape stay enabled while an add is running, so its result can arrive on a closed picker; a later opening through a column's "Add Repo" button then shows that old notice.

**Context:** Found by the red team pass of #215; both are older than that change. `src/hooks/board/useStatusListDialog.ts` (`confirmDelete`), `src/components/Board/AddRepositoryCombobox.tsx` (`handleAddRepositories`, `openForStatus` in `useAddRepositoryCombobox`). Placements refreshed after close are already ignored by `useRepoPlacements`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Guard optimistic rollbacks against newer board state

**What:** When a drag or an undo fails to save, roll the screen back only if the board still shows the state that write produced; otherwise refetch the active board.

**Why:** The failure handlers of `useKanbanDnD` and `useKanbanUndo` dispatch the cards array captured when the action started. If the board changed while the request was in flight, that brings back a card removed meanwhile, drops a card added meanwhile, or, after navigating to another board, replaces that board's cards until reload.

**Context:** Needs a failed write plus a change inside the request window, so it is rare. The drag handler has behaved this way since before #215; the undo handler gained the same rollback in #215 (before, a failed undo left the screen and the database disagreeing). Found by the final adversarial pass of #215 (three reviewers agreed). A fix belongs in the reducer (compare a revision or the array identity) so both call sites share it; add tests with a deferred rejection.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Harden the #215 triggers and the undo history

**What:** (1) Let `check_repocard_status_board` return early on an UPDATE that changes neither `board_id` nor `status_id`. (2) Schema-qualify `public.board` and `public.statuslist` inside the three trigger functions. (3) Do not push an undo entry for a drag that changed nothing, or skip such entries when Z is pressed. (4) Reword the duplicate guard's message to "more than one card for the same user and repository".

**Why:** (1) The batch order RPC sets `status_id` on every row, so the trigger also checks unchanged rows; on a board that already holds a stranded card, every undo would be refused. Production held 0 stranded cards on 2026-10-11. (2) Defence in depth; no path to a temp-table shadow exists today. (3) Dropping a card back where it was pushes an entry equal to the board, and the next Z answers "Nothing to undo on this board" although an earlier drag can still be undone with one more Z. (4) The guard also counts letter-case variants on one board, which its message does not describe.

**Context:** `supabase/migrations/20261011011500_repocard_unique_repo_per_user.sql`, `supabase/migrations/20261011020000_repocard_status_board_guard.sql` (change them through a new migration once applied), `src/hooks/board/useKanbanDnD.ts` (`pushCardHistory` before the same-column branch), `src/hooks/board/useKanbanUndo.ts`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Polish left from the #215 design review

**What:** (1) Use one wording for a card's data in the Remove and Move dialogs ("its note, links and comment" vs "Notes, links, and comments"). (2) Give the permanent-loss sentence of the Remove dialog visual emphasis. (3) Add a visible heading to the "not added" notice. (4) Soften "Reload the page and try again" in the add race message, since the picker now refreshes itself. (5) Drop selected repositories that are no longer addable when the picker reopens.

**Why:** Small consistency and clarity gaps; none changes behavior.

**Context:** `src/components/Board/OverflowMenu.tsx`, `src/components/Modals/MoveToAnotherBoardDialog.tsx`, `src/components/Board/AddRepositoryCombobox.tsx`, `ADD_RACE_MESSAGE` in `src/lib/actions/repo-card-duplicates.ts`. The copy is asserted in unit and E2E tests.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed

- [x] **Preserve `?query` and `#hash` on silent refresh redirect** — [#177](https://github.com/laststance/gitbox/issues/177)
      **Completed:** v0.3.3.0 (2026-10-07). The repository catalog caller now forwards the full board destination, with unit coverage and a real-account OAuth round trip confirming both values survive.
