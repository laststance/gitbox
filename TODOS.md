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

## Completed

- [x] **Smaller design gaps left from the 2026-10-12 review**
      **Completed:** v0.7.21.0 (2026-10-18). Settings has the sidebar, a closed note returns focus to the card, forms share one error and pending label, transitions name the properties that change, the column menu has a separator, and the picker uses a Radix visibility list and a lucide star.
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
