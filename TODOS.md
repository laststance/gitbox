# TODOs

Follow-up items surfaced during code review. Not ship-blockers — captured here so they don't get lost.

## Silent GitHub Token Refresh — P2 follow-ups

From the `/ship` adversarial review of `feat/silent-github-token-refresh` (PR #176).

> All items below are tracked as GitHub issues (#177-#187). Update issue status there; this file remains as the source narrative for context.

### UX

- [ ] **Preserve `?query` and `#hash` on silent refresh redirect** — [#177](https://github.com/laststance/gitbox/issues/177)
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
