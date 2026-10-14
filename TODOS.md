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
      The destination lookup of Move to Another Board (`getUserBoardsWithStatusLists` in
      `src/lib/actions/repo-cards.ts`) reads the columns of all the user's boards under the same cap
      and without a warning: past 1000 columns a board shows in the dialog without some or all of
      its columns, and a card cannot be moved there. Raised again by the last review of #213.
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

**Context:** New cards store `meta.githubId` as an untrusted client hint. A backfill must re-verify every id against the GitHub API before any constraint uses it. Since #216 the note, links and comment of a repository are keyed by `owner/name` too (`projectinfo.repo_key`, unique per user): a repository renamed or transferred on GitHub and added again under its new name starts empty, while its memory waits under the old name. The `projectinfo` key and the computed relationship `projectinfo(repocard)` have to move to the GitHub id together with the card's key.

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

### Drop late picker notices

**What:** When an add finishes after the picker was closed, do not show its error or "not added" notice on the next opening.

**Why:** Cancel and Escape stay enabled while an add is running, so its result can arrive on a closed picker; a later opening through a column's "Add Repo" button then shows that old notice.

**Context:** Found by the red team pass of #215; older than that change. `src/components/Board/AddRepositoryCombobox.tsx` (`handleAddRepositories`, `openForStatus` in `useAddRepositoryCombobox`). Placements refreshed after close are already ignored by `useRepoPlacements`. The other half of this item (the cards of a deleted column stayed in the Redux store, so the picker hid their repositories until a reload) was fixed with #216 (`removeStatusListWithCards`). An undo can still bring such a card back on screen although its row is gone: the undo history keeps it.

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

**What:** (1) Use one wording for a card's data in the Remove and Move dialogs ("its note, links and comment" vs "Notes, links, and comments"). (2) Done by #216: the Remove dialog no longer has a permanent-loss sentence (the note, links and comment are kept). (3) Add a visible heading to the "not added" notice. (4) Soften "Reload the page and try again" in the add race message, since the picker now refreshes itself. (5) Drop selected repositories that are no longer addable when the picker reopens.

**Why:** Small consistency and clarity gaps; none changes behavior.

