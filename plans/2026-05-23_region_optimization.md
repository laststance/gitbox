# Plan: Board Page Query Consolidation (Phase 0 + Phase 1 T1)

## Goal

Cut server-side time on `/board/[id]` by collapsing the DB query waterfall to a
single PostgREST round-trip (T1). Phase 0 instruments per-segment server timing
first so the impact is measured, not guessed.

This is **Phase 1, T1 only**. No region change ships this phase. The Vercel
function stays in Mumbai (`bom1`). All region work (the function-region flip, a
Tokyo read replica, the Supabase DB migration) is deferred to a properly-scoped
**Phase 2**, for the reasons in "Why the region move is deferred" below.

## Why the region move is deferred (correction to an earlier review option)

An earlier pass of this plan paired T1 with a region move (T2) and, during
review, floated a "surgical" variant: pin only `/board/[id]` to Tokyo via the
route-segment `preferredRegion` export, leaving every other function in Mumbai.
That option was built on an unverified premise. Docs verification (three
concordant primary sources) showed it does not exist on the runtime this page
uses:

- **On Vercel, the route-segment `preferredRegion` export is honored only on the
  Edge runtime.** `/board/[id]` runs on the Node.js runtime (Supabase SSR,
  cookies). Node-runtime routes have no per-route region lever. Their only region
  control is the global `vercel.json` `regions` setting. (Next.js v16.2.2 docs:
  "Regions are only supported when `export const runtime = 'edge'` is set";
  supported `preferredRegion` values are `'auto' | 'global' | 'home'`, and an
  unsupported value throws.)
- **Server Actions inherit the page's route-segment config.** Even if per-route
  region pinning worked on Node, the page's mutation Server Actions would follow
  it. `moveCardToBoard` and `addRepositoriesToBoard` each run ~5 sequential DB
  waves (`src/lib/actions/repo-cards.ts`); dragging them to Tokyo while the DB
  stays in Mumbai turns ~5 cheap in-region waves into ~5 cross-region waves
  (~5 x 126ms ≈ +630ms regression on every card move / add).

So the only real region lever is the **global** flip, which moves every function,
not just this page. And per this plan's own load-bearing insight (below), the
global flip nets only ~-20-50ms because it **relocates** the single cross-region
hop rather than removing it. The cross-region win that actually matters lives in
**Phase 2 (DB locality)**, and getting there safely first requires consolidating
the multi-wave mutations. Moving the function before that is the ~630ms trap.

T1 is still worth shipping on its own: it removes a duplicate board fetch,
collapses 4 read waves to ~1, gives a cleaner read path, and is the prerequisite
that makes a future region move safe. But be honest about the latency needle: T1
alone saves only the collapsed in-region waves (~10-20ms). It does not move the
cross-region hop. That waits for Phase 2.

## Relationship to prior work

This plan executes one deferred item (and splits a second) from
`plans/2026-05-21_board_ttfb_reduction.md` (eng-reviewed and approved 2026-05-21):

- TODO line 373 "RPC consolidation (`get_board_bundle`)" is **refined**. Same goal
  (collapse the sequential reads to one round-trip), implemented as a PostgREST
  nested embed (code only) instead of a Postgres function. No schema migration,
  fully reversible. See T1.
- TODO line 374 "Mumbai → Tokyo region migration" is **deferred whole to Phase 2**.
  That TODO lumped the Vercel function region and the Supabase DB region into one
  migration. This phase takes neither half. See "Out of Scope — Phase 2".

Prerequisite already shipped: PR #197 (merged 2026-05-21) completed the
`getUser()` → `getClaims()` migration across layouts and actions. Per-request auth
on the warm path is a local WebCrypto JWT verify (~5ms), not a GoTrue network call
(`src/lib/auth/get-cached-claims.ts`). This is relevant to Phase 2 region work,
not to T1.

## Evidence

