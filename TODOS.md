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

### Identify repositories by GitHub id instead of `owner/name`

**What:** Key uniqueness on the GitHub repository id so renames and transfers keep one identity.

**Why:** A renamed repo can be added a second time under its new name.

**Context:** New cards store `meta.githubId` as an untrusted client hint. A backfill must re-verify every id against the GitHub API before any constraint uses it.

**Effort:** L
**Priority:** P3
**Depends on:** None

### Repo search in the command palette

**What:** Find a repo across all boards from `⌘K` and jump to its board.

**Why:** With one placement per repo, "where is it" becomes the common question. The installed PWA has no find-in-page, so a long column can only be scrolled.

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

### Fail the parallel E2E run when seeding fails

**What:** Make `scripts/e2e-parallel.sh` and the shard restore stop on seed or restore errors (`ON_ERROR_STOP`).

**Why:** A failed seed leaves shards running against a partial fixture set, and tests that expect a fixture to be absent pass for the wrong reason.

**Context:** Found by the Codex eng review. The owner-independence test asserts its fixtures as a local guard.

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

### Load placements without waiting behind the catalog action

**What:** Fetch the picker's placements through a GET route handler (or return them with the catalog), and keep the cached options on screen, non-interactive, while only placements are pending.

**Why:** Server Actions run one at a time on the client, so on first open the placement request waits for the catalog request. Every reopen also shows the spinner and resizes the panel, where it used to be instant.

**Context:** `src/hooks/board/useRepoPlacements.ts` resets on close on purpose: a held repository must never flash as selectable. A stale-while-revalidate variant has to keep that guarantee (options disabled until fresh placements arrive). Related: the "Separate Adding state" item above.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Run the independent queries of add in parallel

**What:** Use `Promise.all` for the board check, the placement lookup and the max-order query in `addRepositoriesToBoard`.

**Why:** The action sends these queries one after the other, and none of them needs the answer of another.

**Context:** `src/lib/actions/repo-cards.ts`. The unit tests stub the queries in call order, so they need updating together.

**Effort:** S
**Priority:** P3
**Depends on:** None

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

## Set Work Aside on Boards (#213): deferred follow-ups

From the `/autoplan` review and the code review of issue #213 (a repository that is set aside is a card on an ordinary board). None of the follow-ups blocks that change.

### Refresh a card's GitHub metadata

**What:** Add an action that reads a repository from GitHub again and rewrites the `meta` of its card (description, language, topics, stars, visibility, updated date), for one card and for a whole board.

**Why:** `meta` is a snapshot from the moment a card is added and nothing updates it. A new description, star count, language or visibility on GitHub never reaches the card. Removing the card and adding it again would refresh it, but Remove from Board also deletes the note, links and comment.

A repository that was renamed or transferred keeps its former owner and name on the card. GitHub answers the former name with the repository at its new place, so the card still opens. But the picker compares names: it offers the repository under its new name as one that sits on no board, and it can be added a second time. Seen on 2026-10-12 in the local check of issue #213, with one migrated card whose repository had moved from the organization to the owner's account.

**Context:** `meta` is written in one place, `addRepositoriesToBoard` in `src/lib/actions/repo-cards.ts`, from the repository object the browser sends. A refresh should read GitHub on the server (`src/lib/actions/github.ts`) rather than trust a browser payload. It is a feature of its own: a server action with its own rate-limit key, a card-menu entry or a board-level button, and tests, about ten files in all. `meta.githubId` is the value that tells a renamed repository from another one: the picker has stored it since 2026-10-11, and the metadata fill of issue #213 wrote it for the migrated cards. Cards added before that date have none (19 on production on 2026-10-12), so a refresh has to write it too.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Give a board without columns its default columns once

**What:** Make the write in `createDefaultStatusLists` safe against two requests that read the same board without columns at the same moment: a database function that inserts the default columns only while the board has none (it takes a lock on the board row first), or a unique index on `(board_id, grid_row, grid_col)` with `ON CONFLICT DO NOTHING`.

**Why:** `getBoardBundle` reads the board, sees no column and inserts five. Two tabs that open the board at once both see none, and the board gets ten. It takes a board whose last column was deleted (or one made before boards were created with their columns) and two first views within the same moment, so it is rare, and the extra columns can be deleted by hand. Seen in the review of issue #213; the behavior is older than that change.