**Context:** `src/components/Board/OverflowMenu.tsx`, `src/components/Modals/MoveToAnotherBoardDialog.tsx`, `src/components/Board/AddRepositoryCombobox.tsx`, `ADD_RACE_MESSAGE` in `src/lib/actions/repo-card-duplicates.ts`. The copy is asserted in unit and E2E tests.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Repository Memory (#216) — deferred follow-ups

From the `/plan-eng-review` of issue #216 (a repository keeps its note, links and comment when its card goes). None blocks that change.

### Page the saved-memory lookup beyond 1000 rows

**What:** Page through `projectinfo` in `lookupSavedRepositoryMemories` instead of stopping at the PostgREST `max_rows` cap.

**Why:** A user with more than 1000 saved repositories gets some picker rows without their `Saved: ...` mark. Adding such a repository still brings its memory back: the mark is the only thing missing.

**Context:** The lookup in `src/lib/actions/saved-repository-memories.ts` reads every row of the user and sends one Sentry warning when it returns 1000 rows or more. Page it the way the placement lookup item above proposes (`.range()` pages ordered by `id`), or ask only for the repositories the picker lists.

**Effort:** S
**Priority:** P3
**Depends on:** None

### List more than 1000 repositories of a source in the picker

**What:** Let the Add Repositories catalog page past 1000 repositories per user or organization.

**Why:** A repository beyond that cap is never listed, so it can neither be added nor show that something is saved for it.

**Context:** Measured during the #216 review: the owner sees 212 repositories, far below the cap. Revisit when a source comes near it.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Read only what the picker's marks need, after the list

**What:** Let the database answer the marks (`has_note`, `link_count`, `has_comment` per repository key, for example through a view), and stop holding the Add Repositories list until they arrive.

**Why:** `lookupSavedRepositoryMemories` selects the whole note (up to 20,000 characters), the links and the comment of every row of the user on each opening of the picker, only to compute three values per row. Rows now outlive their cards, so their number only grows. And the lookup runs in the same `Promise.all` as the placements: a slow memory query holds the list, although the marks are extra. Found by the pre-landing review of #216 (performance, security, data migration and red team); the owner has 10 rows today.

**Context:** `src/lib/actions/saved-repository-memories.ts` and `getUserRepoPlacements` in `src/lib/actions/board-data.ts`. A note is an editor document (JSON): a view would have to decide "has text" the way `isSlateValueEmpty` does, or keep that decision in the app and select only the notes of repositories on no board. Pair it with the paging item above.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Rate-limit the project info writes

**What:** Wrap `upsertProjectInfo`, `updateComment`, `updateCommentColor` and `deleteComment` (`src/lib/actions/project-info.ts`) in `withAuthResultRateLimit` with a key of their own, and the read in `withAuthResult`.

**Why:** They are endpoints any signed-in browser can call with arguments of its choice, and they have no limit. That predates #216, which raises the cost: each write is two round trips now (the card, then the row), and the rows it makes survive the card, so a flood is no longer cleaned up with its cards. Found by the security review of #216.

**Context:** The actions catch their own errors today and return the message. Moving them onto the guards changes which messages reach the browser (the guards replace unexpected ones with a generic text): check the toasts of the Note dialog and the comment editor, and `browser-callable-actions.test.ts`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Keep a note draft where its card's repository can reach it

**What:** Key the Note dialog's draft by repository (the lowercase key of `projectinfo.repo_key`) instead of by card id, or say in the failure toast when the draft belongs to a card that is gone.

**Why:** A refused note save says "Your text is kept: open the note again to save it." The draft is kept under the card id. When the save failed because the card is gone (removed in another tab), adding the repository again makes a new card, and the typed text is out of reach: the toast promises too much. Found by the red team review of #216.

**Context:** `useNoteModalDraft` (`src/hooks/board/useNoteModalDraft.ts`) and the `draft` slice. The client must tell a missing card from other failures by an error code, never by the message (CLAUDE.md): `getProjectInfoCore` and the writes throw "Card not found" today. Open Question 1 of the #216 design names the same key.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Keep note edits made while an earlier save is pending

**What:** In `handleSave` of `useNoteModalDraft`, delete the draft after a successful save only when it is still the draft that save sent (compare its `lastModified`, which `updateDraftNote` stores, with the value at the moment Save was pressed).

**Why:** The draft is deleted when the server has answered, not when Save is pressed. It was before #216 too; #216 made a refused save keep the text. If the user opens the same note again while the save is on its way, types and closes the dialog, the answer that arrives then deletes the newer draft and those edits are gone. The window is one server round trip (a few hundred milliseconds on production). Found by CodeRabbit on #216's PR; left out of #216 because a fix there would have been the review's third fixing cycle.

**Context:** `handleSave` and `deleteDraftNote` in `src/hooks/board/useNoteModalDraft.ts`, the `draft` slice. A test holds the save's promise open, reopens, edits, closes, then resolves it.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Count a note's length where the database counts it

**What:** Make the Note dialog's limit and `note_length_check` count the same thing: either the dialog counts the length of the stored editor document (JSON), or the check moves to a limit on the text and the column gets a larger cap for the markup.

**Why:** The dialog counts the text and stops input at `NOTE_MAX_LENGTH` (20,000 characters). The database checks `length(note) <= 20000` on the JSON it stores, which is longer than the text: every paragraph, mark and link adds markup. A long note of 15,000 characters can be refused, the toast says the text is kept, and each later save is refused again, with nothing that says why. That predates #216; #216 makes notes outlive their cards, so a note that cannot be saved stays in the way longer. Found by the red team review of #216.

**Context:** `NOTE_MAX_LENGTH` in `src/hooks/board/useNoteModalDraft.ts`, `NoteSection` (the counter), `supabase/migrations/20251230100000_add_note_to_projectinfo.sql` (the check). The refusal reaches the browser as the generic save failure; an error code for 23514 would let the toast name the limit.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Pin what #216's saves keep against a real database, and the other review leftovers

**What:** Add data-access tests that send the exact payloads of `upsertProjectInfoCore`, `updateCommentCore` and `updateCommentColorCore` through the test user's client with `onConflict: 'user_id,repo_key'` (a comment save keeps the note and links, a note save keeps the comment and color, a color-only save makes a row with the column defaults), a test that deleting a user deletes their `projectinfo` rows, a test that a visitor cannot call `/rpc/projectinfo`, and a whitespace-only comment row in the `summarizeMemoryRow` table. Correct the header of `project-info-core.test.ts`, which says the e2e specs cover the upsert merge. Bring the JSDoc of `useRepoPlacements` (it returns `savedMemories` too) and the `CreatedRepoCard` example (its `comment` goes to the comment map, not to Redux) up to date. Keep the Delete Column dialog's title and card count while it fades out (it shows `""` and no card sentence for 200ms; on `main` it showed `"undefined"`).

**Why:** The third review pass of #216 found these. Each was checked by hand before the merge (the functional QA of the review saved a comment over a note and read both back, and the local check as ryota-murakami deleted a comment and kept the note and two links), but no committed test pins them: a regression in the upsert payloads would silently wipe the memory #216 exists to keep. They were left out of #216 because a fix there would have been the review's third fixing cycle.

**Context:** `e2e/logged-in/project-info-data-access.spec.ts`, `src/tests/unit/lib/actions/project-info-core.test.ts`, `src/tests/unit/lib/actions/saved-repository-memories.test.ts`, `src/hooks/board/useRepoPlacements.ts`, `src/lib/actions/repo-cards.ts`, `src/hooks/board/useStatusListDialog.ts`. The user deletion needs a throwaway user from the admin API, never a seeded one.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Harden #216's note paths against what its last review found

**What:** Refuse a `/` in `repocard.repo_owner`, `repocard.repo_name` and the same columns of `projectinfo` with a check constraint, so the generated `repo_key` names the same repository as `repocard_unique_repo_per_user`. Hand the PostgREST error of a failed note read, note save or comment save to Sentry (`new Error(message, { cause: error })` and `error.code` in `extra`). Let `useNoteModal.open` drop an answer when another card was opened after it was sent. Let the server's comment win over a restored one in `BoardPageClient` (`{ ...restoredComments, ...initialData.comments }`). Say on the Account page that deleting the account deletes the notes, links and comments too.

**Why:** The adversarial pass of #216's ship review found these. GitHub never puts a `/` in an owner or a name and the server actions refuse one, but a signed-in user can write the table through PostgREST: two cards `a/b`+`c` and `a`+`b/c` pass the card's key and collide in `repo_key`, which stops the migration (it rolls back). Production had 0 such cards out of 50 on 2026-10-15, and the rollout runbook checks again in its freeze window. A failed save now reaches Sentry as one generic message whatever the database said (42703 during the deploy window, 42501 for a card deleted in another tab, 23514 for a note over the limit). The other three are low: an earlier request answering last opens the wrong card's note, a restored comment shadows a newer server comment only if the board remounts, and the Account copy names boards, cards and settings only.

**Context:** `supabase/migrations/20261014130000_projectinfo_belongs_to_repository.sql`, `src/lib/actions/project-info-core.ts`, `src/lib/actions/project-info.ts`, `src/hooks/board/useNoteModal.ts`, `src/app/board/[id]/BoardPageClient.tsx`, `src/app/account/AccountClient.tsx`. A constraint needs a migration that counts the rows it would refuse first.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Set Work Aside on Boards (#213): deferred follow-ups

From the `/autoplan` review and the code review of issue #213 (a repository that is set aside is a card on an ordinary board). None of the follow-ups blocks that change.

### Refresh a card's GitHub metadata

**What:** Add an action that reads a repository from GitHub again and rewrites the `meta` of its card (description, language, topics, stars, visibility, updated date), for one card and for a whole board.

**Why:** `meta` is a snapshot from the moment a card is added and nothing updates it. A new description, star count, language or visibility on GitHub never reaches the card. Removing the card and adding it again refreshes it, and since #216 the note, links and comment come back with it, but the card loses its column and its place there.

A repository that was renamed or transferred keeps its former owner and name on the card. GitHub answers the former name with the repository at its new place, so the card still opens. But the picker compares names: it offers the repository under its new name as one that sits on no board, and it can be added a second time. Seen on 2026-10-12 in the local check of issue #213, with one migrated card whose repository had moved from the organization to the owner's account.

**Context:** `meta` is written in one place, `addRepositoriesToBoard` in `src/lib/actions/repo-cards.ts`, from the repository object the browser sends. A refresh should read GitHub on the server (`src/lib/actions/github.ts`) rather than trust a browser payload. It is a feature of its own: a server action with its own rate-limit key, a card-menu entry or a board-level button, and tests, about ten files in all. `meta.githubId` is the value that tells a renamed repository from another one: the picker has stored it since 2026-10-11, and the metadata fill of issue #213 wrote it for the migrated cards. Cards added before that date have none (19 on production on 2026-10-12), so a refresh has to write it too.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Give a board without columns its default columns once, and a new account one first board

**What:** (1) Make the write in `createDefaultStatusLists` safe against two requests that read the same board without columns at the same moment: a database function that inserts the default columns only while the board has none (it takes a lock on the board row first), or a unique index on `(board_id, grid_row, grid_col)` with `ON CONFLICT DO NOTHING`. (2) Do the "only when the user has no board" check of `createFirstBoardIfNeeded` inside the database function, under a lock for that user (`pg_advisory_xact_lock`).

**Why:** (1) `getBoardBundle` reads the board, sees no column and inserts five. Two tabs that open the board at once both see none, and the board gets ten. It takes a board whose last column was deleted (or one made before boards were created with their columns) and two first views within the same moment, so it is rare, and the extra columns can be deleted by hand. (2) Two first sign-ins of one account that end at the same moment both count no board and both create "First Board". The second board can be deleted by hand. Both were seen in the reviews of issue #213; the behavior is older than that change. Two boards that one user creates at the same moment can also get the same position (`MAX(position) + 1` in `create_board_with_status_lists`); the lock of (2) would give them two.

**Context:** `src/lib/actions/board-creation.ts` (`createDefaultStatusLists`, `createFirstBoardIfNeeded`), `src/lib/actions/board-data.ts` (`getBoardBundle`), `supabase/migrations/20261012085900_create_board_with_status_lists.sql`. `e2e/logged-in/board-without-columns.spec.ts` covers the single view. A unique index on the grid cell would also have to hold during a column swap, which writes two rows one after the other.

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

### Bound the grid position of a column

**What:** Give `statuslist.grid_row` and `statuslist.grid_col` an upper bound in the table (a `CHECK` such as `BETWEEN 0 AND 999`, after counting the rows it would refuse), and let the actions that write a position answer a refusal with a sentence.

**Why:** A signed-in user can write any integer into the two columns through the API. The board page builds one drop zone per cell of the grid (`useKanbanDnD`), so a column at row or column 2147483647 makes that user's own board page hang, and each request for it runs until the function times out. The shared page prints the numbers into `repeat(N, …)`: Chromium laid out `repeat(2147483648, …)` in under half a second (measured on 2026-10-12), so a visitor sees a very wide page and nothing worse. The column color got its check in issue #213 for the same reason: the table refuses whoever writes. Older than that change.

**Context:** `src/hooks/board/useKanbanDnD.ts` (the loop over rows and columns), `src/app/public/[slug]/PublicBoardClient.tsx`, `supabase/migrations/20261012085950_statuslist_color_check.sql` (the pattern to follow: count first, then add the constraint), the column drag and "new row" writes in `src/lib/actions/board.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Say "this page is out of date" for an action the server no longer has

**What:** Tell a Server Action call the server rejected without running it (a tab of the build before a deployment calls an action id the new build does not have) from a request with an unknown outcome, and offer "Reload page" with a sentence that says the page is out of date.

**Why:** `requestBoardCreation` and the move dialog count every request that failed on the way as "may have happened". For such a tab that is wrong in a harmless direction: the user is told to check the boards, and the way offered there ("Open your boards", "Reload page") loads the new build. Seen in the review of issue #213, which renames arguments of `createBoard` and removes actions, so the first deployment is one where it can happen.

**Context:** `src/lib/utils/request-board-creation.ts`, `toMoveFailure` in `src/components/Modals/MoveToAnotherBoardDialog.tsx`. Next.js exports `unstable_isUnrecognizedActionError` from `next/navigation`; the name says that it may change. Vercel's skew protection would keep an old tab on its own build instead.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Keep `.env.production` out of the E2E builds

**What:** Pass an empty `SENTRY_AUTH_TOKEN` and the local `NEXT_PUBLIC_SITE_URL` to the builds of `pnpm e2e:parallel` and `pnpm e2e`, and the local service-role key to the server of `pnpm e2e`.

**Why:** `pnpm build` reads `.env.production` ahead of `.env`. On a machine that has that file, an E2E build takes `SENTRY_AUTH_TOKEN` and `NEXT_PUBLIC_SITE_URL` from it, so the source maps of a test build are uploaded to the Sentry project, and the server of `pnpm e2e` holds production's service-role key, which the local stack refuses (account deletion is the one place that uses it). Both commands pass the local Supabase URL and anon key themselves, so no test talks to production. Seen while checking #213 on a local production build.

**Context:** `scripts/e2e-parallel.sh` (the build step and the `next start` step), `webServer.env` in `playwright.config.ts`. `.github/workflows/e2e.yml` sets its own values, and CI has no `.env.production`. `CLAUDE.md` lists what a manual local production build has to export.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Two simplifications named in the last review round of #213

**What:** (1) Hand the outcome of a board creation to the form of the move dialog as it is (`BoardCreationAttempt` without its `created` case) and let the form choose from it, as `CreateBoardForm` of `/boards/new` does. Today it is renamed twice on the way: `toCreationFailure` makes a `BoardCreationFailure` with a `nextStep`, and `toFormProblem` makes a `FormProblem` with a `recovery`. (2) Render a comment's menu beside the element that opens the editor, not inside it: wrap both in a `group relative` element, keep the role of a button on the text alone and make the menu its sibling.

**Why:** Neither changes what the app does. (1) The mapping is one to one and `BoardCreationFailure` has one producer and one reader, about 50 lines. (2) The clicks and keys of the menu then never reach the handlers that open the editor, so `isOnCommentItself`, its ref and its two guards go (about 30 lines), and no button stands inside an element with the role of a button. Both were advice of the simplification reader on 2026-10-12, left out because each rewrites code that the tests and the checks of #213 had just pinned.

**Context:** `src/components/Modals/CreateDestinationBoardForm.tsx`, `toCreationFailure` in `src/components/Modals/MoveToAnotherBoardDialog.tsx`, `src/lib/utils/request-board-creation.ts`; `src/components/Board/CommentDisplay.tsx`, whose one user is `CommentSection`. `startedOnOwnElement` stays: `mayStartDrag` asks it. The comment remains a place where a card can be picked up, so the drag tests of `e2e/logged-in/what-starts-a-drag.spec.ts` and the stories of `CommentEditingWorkflow.stories.tsx` decide whether (2) is right.

**Effort:** S
**Priority:** P4
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

### Render the board on the server instead of its skeleton

**What:** Render `KanbanBoard` from `initialData` on the server and on the first client render.

**Why:** The server renders `KanbanSkeleton` because the Redux store is empty there. The columns and cards appear once the page has hydrated and `useBoardServerSync` has put `initialData` into the store, so a slow device shows a skeleton although the server already had the data. The hydration error this caused for returning visitors (React #418 on every board visit after the first) is fixed: the board is not kept in localStorage any more (see Completed).

**Context:** `src/hooks/board/useBoardServerSync.ts` fills the store in a `useLayoutEffect`. The components below `KanbanBoard` read columns and cards from the store, so the first render needs either a store that is filled per request on the server, or props that take precedence until the store holds the same board. `e2e/logged-in/board-page-hydration.spec.ts` checks that a board page hydrates without an error when the browser holds state from an older build.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Fail a card or column move that matched no row

**What:** Add `.select('id')` to the position updates in `src/lib/actions/board.ts` and throw when nothing came back.

**Why:** A move of a card that another tab removed, or that row level security hides because the tab's session changed, resolves as a success. Nothing is rolled back and nothing is fetched again, so the card stays in its new column on screen with nothing saved. The rollback and refetch added for failed saves only react to rejected writes.

**Context:** `updateRepoCardPosition` and its batch and column siblings check `error` only. Older than the rollback guard.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Clear the persisted drafts on sign-out

**What:** On sign-out and account deletion, clear the `draft` slice stored under `gitbox-state` in localStorage and the `moveDestinationByBoard` map of the settings slice (keep the theme and display settings), or store the owner's user id with them and drop them when it differs from the signed-in user.

**Why:** On a shared browser the next account still holds the previous user's note drafts. The columns and cards (private repository names included) are not stored any more since 2026-10-12, and a `board` slice that an older build stored is dropped the first time the app saves its state.

**Context:** `PERSISTED_SLICE_NAMES` in `src/lib/redux/persisted-slices.ts`; `signOut` in `src/lib/actions/auth.ts` redirects without touching client state. Older than this change. `moveDestinationByBoard` is a map of board ids to board ids (no names); another account never reads an entry, because its boards have other ids, but the map should be emptied with the rest.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Keep a note draft only for what was typed, and let a newer saved note win

**What:** (1) Do not store a draft while the note and the links are what the server sent: the note editor reports its first value as a change, so a note that was only opened gets a draft. (2) When a draft exists, show it only if it is newer than the saved note, or ask which of the two to keep.

**Why:** Seen on a card of the local build on 2026-10-12: opening an empty note and closing it without typing left a draft of 57 characters (the empty document) in localStorage. The dialog starts from the draft whenever one exists (`draft?.content ?? initialNote`), so after that the browser shows its old draft in place of a note that was saved later from another browser, and Save writes the draft over it.

**Context:** `handleNoteChange` and the two `useState` initializers of `src/hooks/board/useNoteModalDraft.ts`; `updateDraftNote` stores `lastModified`, and `projectinfo.updated_at` is the time of the saved note. Older than this change.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Return the keyboard to the comment when its editor closes

**What:** When the inline editor of a card's comment closes (Enter, Escape or the save button), put the focus on the comment, or on "Add comment" when the comment is empty.

**Why:** Seen on a card of the local build on 2026-10-12: after Escape in the editor the focus is on the page (`document.body`), so a keyboard user starts again from the top of the board. Opening the editor with the keyboard works, from the comment (Enter) and from its menu (Enter on the menu button, Enter on Edit), and the editor takes the focus.

**Context:** `handleCommentSave` and `handleCommentCancel` of `src/components/Board/RepoCard.tsx` set `isEditingComment` to false; `CommentSection` swaps the editor for `CommentDisplay` with `<Activity>`, so the element that had the focus is hidden. `useCardDialogFocusReturn` does the same job for the dialogs of a card. Older than this change.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Break a name of one long word in the places that are left

**What:** Break a name of one long word in three more places, as the board, the cards, the dialogs and the select lists do: (1) the badge of a selected repository in the Add Repositories picker, with `shrink-0` on its remove button; (2) the column title of a shared board; (3) the title of the column that is being dragged. Then look once more for a name that is shown beside something it can cover.

**Why:** #213 fixed the places where a name without a space or a hyphen pushed a control out of reach (the menu of a card, "Column options", the buttons of a board's header, "Create Board"), made a dialog scroll sideways or made a list wider than a phone. These three were read from the code on 2026-10-13 and not measured. (1) A repository name near the 100 characters GitHub allows makes the badge wider than the panel and takes its remove button along; the repository can still be taken out of the selection by its row in the list. (2) and (3) put nothing out of reach: on the shared page a column title of one long word is drawn across the next column, and the picture of a dragged column lets it run out of its frame.

**Context:** The badge in `src/components/Board/AddRepositoryCombobox.tsx` (the repositories of the browser tests have short names, so a test needs a story or a fixture with a long one), the `h2` of the column header in `src/app/public/[slug]/PublicBoardClient.tsx` and of the `DragOverlay` in `src/components/Board/KanbanBoard.tsx`. `e2e/logged-in/names-that-cannot-break.spec.ts` has the measuring helpers; the rule is in `CLAUDE.md` under "Names that cannot break", with the two classes and what each does to an ordinary word.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Return the keyboard to what opened the Add Repositories picker

**What:** When the picker closes (Cancel, Escape, or after repositories were added), put the focus on the control that opened it: "Add Repositories" in the header, or "Add Repo" of the column it was opened from. A picker that the page opened again after a GitHub sign-in has no such control; the header button is the place then.

**Why:** Closing takes the panel off the page, and the focus falls to the page (`document.body`), so a keyboard user starts again from the top of the board. The Escape branch of the panel's key handler even calls `blur()` on the search box. Named in the last review round of #213 on 2026-10-12, read from the code. The dialogs a card opens give the focus back since #213; the picker has three ways in and was left as it is.

**Context:** `handleClose` and `handleToggleOpen` of `src/components/Board/AddRepositoryCombobox.tsx`; `openForStatus` and `handleOpenChange` of `src/hooks/board/useAddRepositoryCombobox.ts`, which open it from a column and after the return from GitHub (`ADD_REPOSITORY_RETURN_PARAM`). The search box takes the focus when the panel is put on the page, before a ref of the panel is attached, so the opener has to be remembered where the picker is opened, not where it appears. Safari does not focus a button that is clicked. Older than #213.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Give a card one tab stop

**What:** Make a card one stop of the Tab key. Today it is two: the element that has the drag listeners (dnd-kit gives it `tabIndex` 0 and the role of a button) and the `Card` inside it, which has a `tabIndex` of its own.

**Why:** Seen on the board on 2026-10-12, while the keys that start a drag were measured: Space lifts the card from either stop. Enter lifts it from the outer stop and opens the note on the inner one, `.` opens the menu on the inner one only, and the card's own focus ring (`focus-within:ring-2` on `Card`) is drawn for the inner stop only. A keyboard user presses Tab twice for every card.

**Context:** `src/components/Board/RepoCard.tsx`: the outer `div` spreads `attributes` and `listeners` of `useSortable`, and `Card` has `tabIndex={0}`, `onKeyDown` and `data-repo-card-id`, which `card-focus-target.ts` and the E2E helpers read. One stop means moving the key handler and that attribute to the outer element, or taking the outer one out of the tab order (`attributes.tabIndex`), and checking the focus return of the card dialogs afterwards. Older than this change.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Make the column drag tests fail when no drag happens

**What:** Give the tests of `e2e/logged-in/kanban-dnd/column-dnd.spec.ts` that only move the mouse an assertion about the drag itself: "should show visual feedback during column drag" asserts nothing, "should drop column to new row via NewRowDropZone" checks the new grid only inside `if (dropSucceeded)`, and "should display ColumnInsertZone at empty grid positions" computes `insertZoneVisible` and never reads it. Several swap tests compare the set of titles, which is the same after no drag.

**Why:** Named by an outside read of the drag sensors on 2026-10-12: these tests pass when a sensor refuses every press on a column header. What does fail in that case today: "should verify column grid position is persisted in database" in the same file, and the column tests of `what-starts-a-drag.spec.ts` (a finger and Space on the header).

**Context:** The tests are older than this change and were written to tolerate a drop that does not land (`MAX_ATTEMPTS`, the early return). Assert the lift before the release (`sortable-column-<id>` has `opacity-50` while it is dragged) and the final grid without a condition; a test that then turns out flaky needs its drop fixed, not its assertion removed.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Let the browser tests see a hydration error

**What:** Make the server's HTML of an E2E run hold the page, so that `e2e/unauthenticated/ssr-hydration.spec.ts`, `e2e/logged-in/ssr-hydration-board.spec.ts` and `e2e/logged-in/board-page-hydration.spec.ts` can fail. Or, if that cannot be done, rename them after what they do check.

**Why:** With MSW on, `MSWProvider` (`src/app/msw-provider.tsx`) renders "Initializing MSW..." until the worker runs in the browser, on the server too, so React never hydrates a page in a browser test. Found on 2026-10-14: the time-zone mismatch of `/boards` (React #418 on production) passed a Playwright test with the browser in Los Angeles. Its regression test is a unit test (`src/tests/unit/components/LocalDate.test.tsx`).

**Context:** The provider waits so that no request leaves the browser before the worker can answer it. A provider that renders its children at once has to hold those requests back another way, for example by starting the worker in an inline script before React loads, and the whole E2E suite is the check that nothing then goes out unmocked.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Give the drag context of the boards list a stable id

**What:** Pass an `id` to the `DndContext` of `BoardGrid` (`src/components/Boards/BoardGrid.tsx`), so the server and the browser name its description element alike.

**Why:** Seen on 2026-10-14 during the local check of #216 with `next dev`: hydrating `/boards` logged a mismatch of the drag handle's `aria-describedby` (`DndDescribedBy-0` on the server, `DndDescribedBy-1` in the browser). dnd-kit counts its ids per module, so the count depends on what rendered before. React does not patch attributes up, so a screen reader may be pointed at an element that does not exist.

**Context:** `DndContext` takes an `id` prop for server rendering. Check the board's `DndContext` in `KanbanBoard` the same way. A browser test cannot see this yet (see the item above).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Read what is being dragged from dnd-kit, not from a copy

**What:** Take "a column is being dragged" from dnd-kit's own state (`useDndContext().active`, read by a component inside `DndContext`) and drop `activeId` and `activeDragType` of `useKanbanDnD`, which `handleDragStart` sets and `handleDragEnd` and `handleDragCancel` clear.

**Why:** dnd-kit calls `onDragStart` at once and calls neither `onDragEnd` nor `onDragCancel` when the drag ends before React has drawn its start (`createHandler` in `@dnd-kit/core` 6.3.1 builds no event while `sensorContext.current.active` is unset). A mouse that is released within a frame of the lift then leaves the copy at "column", and the drop zones for a new row and for empty places stay on the board until the next drag ends. Not seen in a browser; read from the code on 2026-10-12, when the handler for a cancelled drag was added.

**Context:** `src/hooks/board/useKanbanDnD.ts` (`insertionZones`, the two state values), `src/components/Board/KanbanBoard.tsx` (`isDraggingColumn`, the grid tracks, `NewRowDropZone`, the `DragOverlay`). The hook runs outside `DndContext`, which it gives its sensors to, so the reading has to move into a child of the context.

**Effort:** M
**Priority:** P3
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

**What:** (1) Correct the Arrange comment of "still offers and adds a repository that sits on another user's public board" in `e2e/logged-in/one-repo-across-boards.spec.ts`. Add tests for (2) `BoardSettingsDialog` calling `onPublicChange`, and `BoardPageClient` copying the public link with the real `useBoardSettings`; (3) `setStatusLists`, `addRepoCards` and `removeRepoCard` each making a fetch in flight out of date, plus a test that lists `boardSlice`'s actions so a new reducer forces the decision; (4) the rate-limit refusal of `getPublicBoardBySlug`.

**Why:** Removing any of (2) to (4) leaves every test green. (1) The browser test stopped proving the owner filter of `lookupRepoPlacements` when the public read policies were dropped: row level security now hides other users' cards with or without the filter. The filter has a unit test of its own since #213 ("reads only the cards on boards owned by the given user" in `repo-card-duplicates.test.ts`); the comment still names the fixture as what the test relies on. (3) `addRepoCards` and `removeRepoCard` are not wrapped in `trackBoardWrite`, so the revision bump is their only protection against a stale fetch.

**Context:** `e2e/logged-in/one-repo-across-boards.spec.ts`, `src/tests/unit/app/board/BoardPageClient.test.tsx`, `src/tests/unit/hooks/board/useBoardServerSync.test.tsx`, `src/tests/unit/lib/actions/public-board.test.ts`, the `isAnyOf(...)` matcher in `src/lib/redux/slices/boardSyncSlice.ts`.

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

**Why:** It schedules a save after every action. The `board` and `boardSync` slices are not persisted and dispatch several actions per drag, each of which serializes the persisted state again 300 ms later. That state is the settings and the drafts only since 2026-10-12, so a save is small; there are still more of them than needed.

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

### Give the board-sync gates a deadline

**What:** Give tracked board writes a deadline, or count pending writes per board, and release the "fetch sent" marker when a refetch delivers no data.

**Why:** `pendingWriteCount` is counted for the whole app and drops only when a write settles. One save that never answers holds back every board refresh and drops fetched data, while the failed-save toast of another write says the board is reloading. `sentRefreshRevision` is cleared only when page data arrives; a refetch that is interrupted without a reload or a new page render leaves it set, and later refresh requests wait for it.

**Context:** `trackBoardWrite`, `boardRefreshSent`, `selectIsBoardRefreshDue` and `selectMayApplyServerSnapshot` in `src/lib/redux/slices/boardSyncSlice.ts`. Both are review hypotheses that were not reproduced: a server action normally ends with the platform's function timeout, and a failed refetch reloads the page, which starts from an empty `boardSync` state. The adversarial review of #213 raised the second one again (one refetch that brings no data and every later request for a refetch waits); it was not reproduced either.

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

**Context:** `handleUndo` in `src/hooks/board/useKanbanUndo.ts` (the card path filters against the current cards, the column path does not), `confirmDelete` in `src/hooks/board/useStatusListDialog.ts`. Older than this change. Related: "Drop late picker notices" (whose other half, the cards of a deleted column left in the store, #216 fixed) and "Fail a card or column move that matched no row".

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

## Design review of 2026-10-12: deferred design debt

From `/design-review` of the change for issue #213. The review found 27 issues and fixed 21; these are what is left. All of them are in the app as it was before that change. The full report with screenshots is in `~/.gstack/projects/laststance-gitbox/designs/design-audit-20261012/`.

### Give the landing page a direction of its own

**What:** (1) Choose a display typeface for the headings; they use the system font stack. (2) Drop the gray gradient that every section heading has. (3) Replace "For AI Era Developers" with a headline that says what GitBox does. (4) Give the four feature cards different weights, or use something other than four equal cards. (5) Show the content without waiting for the entrance animation, and take the hover lift off cards that do nothing.

**Why:** High impact, AI slop (FINDING-021). The landing page reads as generated while the app reads as made by someone who uses it. Both outside reviewers and the audit agree; the pattern detector counts `gradient-text` on all four headings.

**Context:** `src/app/(landing)/` (`HeroSection`, `FeaturesSection`, `HowItWorksSection`, `CTASection`, `KanbanPreview`). Typeface, headline and layout are the owner's call, so none of it was changed.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Choose one height for controls and a floor for small triggers

**What:** Decide on the control heights (buttons are 32, 36 and 40px: `sm`, `default`, `lg` in `src/components/ui/button.tsx`), make the 24px triggers larger (a card's menu and a comment's menu are a 16px icon with 4px of padding), and enlarge touch targets one way.

**Why:** Medium impact, interaction states (FINDING-016). A 24px target is the minimum WCAG 2.2 allows and half of what a finger needs. Four different ways to enlarge a target are in use: `min-h-11 min-w-11`, `pointer-coarse:min-h-11`, `pointer-coarse:size-11` and a `pointer-coarse:after:` overlay.

**Context:** `src/components/Board/OverflowMenu.tsx`, `src/components/Board/CommentActionsMenu.tsx`, `src/components/ui/dialog.tsx` (the close button got `pointer-coarse:size-11` in this review), `src/components/ui/editable-url-item.tsx`, `src/components/Board/HeldRepositoryList.tsx`, `src/components/Modals/MoveToAnotherBoardDialog.tsx`. Larger triggers change the card layout, which the drag tests measure.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Lay out the account page as sections, not stacked cards

**What:** Show Profile, Account Data and Danger Zone as sections of one page, and the two numbers of Account Data without a bordered tile each.

**Why:** Medium impact, AI slop (FINDING-022). Three cards under each other with tiles inside one is the layout a generator produces; the page has nothing to compare side by side that would need cards.

**Context:** `src/app/account/AccountClient.tsx` and its skeleton `src/app/account/loading.tsx`, which mirrors the layout block by block and has to change with it. One difference is left between the two: below about 434px the label "Repository Cards" takes two lines and the skeleton shows one, so the two tiles grow by a line when the data arrives.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Use the ellipsis character in loading labels

**What:** Write "…" instead of three dots in the labels that say something is in progress ("Loading repositories...", "Signing out...", "Creating..."), about 27 strings in `src`.

**Why:** Polish, content (FINDING-017). The casing of button labels has a rule in `CLAUDE.md` since this review; the dots are the other half of the same inconsistency.

**Context:** Unit and E2E tests quote many of these strings, and "New Board..." in the move dialog is an option label that means "opens a form", not progress: it keeps its dots or gets the same character by decision.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Add theme tokens for warning and favorite

**What:** Add `--warning` and `--favorite` (with foregrounds) to the 14 themes and use them where the app now reaches for `orange-*` and `amber-*`.

**Why:** Each theme picks its own red, green and primary, but orange and amber are the same fixed shades on all of them. This review fixed the two places where that cost contrast (the character counters and the favorite star) with fixed shades that were measured on every theme; a token would let a theme choose, and would give "outcome unknown" messages a color of their own instead of red. The counter of a card's comment stands on a tinted box, where no single orange passes on every tint; it paints a chip of the page background under its orange, and a warning token needs a surface like that too.

**Context:** `src/styles/globals.css` (theme definitions), `src/components/Boards/BoardCard.tsx`, `src/app/boards/favorites/page.tsx`, and `NEAR_LIMIT_COUNTER_TEXT_CLASS` in `src/lib/constants/character-counter.ts`, the one orange of the four counters (a card's note and comment, a board's name and subtitle). The toast colors come from sonner's palette, not from the themes (`src/components/ThemedToaster.tsx`).

**Effort:** M
**Priority:** P4
**Depends on:** None

### Stop using the theme color and the muted color where they cannot be read

**What:** (1) Replace `text-primary` where it colors text on the page background, or give the themes a second token for text in the theme color: the two links of the login page, the `link` variant of `Button`, the link of the note editor (`link-node.tsx`), the URL of a project link (`editable-url-item.tsx`), "Save" of the comment editor, the labels of the two drop zones while a card is dragged over them, and the hovered title of a board card and of a repository on a shared board. (2) Darken `--muted-foreground` of `:root`, the block of the System theme on a light screen: on `bg-muted` and on `bg-accent` it is 4.34:1 there, for example in the language chip of the Add Repositories picker.

**Why:** `text-primary` on the page background is below 4.5:1 in 11 of the 14 themes: 3.19:1 on Sunrise to 4.42:1 on Rose, 3.30:1 on Plum to 4.12:1 on Graphite. #213 fixed the places where the theme color or the muted color stood on a tint or on the accent fill (the sidebar's current page, the picker's badges, rows and check marks, the chosen option of the comment text settings, the check marks of two menus). The places above are on `main` as well and need one decision on the theme tokens instead of ten local ones.

**Context:** `src/app/login/page.tsx`, `src/components/ui/button.tsx`, `src/components/ui/link-node.tsx`, `src/components/ui/editable-url-item.tsx`, `src/components/Board/CommentInlineEdit.tsx`, `src/components/Board/NewRowDropZone.tsx`, `src/components/Board/ColumnInsertZone.tsx`, `src/components/Boards/BoardCard.tsx`, `src/app/public/[slug]/PublicBoardClient.tsx`, `src/styles/globals.css`. `src/tests/unit/styles/theme-color-math.ts` reads the tokens of every theme and computes a contrast; `accent-fill-contrast.test.ts` and `selected-repository-badge-contrast.test.ts` are tests of this kind. The rule for new code is in `CLAUDE.md` under "14 Theme System".

**Effort:** M
**Priority:** P3
**Depends on:** None

### Show a hidden subtitle on the shared page only when the owner wants it

**What:** Decide whether "Show subtitle" of a board's settings also decides what a public link shows, and make `get_public_board` and the Sharing tab say the same.

**Why:** The setting hides the subtitle in the header of the owner's board page. The shared page prints the subtitle whenever the board has one, and uses it as the description of the page, whatever the setting says. Since #213 the Sharing tab lists the subtitle among what is visible, so the owner can know; the two switches still answer one question in two ways.

**Context:** `get_public_board` in `supabase/migrations/20261011030000_public_board_by_slug_only.sql` returns `subtitle` without reading `settings`; `src/app/public/[slug]/PublicBoardClient.tsx` and `page.tsx` print it; `toggleBoardSubtitleVisibility` in `src/lib/actions/board.ts` writes `settings.showSubtitle`. A change of the function is a new migration.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Smaller design gaps left from the 2026-10-12 review

**What:** (1) Replace `transition-all` (18 places) with the properties that change, and stop animating the sidebar's `width`, which from 768px moves the whole page on every frame (below, the sidebar lies over the page). (2) Return the focus to the card after every dialog that a card opens: `useCardDialogFocusReturn` is used by Move to Another Board and Remove from Board only. (3) Use one component for inline error messages and one pattern for a pending button; they are built by hand in each form. (4) `/settings` renders without the sidebar every other signed-in page has. (5) A card's menu has separators and a column's menu has none. (6) The picker has a native `<select>` next to a Radix select. (7) Star counts use an emoji where the rest of the app uses icons.

**Why:** Polish (FINDING-013, FINDING-023 and the consistency review). None of them stops anyone; together they are why the app feels slightly different from page to page.

**Context:** `src/components/Sidebar/Sidebar.tsx`, `src/hooks/board/useCardDialogFocusReturn.ts`, `src/app/settings/`, `src/components/Board/OverflowMenu.tsx`, `src/components/Board/StatusColumn.tsx`, `src/components/Board/AddRepositoryCombobox.tsx`.

**Effort:** M
**Priority:** P4
**Depends on:** None

## Completed

- [x] **Preserve `?query` and `#hash` on silent refresh redirect** — [#177](https://github.com/laststance/gitbox/issues/177)
      **Completed:** v0.3.3.0 (2026-10-07). The repository catalog caller now forwards the full board destination, with unit coverage and a real-account OAuth round trip confirming both values survive.
- [x] **Fix the hydration mismatch on the board page for returning users**
      **Completed:** 2026-10-12, with the change for issue #213 (`038a3e6`), found again by `/design-review`. The board is not kept in localStorage any more, so the first client render matches the server's. What is left is under "Render the board on the server instead of its skeleton".
- [x] **Stabilize the "Optimistic Favorite Toggle" story test**
      **Completed:** 2026-10-12, with the change for issue #213 (`46e892b`). The mocked server action is registered with `sb.mock`, and the two stories that press the star say what the server answers. 30 runs in a row passed.
- [x] **Fit the Add Repositories panel on a narrow screen** (the width half of "Viewport-aware layout for the Add Repositories panel")
      **Completed:** 2026-10-12, fixed by `/design-review` of the change for issue #213 (`d3bc24d`).
- [x] **Pin the Cancel / Add row of the Add Repositories panel** (the height half)
      **Completed:** 2026-10-12, with the change for issue #213 (`a4b20e0`, reworked in `e09b2cd`). The panel is a column whose two lists give up height on a short window, each scrolling by itself, so the search box and the Cancel / Add row stay in view. On a window too short for one row of each list the whole panel scrolls.