| Layer                   | Finding                                                                                                | Source                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Function region         | Vercel function pinned to `bom1` (Mumbai)                                                              | `vercel.json` `regions: ["bom1"]`                                                           |
| DB region               | Supabase prod (`mfeesjmtofgayktirswf`) in `ap-south-1` (Mumbai)                                        | Supabase dashboard                                                                          |
| User + edge region      | Tokyo (`hnd1`)                                                                                         | `x-vercel-id: hnd1::bom1::`                                                                 |
| Server-side baseline    | median 351ms / P90 495ms, authenticated, warm, n=36                                                    | curl `time_starttransfer` from Tokyo; `.gstack/benchmark-reports/board-detail-benchmark.md` |
| Tokyo ↔ Mumbai RTT      | 126.44ms (measured, HIGH confidence)                                                                   | curl `claudedocs/research_vercel_supabase_region_20260523.md`                               |
| `preferredRegion` scope | route-segment region pinning is Edge-runtime-only on Vercel; Node routes use global `vercel.json` only | Next.js v16.2.2 docs (context7) + Vercel docs                                               |

Full topology and tier analysis: `claudedocs/research_vercel_supabase_region_20260523.md`.

### Current query waterfall (`/board/[id]`)

```
generateMetadata: board.select('name')                    [round-trip 1]
  ↓
BoardPage:        board.select('*')                        [round-trip 2, duplicate of 1]
  ↓
fetchBoardInitialData:
  ├─ Promise.all([
  │     getBoardData → Promise.all([getStatusLists, getRepoCards])   [round-trip 3, 2 queries parallel]
  │     getUserMaintenanceRepoIdentifiers                            [round-trip 3, parallel]
  │   ])
  └─ await getCommentsForCards(cardIds)                    [round-trip 4, sequential — needs cardIds]
```

Four sequential round-trip waves, plus a duplicate board fetch. Today every wave
is a cheap **in-region** hop (`bom1` function → `ap-south-1` DB, both Mumbai,
~5-15ms each), so the waterfall is not the current bottleneck. T1 collapses it
anyway, because (a) it is cheap correctness/cleanliness, and (b) it is the gate
that would make a future region move safe instead of a ~630ms regression.

Source: `src/app/board/[id]/page.tsx`, `src/lib/actions/board-data.ts`,
`getBoardData` / `getStatusLists` / `getRepoCards` in `src/lib/actions/board.ts`.

## The load-bearing insight (read before trusting any ms target)

The 351ms baseline **already contains exactly one cross-region hop**: the Tokyo
edge → Mumbai function leg (~126ms) that wraps the whole function execution. The
in-region DB waves are cheap.

T1 alone does **not** touch that cross-region hop. It collapses the cheap
in-region read waves into one, saving ~10-20ms in-region. The 126ms edge→function
wrap stays exactly where it is.

A region move would **relocate** the hop (edge→function becomes in-region, but
function→DB becomes cross-region), netting only ~-20-50ms even when done right,
and only after the mutation waves are consolidated. Eliminating the hop entirely
(the real win) requires Phase 2 DB locality (read replica or DB migration). None
of that is in this phase.

Compute floor: ~200ms of the 351ms is irreducible compute (RSC render, React
serialization, Supabase client init, claims verify) and does **not** shrink with
either query consolidation or region changes. No region tier lands below ~210ms
without separate compute work.

## Phase 0: Instrument per-segment server timing

**Why first:** the ~10-20ms T1 estimate is back-derived from one aggregate
baseline, not profiled per segment. Phase 0 makes each read segment's cost
observable so T1's saving can be **falsified against a gate**, and so Phase 2's
business case rests on measured numbers instead of arithmetic.

**Scope (narrowed):** instrument only the `/board/[id]` page render path and the
T1 embed itself. Do **not** instrument `/boards` or `/maintenance` this phase.
(The earlier plan extended Phase 0 to those routes to size a global region-flip
blast radius. With the region move deferred, that measurement has no consumer this
phase. Pull it into Phase 2 when the region move is actually scoped.)

