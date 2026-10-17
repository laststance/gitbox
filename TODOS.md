# TODOs

Follow-up items surfaced during code review. Not ship-blockers — captured here so they don't get lost.

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

## One Repo Across Boards (#215) — deferred follow-ups

From the `/autoplan` review of issue #215 (one card per user and repository). None blocks that change.

## Repository Memory (#216) — deferred follow-ups

From the `/plan-eng-review` of issue #216 (a repository keeps its note, links and comment when its card goes). None blocks that change.

## Board sync and the Sentry tunnel — deferred follow-ups

From the `/ship` review of `fix/owner-filter-rollback-guard-sentry-tunnel`. None of them blocks that change.

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

### Cover the board-sync wiring the unit tests mock away

**What:** (1) Correct the Arrange comment of "still offers and adds a repository that sits on another user's board" in `e2e/logged-in/one-repo-across-boards.spec.ts`. (2) Add tests for `setStatusLists`, `addRepoCards` and `removeRepoCard` each making a fetch in flight out of date, plus a test that lists `boardSlice`'s actions so a new reducer forces the decision.

**Why:** Removing what (2) names leaves every test green. (1) The browser test stopped proving the owner filter of `lookupRepoPlacements` when the public read policies were dropped: row level security now hides other users' cards with or without the filter. The filter has a unit test of its own since #213 ("reads only the cards on boards owned by the given user" in `repo-card-duplicates.test.ts`); the comment still names the fixture as what the test relies on. (2) `addRepoCards` and `removeRepoCard` are not wrapped in `trackBoardWrite`, so the revision bump is their only protection against a stale fetch.

**Context:** `e2e/logged-in/one-repo-across-boards.spec.ts`, `src/tests/unit/hooks/board/useBoardServerSync.test.tsx`, the `isAnyOf(...)` matcher in `src/lib/redux/slices/boardSyncSlice.ts`.

**Effort:** M
**Priority:** P2
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

### Correct the board-sync docstrings

**What:** (1) Wrap the server action in `trackBoardWrite` in the `@example` of `useBoardRollback`, and state that the optimistic array must be created for that write. (2) In the JSDoc of `useBoardServerSync`, say that only saves tracked with `trackBoardWrite` are protected and that pending saves are counted for the whole app. (3) Add a note above `reducers` in `boardSlice.ts` that points at the stale-fetch matcher.

**Why:** A write copied from the example is not counted as pending. The JSDoc promises more than the code does.

**Context:** `src/hooks/board/useBoardRollback.ts`, `src/hooks/board/useBoardServerSync.ts`, `src/lib/redux/slices/boardSlice.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Drop a deleted column from the column undo history

**What:** When a column is deleted, remove it from the entries of `columnHistory`, or skip entries that hold a column the board no longer has.

**Why:** Delete a column, then press Z while an earlier column move is on the stack: the earlier snapshot is still there. The undo leaves a deleted column out of the write, and a position write that matches no row now fails, so the deleted column is not brought back. Z still moves the columns that remain to the positions from that snapshot.

**Context:** `handleUndo` in `src/hooks/board/useKanbanUndo.ts` (the card path filters against the current cards, the column path does not), `confirmDelete` in `src/hooks/board/useStatusListDialog.ts`. Older than this change. Related: "Drop late picker notices" (whose other half, the cards of a deleted column left in the store, #216 fixed).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Simplification left from the board-sync review

**What:** Consider turning `useBoardRollback` into two thunks next to `trackBoardWrite`, which removes the hook, its types and four threaded parameters (about 70 lines).

**Why:** A structure gap. It changes nothing that is saved.

**Context:** `src/hooks/board/useBoardRollback.ts`.

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

**What:** (1) Replace `text-primary` where it colors text on the page background, or give the themes a second token for text in the theme color: the two links of the login page, the `link` variant of `Button`, the link of the note editor (`link-node.tsx`), the URL of a project link (`editable-url-item.tsx`), "Save" of the comment editor, the labels of the two drop zones while a card is dragged over them, and the hovered title of a board card. (2) Darken `--muted-foreground` of `:root`, the block of the System theme on a light screen: on `bg-muted` and on `bg-accent` it is 4.34:1 there, for example in the language chip of the Add Repositories picker.

**Why:** `text-primary` on the page background is below 4.5:1 in 11 of the 14 themes: 3.19:1 on Sunrise to 4.42:1 on Rose, 3.30:1 on Plum to 4.12:1 on Graphite. #213 fixed the places where the theme color or the muted color stood on a tint or on the accent fill (the sidebar's current page, the picker's badges, rows and check marks, the chosen option of the comment text settings, the check marks of two menus). The places above are on `main` as well and need one decision on the theme tokens instead of ten local ones.

**Context:** `src/app/login/page.tsx`, `src/components/ui/button.tsx`, `src/components/ui/link-node.tsx`, `src/components/ui/editable-url-item.tsx`, `src/components/Board/CommentInlineEdit.tsx`, `src/components/Board/NewRowDropZone.tsx`, `src/components/Board/ColumnInsertZone.tsx`, `src/components/Boards/BoardCard.tsx`, `src/styles/globals.css`. `src/tests/unit/styles/theme-color-math.ts` reads the tokens of every theme and computes a contrast; `accent-fill-contrast.test.ts` and `selected-repository-badge-contrast.test.ts` are tests of this kind. The rule for new code is in `CLAUDE.md` under "14 Theme System".

**Effort:** M
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
      **Completed:** 2026-10-12, with the change for issue #213 (`038a3e6`), found again by `/design-review`. The board is not kept in localStorage any more, so the first client render matches the server's. The server HTML is the board itself: until the store holds that board, the page's columns and cards are what is drawn.
- [x] **Stabilize the "Optimistic Favorite Toggle" story test**
      **Completed:** 2026-10-12, with the change for issue #213 (`46e892b`). The mocked server action is registered with `sb.mock`, and the two stories that press the star say what the server answers. 30 runs in a row passed.
- [x] **Fit the Add Repositories panel on a narrow screen** (the width half of "Viewport-aware layout for the Add Repositories panel")
      **Completed:** 2026-10-12, fixed by `/design-review` of the change for issue #213 (`d3bc24d`).
- [x] **Pin the Cancel / Add row of the Add Repositories panel** (the height half)
      **Completed:** 2026-10-12, with the change for issue #213 (`a4b20e0`, reworked in `e09b2cd`). The panel is a column whose two lists give up height on a short window, each scrolling by itself, so the search box and the Cancel / Add row stay in view. On a window too short for one row of each list the whole panel scrolls.
