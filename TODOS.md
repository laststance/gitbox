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

## Design review of 2026-10-12: deferred design debt

From `/design-review` of the change for issue #213. The review found 27 issues and fixed 21; these are what is left. All of them are in the app as it was before that change. The full report with screenshots is in `~/.gstack/projects/laststance-gitbox/designs/design-audit-20261012/`.

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