**Change:** wrap each DB segment in `fetchBoardInitialData` and the board fetch
with `performance.now()` deltas; emit a single structured log line per request
(Vercel function logs; optionally a Sentry breadcrumb). Segments to time:
`board` fetch, `getStatusLists`, `getRepoCards`,
`getUserMaintenanceRepoIdentifiers`, `getCommentsForCards`, and total
`fetchBoardInitialData`. Also capture a cold-vs-warm marker so the embed estimate
is judged on the warm path (cold isolate init is separate, per Codex finding 7).

**Constraints:**

- Gate behind an env flag (e.g. `BOARD_TIMING_LOG`), off by default in prod, zero
  overhead when unset.
- No PII in log lines (board id is fine; no user content).
- Ships and is observed in prod **before** T1, to capture the per-segment baseline
  the T1 gate compares against.

**Falsification gate for T1:** after T1 ships, the measured in-region delta (sum
of collapsed read segments, warm path) must land **within ±10ms of the ~10-20ms
estimate**. If T1 shows no measurable in-region improvement, or a regression,
that is a signal the embed is doing extra work (e.g. over-fetching, an N+1 in
PostgREST, a row-cap retry) and must be investigated before the old query
functions are removed.

**Expected:** no latency change. Deliverable is data, not speed.

## Phase 1 — T1: PostgREST embed consolidation (code only)

**File:** `src/lib/actions/board-data.ts` (`fetchBoardInitialData`), with the
board fetch deduplicated via `React.cache()`.

**Change:** replace the separate `getStatusLists` + `getRepoCards` +
`getCommentsForCards` round-trips with one PostgREST nested embed:

```ts
const { data, error } = await supabase
  .from('board')
  .select('*, statuslist(*), repocard(*, projectinfo(comment, comment_color))')
  .eq('id', boardId)
  .order('grid_row', { referencedTable: 'statuslist', ascending: true })
  .order('grid_col', { referencedTable: 'statuslist', ascending: true })
  .order('order', { referencedTable: 'repocard', ascending: true })
  .maybeSingle()
```

This returns board columns + all status lists + all repo cards + each card's
`projectinfo` comment fields in **one** HTTP round-trip. PostgREST builds it as
server-side LEFT JOINs and **embeds respect RLS** (each embedded table's policies
still apply).

**`projectinfo` narrowed to `(comment, comment_color)`** — the only columns the
board render needs (proven by `getCommentsCore` in
`src/lib/actions/shared-project-info.ts`, which selects exactly
`repo_card_id, comment, comment_color`). `note` / `links` load lazily on card
open, not at board load, so they stay out of the bundle.

**Child ordering is mandatory (Codex finding 3).** PostgREST does not guarantee
embedded-row order. The board render groups cards by column position and renders
columns by grid coordinates (`src/components/Board/KanbanBoard.tsx`,
`getStatusLists` orders by `grid_row` then `grid_col`, `getRepoCards` orders by
`order`). Preserve this either with the `referencedTable` order params shown above
**or** by sorting in the remap step. A test must assert the rendered order matches
the pre-T1 order (see Testing).

**FK chain (verified):** `statuslist.board_id → board`,
`repocard.board_id → board`, `projectinfo.repo_card_id → repocard` (1:1). Each
pair has a single FK, so no disambiguation hint is needed. If PostgREST reports an
ambiguous embed, fall back to explicit hints
(`repocard!board_id(*)`, `projectinfo!repo_card_id(comment, comment_color)`).

**Response-shape guards (Codex finding 8):**

- `repocard → projectinfo` is 1:1, so PostgREST deserializes `projectinfo` as a
  single object or `null`, **not** an array. The remap must handle both the object
  and the null/absent case (card with no projectinfo row).