**Context:** `src/lib/actions/board-creation.ts` (`createDefaultStatusLists`), `src/lib/actions/board-data.ts` (`getBoardBundle`). `e2e/logged-in/board-without-columns.spec.ts` covers the single view. A unique index on the grid cell would also have to hold during a column swap, which writes two rows one after the other.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Decide what a shared board shows of a private repository

**What:** Leave private repositories out of the public page, or show them without their description, in `get_public_board`; and say in the Sharing tab of the board settings how many private repositories the board holds when it is made public.

**Why:** A shared board shows the owner, the name and the stored `meta` of every card to whoever has the link, with no filter on `meta.visibility`. Since issue #213 the move dialog and the Add Repositories picker say so at the moment a repository is put on a shared board. Making a board public that already holds private repositories says nothing, and the choice itself (should a public page ever show a private repository) was never made.

**Context:** `supabase/migrations/20261011030000_public_board_by_slug_only.sql` (`get_public_board`), `src/app/public/[slug]/PublicBoardClient.tsx`, `src/components/Boards/BoardSettingsDialog.tsx`. The sentences are in `src/components/Modals/MoveToAnotherBoardDialog.tsx` and `src/components/Board/AddRepositoryCombobox.tsx`. `meta.visibility` is a snapshot from when the card was added (see "Refresh a card's GitHub metadata").

**Effort:** S
**Priority:** P2
**Depends on:** None

## Board sync, shared boards and the Sentry tunnel — deferred follow-ups

From the `/ship` review of `fix/owner-filter-rollback-guard-sentry-tunnel`. None of them blocks that change.

### Fetch the board again through a server action, not `router.refresh()`

**What:** Let `useBoardServerSync` read the board's columns and cards with a server action and pass the answer through `selectMayApplyServerSnapshot`, instead of calling `router.refresh()`. Give each fetch a request id so a late answer for a board that was left and reopened is dropped, and offer a retry when the fetch fails.

**Why:** When the browser reports "online" but the server cannot be reached, `router.refresh()` makes Next.js fall back to a full navigation and the app is replaced by the browser's error page; saves fail in exactly that situation, and a failed save is what asks for the fetch. A server action can fail without leaving the app.