- PostgREST applies a default **1000-row cap per embedded resource**. A board with
  > 1000 cards would silently truncate. GitBox boards are far below this today; add
  > an assertion/guard and a note so a future large-board case is caught, not
  > mis-rendered.
- Add an integration test that asserts the **actual** PostgREST response shape
  (nested object keys, projectinfo object-vs-null), not just the post-remap shape,
  so a PostgREST/`@supabase/ssr` upgrade that changes serialization is caught.

**Return shape and not-found contract (Codex finding 5):** the consolidated fetch
returns one result `{ board, statusLists, repoCards, comments, maintenanceRepoIdentifiers }`,
or a not-found discriminant when the board is absent. Use `.maybeSingle()` (returns
`data: null` with no error for zero rows) **or** map only PostgREST `PGRST116` to
not-found. Any **other** embed error (network, RLS misconfig, malformed query)
must **propagate as an error, not become a 404** — silently 404-ing a real failure
hides outages. `page.tsx` keeps exactly **one** `if (!result) notFound()` and drops
its own `select('*')`, consuming the embed result instead.

**Remap:** remap the nested response to the existing `BoardInitialData` shape
(`statusLists: StatusListDomain[]`, `repoCards: RepoCardDomain[]`, `comments:
Record<cardId, CommentData>`) so `BoardPageClient` and its tests are unchanged.
Reuse the existing mappers in `src/lib/actions/mappers.ts`.

**Stays separate:** `getUserMaintenanceRepoIdentifiers` is **user-scoped**
(`maintenance` table by `user_id`), not board-scoped — no FK to `board`, so it
cannot be embedded. It keeps running in parallel via `Promise.all`. After T1 the
read waterfall is 2 parallel round-trips (embed ‖ maintenance), down from 4 waves.

**Dedup board fetch:** `generateMetadata` (`board.select('name')`) and `BoardPage`
(`board.select('*')`) fetch the same row twice. Wrap the board read in
`React.cache()` (the pattern already exists in `src/app/public/[slug]/page.tsx`)
so both share one round-trip. With the embed, `BoardPage` consumes the embed
result rather than issuing its own `select('*')`.

**Default-status-list edge case:** `getBoardData` creates default status lists
when a board has none (`createDefaultStatusLists`). Preserve this: if the embed
returns zero status lists, run the existing default-creation path, then return.

**Expected:** in-region (function still in Mumbai), this saves only the collapsed
cheap waves (~10-20ms, to be confirmed against the Phase 0 ±10ms gate). The
cross-region hop is untouched. T1's strategic value is the cleaner path and the
safe foundation for a future Phase 2 region move.

## Ordering and risk control

Two steps this phase, no region change:

1. **Phase 0** ships and is observed in prod first (per-segment in-region baseline).
2. **T1** ships next and is validated against the Phase 0 ±10ms gate: waterfall
   collapsed, per-segment confirms ~1 DB round-trip, child order preserved, no
   behavior change. T1 is safe in-region on its own.

**Rollback:** T1 is a code revert (PostgREST embed → the prior separate-query
functions). Keep the old `getStatusLists` / `getRepoCards` / `getCommentsForCards`
functions until T1 is confirmed in prod, then remove in a follow-up cleanup PR. No
data migration, no schema change, so rollback is clean.

**The deferred trap (why this matters for Phase 2):** moving the function to Tokyo
**without** first consolidating both the reads (T1, this phase) **and** the
mutation Server Actions (`moveCardToBoard`, `addRepositoriesToBoard`, ~5 waves
each) turns cheap in-region waves into cross-region ones (~+630ms). T1 handles the
read half. Phase 2 must handle the mutation half before any global flip.

## Expected impact (honest)

| Phase    | Change                                          | Region cost                                 | Expected server-side time    |
| -------- | ----------------------------------------------- | ------------------------------------------- | ---------------------------- |
| Baseline | function `bom1`, 4 read waves + dup board fetch | 1 cross-region wrap (~126ms) + in-region DB | 351ms median                 |
| Phase 0  | instrument only                                 | unchanged                                   | 351ms (no change; data only) |
| T1       | embed + board dedup, function `bom1`            | 1 wrap (unchanged) + fewer in-region waves  | ~330-345ms                   |

These are estimates, not measurements (Codex finding 7). Phase 0 produces the
per-segment numbers that confirm or falsify the T1 row. The cross-region wrap is
not addressed this phase.

Phase 2 targets (out of scope, for context): coordinated global flip + T3 read
replica ~180-220ms (reads only); coordinated global flip + T4 full DB migration
realistic floor ~210ms (compute-bound).

## Testing

Test set for T1 (region tests deferred with the region work):

1. **CRITICAL regression remap unit test.** `fetchBoardInitialData` remap against
   a representative embed payload: board with multiple columns, cards in some
   columns and not others, cards **with and without** `projectinfo`, and a board
   with zero columns (→ default-creation path). Hard-code expected
   `statusLists` / `repoCards` / `comments` values (DAMP, AAA). **Assert child
   order** (columns by grid_row/grid_col, cards by `order`) matches pre-T1 order.
2. **Not-found path.** Board absent → `notFound()`. A non-404 embed error
   (e.g. forced network/RLS error) must **propagate, not 404**.
3. **Zero-status-lists.** Embed returns no status lists → `createDefaultStatusLists`
   still runs and the page renders the defaults.