**Context:** `src/hooks/board/useBoardServerSync.ts`, `src/lib/redux/slices/boardSyncSlice.ts`. Server actions run one at a time, so the read is ordered after every write already sent. That order is also a wait: `router.refresh()` and a server action both stand in the queue of Next.js behind a write that has no answer yet, so the fetch after an overdue save (issue #213) goes out only when that save has settled, and until then "Reload page" is the way to the saved board. A read that has to get past such a write needs a way outside the queue, a route handler called with `fetch` for one. Three smaller gaps close with the same change or become harmless: column create, rename and delete, adding repositories and comment edits are not counted by `trackBoardWrite`, so a fetch can be sent while one of them is in flight; a save of board A that fails after board B was opened asks for a fetch of B; and `useStatusListDialog` builds the next column list from the list it captured before its await.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Show the fetched board name, subtitle and card display settings after a refetch

**What:** Let `useBoardSettings` take the board name, the subtitle, the card display settings and the show-subtitle switch from the board that was fetched again, the way it already does for the share slug.

**Why:** Since `router.refresh()` keeps the page's state (Issue #218), these four keep the value this tab showed. Changed in another tab, they stay old until the page is reloaded. Before, the refetch built the page again and they were read anew as a side effect.

**Context:** `src/hooks/board/useBoardSettings.ts`: the four are `useState` values that start from the props. `shareLink` there remembers which fetched value it was set from and resets when that changes; the same applies here. Compare the settings by content, not by reference: the fetched `board.settings` is a new object on every fetch, and a copy read before a save landed must not put the old settings back.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Fit a column undo to the columns that are on the board now

**What:** Make a column undo (Z after a column drag) put back positions only: keep each column's current name, leave out a column that was deleted since the drag, and keep a column that was added since.

**Why:** `useKanbanUndo` puts the snapshot taken before the drag back as it is. After a column drag, a rename and Z, the old name is shown again while the database keeps the new one. A column deleted since the drag comes back on screen and its position is sent to the server, and a column added since disappears until reload. Card undo already handles this through `reconcileUndoSnapshot`.

**Context:** `src/hooks/board/useKanbanUndo.ts` (`columnsAfterUndo`). Seen at hook level on 2026-10-11: with a snapshot of three columns, then one renamed, one deleted and one added, the undo dispatched the three old columns and sent all three ids. Not tried in a browser. A refetch no longer empties the undo history (Issue #218), so a column changed in another tab reaches the same path.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Fix the hydration mismatch on the board page for returning users

**What:** Make the first client render of `KanbanBoard` match the server HTML when the browser already holds a persisted board in localStorage.

**Why:** The server renders `KanbanSkeleton` because the Redux store is empty there, while the browser's first render already has the persisted columns and renders the grid. React reports "Hydration failed" (minified error #418 in production) and regenerates the tree on every board visit.

**Context:** Seen on production and on `localhost:3008` with the real account on 2026-10-11. `ssr-hydration-board.spec.ts` does not catch it because the fixture browser starts with an empty localStorage. The store is filled from `initialData` by `useBoardServerSync` in a `useLayoutEffect`; rendering the board from `initialData` on the server and on the first client render would remove both the skeleton flash and the mismatch.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Fail a card or column move that matched no row

**What:** Add `.select('id')` to the position updates in `src/lib/actions/board.ts` and throw when nothing came back.

**Why:** A move of a card that another tab removed, or that row level security hides because the tab's session changed, resolves as a success. Nothing is rolled back and nothing is fetched again, so the card stays in its new column on screen with nothing saved. The rollback and refetch added for failed saves only react to rejected writes.

**Context:** `updateRepoCardPosition` and its batch and column siblings check `error` only. Older than the rollback guard.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Clear the persisted board data on sign-out

**What:** On sign-out and account deletion, clear the `board` and `draft` slices stored under `gitbox-state` in localStorage (keep the theme and display settings), or store the owner's user id with them and drop them when it differs from the signed-in user.

**Why:** On a shared browser the next account still holds the previous user's columns, cards (private repository names included) and note drafts.

**Context:** `slices: ['settings', 'board', 'draft']` in `src/lib/redux/store.ts`; `signOut` in `src/lib/actions/auth.ts` redirects without touching client state. Older than this change. The settings slice also keeps `moveDestinationByBoard`, a map of board ids to board ids (no names); another account never reads an entry, because its boards have other ids, but the map should be emptied with the rest.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Forward only the headers Sentry needs through the tunnel

**What:** Build the headers of the forwarded tunnel request from a short allowlist (`content-type`, `content-encoding`, `user-agent`, `origin`, `referer`, `x-forwarded-for`, `accept-encoding`) instead of copying every header and deleting `cookie`. While there, match the tunnel path with one anchored pattern instead of `replace(/\/+$/, '')`, and decide whether a report sent without `Content-Length` should be refused.

**Why:** Every header the proxy sees except `Cookie` goes to sentry.io with each report. The browser sends nothing else that is secret, but headers the platform adds for a function would go along if the proxy receives them: Vercel documents `x-vercel-oidc-token` as a request header of its functions. Whether the proxy gets it was not checked on a deployment. Before this change the whole header set, cookies included, was forwarded for signed-in users, so this is hardening, not a regression. The trailing-slash pattern is quadratic on a long run of slashes that is not at the end of the path (about 70 ms for a 14 kB path). The tunnel limits each client address to 120 reports a minute and refuses a declared length above 20 MiB, but it never reads the body, so a report sent with chunked encoding is not measured. Answering 411 to those would bound the size for real, and would drop every report if a browser or the platform stopped sending the header.

**Context:** `forwardSentryReport` and `isSentryTunnelPath` in `src/proxy.ts`. `NextResponse.rewrite(..., { request: { headers } })` lists every remaining header name in `x-middleware-override-headers`, which is how `src/tests/unit/middleware.test.ts` sees what is forwarded. The limit's key is the first `X-Forwarded-For` entry. On Vercel the platform overwrites that header: on a preview deployment, a client over its limit stayed over it when it sent a made-up `X-Forwarded-For`, `X-Real-IP` or `X-Vercel-Forwarded-For`. So #182 matters only on a host that passes the client's own header through.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Count the proxy's rate limits across instances

**What:** Give the Sentry tunnel limit and the `/auth/callback` limit one count for all server instances: a Vercel Firewall rate-limit rule on those paths, `checkRateLimit` from `@vercel/firewall` with such a rule, or a shared store.

**Why:** `edgeRateLimit` counts in the memory of one instance. On production one browser sent 1,800 tunnel reports in 14 seconds and about 1,300 were forwarded before the first 429; 123 sent one after another got no 429 at all. A preview deployment refused the 121st, as a single instance does. The more requests arrive, the more instances run, so the limit loosens under exactly the load it is for. The same holds for the 10 a minute on `/auth/callback`.

**Context:** `src/lib/rate-limit/edge-memory.ts`, `src/proxy.ts`, `RATE_LIMIT_CONFIG`. A firewall rule needs no code but lives in the Vercel project settings. The Server Action limiter (`src/lib/rate-limit/memory.ts`) is in-memory too.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Pin the proxy matcher and Sentry's own tunnel rewrite in tests

**What:** Add a unit test that compiles `config.matcher[0]` of `src/proxy.ts` and expects `/monitoring`, `/Monitoring` and `/monitoring/` to match, and one that reads the rewrites `withSentryConfig` adds and pins their `source`.

**Why:** `tunnelRoute` keeps Sentry's rewrite registered. It takes the Sentry project from the query string and forwards cookies. It stays unreachable only while the proxy runs for the path and the proxy's path check is at least as wide as the rewrite's source (`/monitoring(/?)` in `@sentry/nextjs` 11.4.0). Excluding the route from the matcher, which Sentry's setup text suggests, or an SDK upgrade that widens the source would reopen it with every test green.

**Context:** `src/proxy.ts`, `next.config.ts`, `node_modules/@sentry/nextjs/build/cjs/config/withSentryConfig/tunnel.js`. The alternative is to drop `tunnelRoute` and set `tunnel` in `Sentry.init`, which loses the SDK's dropping of tunnel spans.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Word every failed board save from what the rollback did

**What:** (1) In `useOptimisticCardAction`, pass the rollback outcome to `notifyFailedBoardSave` on the `{ success: false }` branch too, and keep the server's message as the description when the card was put back. (2) Give a refused undo its own text: "Please try again." is wrong there because the undo step is gone. (3) Show one notice when a save fails offline, not the failed-save toast plus "You're offline", and keep the offline notice up while a save is pending. (4) Give the offline notice a close button. (5) After a save that threw, ask for a fresh copy of the board as well as putting the previous layout back.

**Why:** (1) Remove from Board is refused through `{ success: false }`. When the board changed in the meantime the card is not put back and the board reloads without saying so, and a burst of refusals stacks toasts. (2) to (4) The two notices disagree, the offline one disappears whenever a save starts, and it stays up with no button to close it. (5) A request can be committed before the connection drops; the screen then shows the old layout while the database holds the new one until the next reload. Do (5) after "Fetch the board again through a server action, not `router.refresh()`": a refetch sent while the server cannot be reached replaces the app with the browser's error page today.

**Context:** `src/hooks/board/useOptimisticCardAction.ts`, `src/hooks/board/useKanbanUndo.ts`, `src/hooks/board/useBoardServerSync.ts`, `src/hooks/board/useBoardRollback.ts`, `src/lib/utils/notify-failed-board-save.ts`. See also "Let a refused undo be tried again".

**Effort:** M
**Priority:** P2
**Depends on:** None

### Cover the board-sync and sharing wiring the unit tests mock away

**What:** Add tests for (1) the owner filter of `lookupRepoPlacements`, with a query stub that records `eq()` and expects `['board.user_id', userId]`, and correct the Arrange comment of "still offers and adds a repository that sits on another user's public board" in `e2e/logged-in/one-repo-across-boards.spec.ts`; (2) `BoardSettingsDialog` calling `onPublicChange`, and `BoardPageClient` copying the public link with the real `useBoardSettings`; (3) `setStatusLists`, `addRepoCards` and `removeRepoCard` each making a fetch in flight out of date, plus a test that lists `boardSlice`'s actions so a new reducer forces the decision; (4) the rate-limit refusal of `getPublicBoardBySlug`.

**Why:** Removing any of these leaves every test green. (1) lost its only failing test when the public read policies were dropped: row level security now hides other users' cards with or without the filter. (3) `addRepoCards` and `removeRepoCard` are not wrapped in `trackBoardWrite`, so the revision bump is their only protection against a stale fetch.

**Context:** `src/tests/unit/lib/actions/repo-card-duplicates.test.ts`, `src/tests/unit/app/board/BoardPageClient.test.tsx`, `src/tests/unit/hooks/board/useBoardServerSync.test.tsx`, `src/tests/unit/lib/actions/public-board.test.ts`, the `isAnyOf(...)` matcher in `src/lib/redux/slices/boardSyncSlice.ts`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Tell a failed lookup apart from a missing shared board

**What:** Give `/public/[slug]` its own answers for "too many requests" and "the lookup failed" instead of the 404 page.

**Why:** `getPublicBoardBySlug` returns `null` for a rate-limited visitor and for a database error as well as for an unknown slug, so a working share link can say "This shared board isn't available" for a minute.

**Context:** `src/lib/actions/public-board.ts`, `src/app/public/[slug]/not-found.tsx`. Older than this change.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Let a refused undo be tried again

**What:** Decide what happens to an undo step whose save was refused. Today the step is gone: the board goes back to the layout before the undo and pressing Z again undoes the step before it.

**Why:** After a network blip the user has to drag the card back by hand. Putting the step back on the stack is not enough on its own: a refusal that will not go away (the old column was deleted) would then block every older step behind it, because the top of the stack is always tried first.

**Context:** `handleUndo` in `src/hooks/board/useKanbanUndo.ts`. The rollback returns `'restored'` or `'reload-requested'`, which says whether the board on screen is still the one the step belongs to.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Skip the localStorage save after actions that change nothing persisted

**What:** Make `@laststance/redux-storage-middleware` schedule its debounced save only when a persisted slice changed.

**Why:** It schedules a save after every action. The `boardSync` slice is not persisted and dispatches several actions per drag, each of which serializes the whole persisted state again 300 ms later.

**Context:** The middleware lives in its own package; the fix belongs there, not in the app.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Check the board after browser Back following a drag

**What:** Drag a card, open `/boards`, press the browser's Back button and check where the card is. Fix it if the card shows in its old column.

**Why:** Back may restore page data that Next.js cached before the drag. With nothing in flight `useBoardServerSync` treats page data as current and puts it in the store. This is a review hypothesis that was not reproduced, and if it is real it is older than the rollback guard.

**Context:** `selectMayApplyServerSnapshot` in `src/lib/redux/slices/boardSyncSlice.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Stabilize the "Optimistic Favorite Toggle" story test

**What:** Find why `BoardGrid.stories > Optimistic Favorite Toggle` fails now and then when the unit, lint and typecheck lanes run in parallel.

**Why:** It failed in some of the full local runs on 2026-10-11 and passed in others with no change to the code it covers. A test that fails under load hides real failures.

**Context:** Storybook project of `pnpm test` (browser mode). Not touched by this change.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Give the board-sync gates a deadline

**What:** Give tracked board writes a deadline, or count pending writes per board, and release the "fetch sent" marker when a refetch delivers no data.

**Why:** `pendingWriteCount` is counted for the whole app and drops only when a write settles. One save that never answers holds back every board refresh and drops fetched data, while the failed-save toast of another write says the board is reloading. `sentRefreshRevision` is cleared only when page data arrives; a refetch that is interrupted without a reload or a new page render leaves it set, and later refresh requests wait for it.

**Context:** `trackBoardWrite`, `boardRefreshSent`, `selectIsBoardRefreshDue` and `selectMayApplyServerSnapshot` in `src/lib/redux/slices/boardSyncSlice.ts`. Both are review hypotheses that were not reproduced: a server action normally ends with the platform's function timeout, and a failed refetch reloads the page, which starts from an empty `boardSync` state.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Trim what a shared board link gives away

**What:** (1) Issue a new slug when sharing is turned on again, or add a "reset link" action. (2) Leave `board_id` out of the JSON `get_public_board` returns and map shared columns and cards without it. (3) Return only the card `meta` fields the shared page renders (description, language, stars), say in the validator's comment that nested objects are not filtered, and decide whether the description of a private repository belongs on a shared board. (4) Decide whether the function needs a limit of its own: the app's `publicBoardView` rate limit does not cover a direct call through the REST API, and its key is the first `X-Forwarded-For` entry, or a new UUID per request when the header is missing.

**Why:** The 12-hex slug is now the only thing between a visitor and a shared board. A leaked link cannot be revoked, because turning sharing off and on keeps the slug. The board's id and each card's `visibility`, `topics` and `updatedAt` reach the page payload although the page shows none of them.

**Context:** `supabase/migrations/20261011030000_public_board_by_slug_only.sql` (change it through a new migration once applied), `toggleBoardPublic` and `generateSlug` in `src/lib/actions/board.ts`, `src/lib/validations/public-board.ts`, `src/lib/actions/mappers.ts`, `src/lib/utils/get-client-ip.ts`. None of this is new with this change: before it, shared boards could be listed without knowing a slug.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Correct the board-sync docstrings and the shape-check report

**What:** (1) Wrap the server action in `trackBoardWrite` in the `@example` of `useBoardRollback`, and state that the optimistic array must be created for that write. (2) In the JSDoc of `useBoardServerSync`, say that only saves tracked with `trackBoardWrite` are protected and that pending saves are counted for the whole app. (3) Send the slug with the "unexpected get_public_board shape" report, as the RPC-error report does, and assert the whole call in its test. (4) Add a note above `reducers` in `boardSlice.ts` that points at the stale-fetch matcher.

**Why:** A write copied from the example is not counted as pending. The JSDoc promises more than the code does. A shape report without the slug cannot be traced to a board.

**Context:** `src/hooks/board/useBoardRollback.ts`, `src/hooks/board/useBoardServerSync.ts`, `src/lib/actions/public-board.ts`, `src/lib/redux/slices/boardSlice.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Keep the Copy Link target in step with the board's sharing state

**What:** (1) Show on the Copy Link button whether it copies a public or an owner-only link, and decide whether the board should be fetched again when the tab gets focus. (2) Make `toggleBoardPublic` write a new slug only where none is stored (`.is('share_slug', null)`) and return the stored one. (3) Catch a failed toggle in `handleTogglePublic` and say so.

**Why:** `useBoardSettings` follows the sharing state of the fetched board, but the board is fetched again only after a failed save or a reload. After sharing was changed in another tab, Copy Link hands out the owner-only address, or a dead public link with the wrong toast text, until then. The button looks the same in both states. Two toggles sent at once can each generate a slug, and the dialog keeps one the database does not hold. A toggle that fails on the network shows nothing.

**Context:** `src/hooks/board/useBoardSettings.ts`, `handleCopyBoardLink` in `src/app/board/[id]/BoardPageClient.tsx`, `toggleBoardPublic` in `src/lib/actions/board.ts`, `handleTogglePublic` in `src/components/Boards/BoardSettingsDialog.tsx`. The server code and the missing catch are older than this change; Copy Link now reads their result.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Drop a deleted column from the column undo history

**What:** When a column is deleted, remove it from the entries of `columnHistory`, or skip entries that hold a column the board no longer has.

**Why:** Delete a column, then press Z while an earlier column move is on the stack: the whole earlier column list is put back, the deleted column included. The position update for its id matches no row and reports success, so nothing is rolled back and the column stays on screen until reload.

**Context:** `handleUndo` in `src/hooks/board/useKanbanUndo.ts` (the card path filters against the current cards, the column path does not), `confirmDelete` in `src/hooks/board/useStatusListDialog.ts`. Older than this change. Related: "Keep Redux in step when a column is deleted, and drop late picker notices" and "Fail a card or column move that matched no row".

**Effort:** S
**Priority:** P3
**Depends on:** None

### Polish and simplification left from the board-sync review

**What:** (1) Label the URL field of the Sharing tab in `BoardSettingsDialog`. (2) Give the shared-board 404 page the app's name and logo. (3) Consider turning `useBoardRollback` into two thunks next to `trackBoardWrite`, which removes the hook, its types and four threaded parameters (about 70 lines). (4) Consider sending a signed-in visitor of someone else's shared board from `/board/<id>` to its public link instead of "Board not found".

**Why:** Small accessibility, identity and structure gaps. None changes what is saved. The unlabelled field is older than this change.

**Context:** `src/components/Boards/BoardSettingsDialog.tsx`, `src/app/public/[slug]/not-found.tsx`, `src/hooks/board/useBoardRollback.ts`, `src/app/board/[id]/not-found.tsx`.

**Effort:** M
**Priority:** P4
**Depends on:** None

## Completed

- [x] **Preserve `?query` and `#hash` on silent refresh redirect** — [#177](https://github.com/laststance/gitbox/issues/177)
      **Completed:** v0.3.3.0 (2026-10-07). The repository catalog caller now forwards the full board destination, with unit coverage and a real-account OAuth round trip confirming both values survive.