4. **E2E smoke.** `/board/[id]` renders columns, cards, and a card's saved comment
   badge color after the embed change (behavior unchanged from the user's view).
5. **RLS embed test — public-board case (Codex finding 6).** `board`, `statuslist`,
   `repocard` have public SELECT policies (migration
   `20260219100000_add_public_board.sql`); `projectinfo` intentionally does **not**.
   Assert that for a non-owner hitting the authenticated `/board/[id]` bundle, the
   embed returns board/statuslist/repocard rows but `projectinfo` comes back
   empty/null (RLS fails closed on the embedded table, does not leak via the join).
6. **Phase 0 flag-off.** With `BOARD_TIMING_LOG` unset, no timing log line is
   emitted.

Plus the standard gate on each PR: `pnpm typecheck && pnpm test && pnpm lint &&
pnpm build && pnpm e2e:parallel` green.

Measurement: compare Phase 0 per-segment prod logs before vs after T1 from Tokyo
(curl `time_starttransfer`, **not** browser TTFB — browser TTFB on prod is an
interim-1xx artifact per the benchmark methodology and the recorded learning).

## Rollout

Scope = **2 PRs** (down from 3; the region-flip PR is deferred to Phase 2):

1. **PR 1 — Phase 0 instrument.** Ship, enable `BOARD_TIMING_LOG` in prod, collect
   the per-segment baseline (a few hours of warm traffic).
2. **PR 2 — T1 embed + board dedup.** Ship, confirm per-segment shows ~1 DB
   round-trip, child order preserved, no behavior regression, in-region delta
   within the ±10ms gate. Keep the old query functions until confirmed.

Per CLAUDE.md the user prefers direct commit to main unless a PR is requested;
treat each "PR" as a reviewable slice and confirm the commit/PR preference at ship
time.

## Out of Scope — Phase 2 (deferred, gated)

Phase 2 is the region/locality work. The key correction from this review: it is
**not** "just add a replica." A real cross-region win is a **coordinated unit** and
must ship as one:

1. **Consolidate the mutation Server Actions.** `moveCardToBoard` and
   `addRepositoriesToBoard` each run ~5 sequential DB waves
   (`src/lib/actions/repo-cards.ts`). These must be collapsed (RPC or fewer
   round-trips) **before** the function moves region, or every card move/add
   regresses ~+630ms. This is the mutation analogue of T1.
2. **Global `vercel.json` region flip** (`bom1` → `hnd1`). The only Node-runtime
   region lever is global; it moves **every** function, so its blast radius
   (account, settings, public/[slug], all mutations) must be audited and measured
   first. Re-instrument `/boards` and `/maintenance` (the Phase 0 scope this phase
   dropped) here. Server Actions inherit page region config, so the audit must
   cover them too (Codex finding 2).
3. **DB locality** — either **T3 Tokyo read replica** (`ap-northeast-1`, paid;
   geo-routing keys off the function's egress region, so it is gated on the flip)
   for ~180-220ms reads with writes still crossing to the Mumbai primary; **or**
   **T4 full Supabase DB migration** `ap-south-1` → `ap-northeast-1` (new
   ref/URL/keys, dump/restore, update the GitHub OAuth callback URL), gated on a
   data-residency review and a downtime budget (the May 21 plan's recorded
   blockers, line 374). De-risked: GitBox is GitHub-OAuth-only (no password hashes
   to migrate) and uses no Supabase Storage. Realistic post-T4 floor ~210ms
   (compute-bound), not an optimistic ~150ms.

**Auth note for Phase 2 (Codex finding 4):** the "auth adds no cross-region
latency" claim is warm-path only. `getClaims()` falls back to `getUser()` / a JWKS
fetch on cache miss, symmetric keys, or token refresh; `/account` and the GitHub
refresh route still call `getUser()` (`src/lib/auth/require-user.ts`). A region
move must measure these cold/fallback paths, not assume the ~5ms warm number.

**Compute-floor reduction** (lighter RSC payload, smaller serialization). The
~200ms compute floor is the ceiling on every region tier; attacking it is a
separate effort.

## Open questions

1. **Phase 0 emit mechanism** — Vercel function logs only, or also a Sentry
   breadcrumb / span? Logs are simplest; Sentry gives aggregation. Lean logs-only
   for Phase 0, revisit if aggregation is needed.
2. **Embedded ordering vs post-remap sort** — use PostgREST `referencedTable` order
   params, or sort in the remap? Both are correct; pick whichever the
   integration-shape test makes simplest to assert. (Decide during T1, not a
   blocker.)
3. **Keep or remove the old query functions after T1?** Recommend keep through T1
   validation, remove in a follow-up cleanup PR once the ±10ms gate is confirmed in
   prod.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding
above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~1.5h / CC: ~15min)** — board read path — Instrument per-segment server timing in `fetchBoardInitialData` + board fetch, gated behind `BOARD_TIMING_LOG`
  - Surfaced by: Phase 0 / Performance review — Codex finding 7 ("ms estimates not defensible; falsify with per-segment Server-Timing, cold vs warm")
  - Files: `src/lib/actions/board-data.ts`, `src/app/board/[id]/page.tsx`, `src/lib/constants.ts`
  - Verify: flag set → one structured log line per request (no PII); flag unset → no line; `pnpm test`
- [ ] **T2 (P1, human: ~3h / CC: ~25min)** — board read path — Replace the 4-wave read waterfall with one PostgREST nested embed: narrowed `projectinfo(comment, comment_color)`, child ordering preserved, `.maybeSingle()`, response-shape guards
  - Surfaced by: Architecture review + Codex finding 3 (child ordering), finding 5 (maybeSingle/not-found contract), finding 8 (projectinfo object-vs-null + 1000-row cap), decision 4A (narrow projectinfo)
  - Files: `src/lib/actions/board-data.ts`, `src/lib/actions/mappers.ts`, `src/app/board/[id]/page.tsx`
  - Verify: `pnpm typecheck && pnpm test`; per-segment log shows ~1 DB round-trip; in-region delta within the ±10ms Phase 0 gate
- [ ] **T3 (P2, human: ~30min / CC: ~10min)** — board read path — Dedup the duplicate board fetch (`generateMetadata` + `BoardPage`) via `React.cache()`
  - Surfaced by: Architecture review — current waterfall round-trip 2 is a duplicate of round-trip 1
  - Files: `src/app/board/[id]/page.tsx`
  - Verify: one board-row fetch per request in the Phase 0 log; metadata + page render unchanged
- [ ] **T4 (P1, human: ~2.5h / CC: ~20min)** — tests — Embed regression + contract test suite
  - Surfaced by: Test review + Codex finding 6 (public-board RLS case)
  - Files: `src/lib/actions/__tests__/board-data.test.ts` (or co-located), `e2e/`
  - Verify: remap test asserts child order + cards with/without `projectinfo` (hard-coded, DAMP/AAA); not-found path; non-404 embed error propagates; zero-status-lists → defaults; RLS public-board (`projectinfo` empty for non-owner); E2E smoke; flag-off → no log
- [ ] **T5 (P3, human: ~20min / CC: ~5min)** — cleanup — Remove `getStatusLists` / `getRepoCards` (`board.ts`) and `getCommentsForCards` (`project-info.ts`) once T1 is confirmed in prod. **Do NOT remove `getCommentsCore` (`shared-project-info.ts`) — `maintenance-project-info.ts` still depends on it.**
  - Surfaced by: Ordering & rollback — keep-then-remove discipline (caller audit: `getStatusLists` / `getRepoCards` are called only by `getBoardData` at `board.ts:450-451`; `getCommentsForCards`'s only real caller is `fetchBoardInitialData` at `board-data.ts:108`, both removed by T2)
  - Files: `src/lib/actions/board.ts` (getStatusLists, getRepoCards), `src/lib/actions/project-info.ts` (getCommentsForCards)
  - Verify: grep shows no remaining callers (`getCommentsCore` intentionally retained); `pnpm typecheck && pnpm test` green

## GSTACK REVIEW REPORT

| Review        | Trigger                          | Why                             | Runs | Status       | Findings                                   |
| ------------- | -------------------------------- | ------------------------------- | ---- | ------------ | ------------------------------------------ |
| CEO Review    | `/plan-ceo-review`               | Scope & strategy                | 0    | —            | not run (refines an already-approved plan) |
| Codex Review  | `/plan-eng-review` outside voice | Independent 2nd opinion         | 1    | issues_found | 8 findings (see CODEX below)               |
| Eng Review    | `/plan-eng-review`               | Architecture & tests (required) | 1    | clean        | 10 issues, 0 critical gaps                 |
| Design Review | `/plan-design-review`            | UI/UX gaps                      | 0    | —            | not run (backend-only, no UI)              |
| DX Review     | `/plan-devex-review`             | Developer experience gaps       | 0    | —            | not run                                    |

- **CODEX:** 8 outside-voice findings. 6 absorbed into this phase: child ordering preserved, `.maybeSingle()` with only `PGRST116` mapped to 404 so real errors propagate, `projectinfo` object-or-null handling plus a 1000-row-cap guard, an RLS public-board fail-closed test, narrowed `projectinfo(comment, comment_color)`, and a per-segment falsification gate. 2 routed to Phase 2: the mutation Server Actions (~5-wave) consolidation (the +630ms trap), and the auth cold/fallback paths beyond the ~5ms warm `getClaims()`.
- **CROSS-MODEL:** Claude eng review and the Codex outside voice converge. Both hold that the read-waterfall consolidation (T1) is the real this-phase win, that the latency estimates are not defensible without per-segment measurement (Phase 0), and that the region move must defer to Phase 2. No unresolved cross-model tension.
- **UNRESOLVED:** 0.
- **VERDICT:** ENG CLEARED — ready to implement Phase 0 + T1. The earlier "surgical `preferredRegion`" option (D6) was overturned by docs verification (route-segment region pinning is Edge-runtime-only on Vercel; the Node-runtime `/board/[id]` has no per-route region lever), so final scope is D7=A: T1 only, all region work deferred to Phase 2.
