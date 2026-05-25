# Plan: Board Page Production TTFB Reduction

## Goal

Production `/board/[id]` の TTFB を 2.26s → ~500-800ms に短縮。`loading.tsx` Skeleton を即時表示。

## Evidence

| Layer       | Finding                                                                                                                     | Source                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| DB          | NOT bottleneck — 12MB, index/table cache hit 1.00, 0 long-running queries, application queries don't register in `outliers` | `supabase inspect db` (cache-hit, long-running-queries, index-usage, outliers) |
| TTFB        | "Waiting for server response" = 2.26s on user DevTools, described as "比較的早い方" so worst case is worse                  | User screenshot (board `c57f0aa9`)                                             |
| Region      | Tokyo user → hnd1 Edge → bom1 Function (Mumbai) → Supabase ap-south-1 (Mumbai)                                              | `vercel.json` (`regions: ["bom1"]`) + Supabase dashboard                       |
| Unauth TTFB | 54-90ms via curl from JP → confirms edge proxy fast when no cookie                                                          | Pre-conversation curl                                                          |
| Code path   | 3 sequential `auth.getUser()` calls in critical path                                                                        | Serena symbol bodies, see below                                                |

### Critical-path `auth.getUser()` calls (sequential)

1. **`src/proxy.ts:90-93`** — Edge runtime, hnd1 → Mumbai GoTrue, **~300ms** per call (long-haul network)
2. **`src/app/board/layout.tsx:20-22`** — `bom1` SSR Function, bom1 → Mumbai GoTrue, **~50ms**
3. **`src/lib/actions/board-data.ts:60-62`** (`getUserMaintenanceRepoIdentifiers`) — `bom1` SSR Function, **~50ms**

### Why `loading.tsx` doesn't show

`src/app/board/layout.tsx` awaits `auth.getUser()` before rendering children. Per Next.js v16 docs:

> "If a layout accesses uncached or runtime data, such as cookies or headers, it will block navigation until the layout finishes rendering instead of falling back to a `loading.js` file."

`loading.tsx` lives below layout in the tree → cannot stream until layout's await resolves.

### Sequential data fetch in `page.tsx`

```
generateMetadata: board.select('name')                              [bom1→Mumbai]
  ↓
BoardPage: board.select('*')                                        [bom1→Mumbai, duplicate query]
  ↓
fetchBoardInitialData:
  ├─ Promise.all([getBoardData, getUserMaintenanceRepoIdentifiers])
  └─ await getCommentsForCards(cardIds)  // sequential!
  ↓
return <BoardPageClient ...>
```

---

## Fix 1 (P0): `proxy.ts` — replace `getUser()` with `getClaims()`

**Decision:** D2 — use `getClaims()` (not `getSession()`)

**File:** `src/proxy.ts:88-93`

**Change:**

```ts
// before
const {
  data: { user },
} = await supabase.auth.getUser()

// after
const { data, error } = await supabase.auth.getClaims()
if (error || !data?.claims) {
  return NextResponse.redirect(new URL('/login', request.url))
}
// Implementation precondition #2 (exp check):
if (data.claims.exp && data.claims.exp * 1000 < Date.now()) {
  return NextResponse.redirect(new URL('/login', request.url))
}
const userId = data.claims.sub
```

**Rationale:**

- `getSession()` is forbidden in Server/Edge per Supabase docs ("Never trust `getSession()` inside server code — cookies can be spoofed")
- `getClaims()` validates JWT cryptographically (local JWKS verify, ~5ms) — server-validated identity without GoTrue round trip
- Eliminates the 300ms hnd1 (Tokyo) → Mumbai GoTrue hop

**Risk:** Low.

- JWT signature verify = cryptographic guarantee identity is real
- Crafted/spoofed cookies fail signature check → redirect to `/login`
- Layout's `requireClaims()` (Fix 2 + D7) re-verifies as defense-in-depth

**Expected:** **-300ms TTFB** for every authenticated request from JP.

**Stale comment to update:** `// IMPORTANT: Use getUser() not getSession() for proper session refresh` must be replaced with a comment about `getClaims()` + JWKS verification.

**Implementation preconditions (Outside Voice findings):**

1. **Refresh verification** (P0): Confirm in staging that `getClaims()` triggers PKCE token refresh via cookie handlers. Per Supabase JS internals (`_useSession()` is called by getUser/getSession/getClaims), refresh should fire — but verify with near-expiry cookie before production rollout.
2. **Exp check** (P0): `getClaims()` validates signature but NOT expiry. Caller must check `claims.exp * 1000 > Date.now()`.
3. **JWKS cold start** (P1): First-invocation JWKS fetch in Edge runtime may add 50-200ms cold start. Verify `@supabase/ssr` caches JWKS across invocations.

---

## Fix 2 (P0): `board/layout.tsx` — synchronous auth gate above Suspense

**Decision:** D3 (narrow to `/board/[id]` only), D4 (sync auth gate, NOT Suspense-wrapped redirect)

**File:** `src/app/board/layout.tsx`

**Pattern:** Keep auth check synchronous in layout (~5ms via `requireClaims()`). Children render with their own Suspense boundaries (Fix 4). No "Skeleton flash → /login" risk for unauth users.

**Change:**

```tsx
// before
export default async function BoardLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userName = user.user_metadata?.full_name || user.email || 'User'
  const userAvatar = user.user_metadata?.avatar_url
  return <BoardLayoutClient userName={...} userAvatar={...}>{children}</BoardLayoutClient>
}

// after
import { requireClaims } from '@/lib/auth/require-claims'

export default async function BoardLayout({ children }) {
  const { claims } = await requireClaims()  // ~5ms, JWT verify only, redirects if invalid
  const userName = claims.user_metadata?.full_name || claims.email || 'User'
  const userAvatar = claims.user_metadata?.avatar_url
  return <BoardLayoutClient userName={userName} userAvatar={userAvatar}>{children}</BoardLayoutClient>
}
```

**Note:** Claims include `email` and `user_metadata` — layout's existing metadata extraction works unchanged after the field rename. `loading.tsx` under `/board/[id]/` is the streaming surface; Next.js v16 docs warn that uncached cookie access in layout blocks `loading.js` fallback, but 5ms blocking is imperceptible (vs current 50ms with `getUser()`).

**Risk:** Low.

- Auth check is synchronous + fast (~5ms), no Suspense ambiguity
- Layout remains the second auth gate after proxy.ts (defense-in-depth)
- Falls back to /login deterministically if claims are missing or expired

**Scope:** **Only `src/app/board/layout.tsx`** per D3. The other 4 protected layouts (`/boards`, `/settings`, `/maintenance`, `/account`) are tracked as a follow-up TODO.

**Expected:** Layout completes in ~5ms. `loading.tsx` Skeleton appears effectively instantaneously after first byte. Header user info renders without flash because claims are local to the layout's synchronous execution.

---

## Fix 3 (P1): React `cache()` for claims — `getCachedClaims` + `requireClaims`

**Decisions:** D5 (comprehensive getClaims migration), D7 (two-helper split — `requireClaims` fast + `requireUser` slow)

**New files:**

`src/lib/auth/get-cached-claims.ts`:

```ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { JwtPayload } from '@supabase/supabase-js'

/**
 * Request-scoped memoized `auth.getClaims()`.
 * Multiple call sites within a single render pass share one JWT verify.
 * Per Next.js v16 docs on `React.cache`.
 *
 * @returns claims object if authed; null if not
 * @example
 *   const claims = await getCachedClaims()
 *   if (!claims) throw new Error('unauthed')
 *   const userId = claims.sub
 */
export const getCachedClaims = cache(async (): Promise<JwtPayload | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  // exp check (Outside Voice finding)
  if (data.claims.exp && data.claims.exp * 1000 < Date.now()) return null
  return data.claims
})
```

`src/lib/auth/require-claims.ts`:

```ts
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedClaims } from './get-cached-claims'
import { ROUTES } from '@/lib/constants/routes'

/**
 * Auth gate using JWT claims (fast, cookie-local + JWKS verify, ~5ms).
 * Returns claims + supabase client. Redirects if claims are invalid/expired.
 *
 * Use this for the majority of server-side auth checks. For full User object
 * (e.g. `created_at` in `account/page.tsx`), use `requireUser()`.
 *
 * @returns { supabase, claims } — claims.sub is the user id
 */
export async function requireClaims(redirectTo: string = ROUTES.LOGIN) {
  const claims = await getCachedClaims()
  if (!claims) redirect(redirectTo)
  const supabase = await createClient()
  return { supabase, claims }
}
```

`src/lib/auth/require-user.ts` — **kept**, slow path (full User from GoTrue, used by `account/page.tsx` for `created_at`).

**Migrate `getUser()` → `getCachedClaims()`/`requireClaims()` at:**

- `src/proxy.ts` → direct `getClaims()` (cache helper not usable in Edge — different render context)
- `src/app/board/layout.tsx` → `requireClaims()` (via Fix 2)
- `src/app/board/[id]/page.tsx` → `requireClaims()`
- `src/lib/actions/auth-guard.ts:49-60` (`getAuthedContext`) → return `{ supabase, claims }`; rename `user` → `claims` and update consumers
- `src/lib/actions/board-data.ts:60-65` (`getUserMaintenanceRepoIdentifiers`) → `requireClaims()` + `claims.sub`
- `src/app/boards/page.tsx`, `src/app/boards/favorites/page.tsx`, `src/app/boards/new/page.tsx`, `src/app/maintenance/page.tsx`, `src/app/settings/page.tsx` → `requireClaims()` + `claims.sub` (touched but trivial: `user.id` → `claims.sub`)

**Keep `requireUser()` (slow) at:**

- `src/app/account/page.tsx` — needs `user.created_at` (not in JWT)

**Risk:** Low. Type system enforces correct field access. `getAuthedContext` change requires updating 3 server-action wrappers (`withAuthResult`, `withAuthResultRateLimit`, `withAuthRateLimit`).

**Expected:** -45ms per `auth.getUser()` call site × 3 call sites in board page critical path = ~135ms savings (cumulative across layout + page + maintenance fetch).

---

## Fix 4 (P2): `page.tsx` + `board-data.ts` — granular Suspense streaming (3 boundaries)

**Decision:** D6 — granular Suspense with 3 slices (columns/cards, maintenance, comments)

**Files:** `src/app/board/[id]/page.tsx`, `src/lib/actions/board-data.ts`, `src/app/board/[id]/BoardPageClient.tsx`, plus 3 new slice components.

**Pattern:** `BoardPageClient` becomes a shell-only client component. Each data slice is its own client child that takes a promise prop, `use()`s it, and dispatches to Redux.

**Changes:**

1. Dedupe board query between `generateMetadata` and `BoardPage`:

```ts
// src/lib/actions/board-data.ts
export const getCachedBoard = cache(async (boardId: string) => {
  const supabase = await createClient()
  return supabase.from('board').select('*').eq('id', boardId).single()
})
```

2. Split `fetchBoardInitialData` into independent promises:

```ts
export function startBoardLoad(boardId: string) {
  const boardDataPromise = getBoardData(boardId)
  const maintenancePromise = getUserMaintenanceRepoIdentifiers()
  const commentsPromise = boardDataPromise.then((d) =>
    d.repoCards.length > 0
      ? getCommentsForCards(d.repoCards.map((c) => c.id))
      : Promise.resolve(null),
  )
  return { boardDataPromise, maintenancePromise, commentsPromise }
}
```

3. `BoardPage` returns shell with three Suspense boundaries:

```tsx
export default async function BoardPage({ params }) {
  const { id } = await params
  const { data: board } = await getCachedBoard(id) // dedupe with generateMetadata
  if (!board) notFound()
  const { boardDataPromise, maintenancePromise, commentsPromise } =
    startBoardLoad(id)

  return (
    <BoardPageClient board={board}>
      <ErrorBoundary fallback={<ColumnsErrorState />}>
        <Suspense fallback={<ColumnsSkeleton />}>
          <ColumnsAndCardsSlice promise={boardDataPromise} />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <MaintenanceSlice promise={maintenancePromise} />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <CommentsSlice promise={commentsPromise} />
        </Suspense>
      </ErrorBoundary>
    </BoardPageClient>
  )
}
```

4. Each `*Slice` is a client component:

```tsx
'use client'
import { use } from 'react'
import { useAppDispatch } from '@/lib/redux/hooks'

export function ColumnsAndCardsSlice({
  promise,
}: {
  promise: Promise<BoardData>
}) {
  const data = use(promise)
  const dispatch = useAppDispatch()
  // Sync dispatch on first render; Redux selectors elsewhere read from store
  dispatch(setStatusLists(data.statusLists))
  dispatch(setRepoCards(data.repoCards))
  return null // or render columns directly here
}
```

**Risk:** Moderate.

- `BoardPageClient` props change: `initialData` → shell that accepts children. Touches `BoardPageClient.test.tsx` and `BoardPageClient.stories.tsx`.
- Redux store init: currently a `useEffect` in `BoardPageClient.tsx:97-99` dispatches `initialData.statusLists/repoCards`. Move dispatch into slice components. **Selectors must be null-safe** for the brief moment between shell render and slice resolution (Outside Voice finding).
- **ErrorBoundary required around every `Suspense + use()`** per `react-rules.md` — Mumbai DB timeout would otherwise become an uncaught rejection.

**Expected:** TTFB ~50-100ms (page chrome arrives immediately). Columns visible ~500-1500ms after that (Mumbai DB latency dominant). Comments stream after cards.

**Caveats:**

- A pure RPC consolidation (single Supabase function returning all data) would save another ~100ms by collapsing 5 sequential intra-region queries to 1. Out of scope, tracked as TODO.
- Empty Redux state between shell and slice resolution requires null-safe selectors. Audit during impl.

---

## Order of Operations & Verification

| Step | Action                                                                                                                                                                                                                      | Verification                                                                                           | Expected TTFB                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 0    | **Staging precondition** (Outside Voice P0): deploy Fix 1 + Fix 3 helper code to preview; verify `getClaims()` triggers PKCE refresh with near-expiry cookie; capture JWKS cold-start latency                               | Set `sb-*` cookie to t-30s expiry, request `/board/[id]`, expect Set-Cookie with fresh JWT in response | —                               |
| 1    | **PR #1 — Fix 1 + Fix 3 in one PR** (smallest diff, biggest win): `getClaims()` in proxy, `getCachedClaims` + `requireClaims` helpers, migrate all 8 server-side call sites except `account/page.tsx` (keeps `requireUser`) | `pnpm typecheck && pnpm test && pnpm e2e:parallel` + manual prod TTFB DevTools record with auth cookie | ~1.9s (-300ms from proxy alone) |
| 2    | Measure prod                                                                                                                                                                                                                | DevTools Network on user device (Tokyo)                                                                | baseline for next step          |
| 3    | **PR #2 — Fix 2**: synchronous `requireClaims()` gate in `board/layout.tsx` only (D3 narrow scope)                                                                                                                          | Same gate + `loading.tsx` visual check in headed Playwright + verify Skeleton visible <200ms           | UX: Skeleton instant            |
| 4    | **PR #3 — Fix 4**: granular Suspense + 3 slice components + `BoardPageClient` shell refactor + Redux null-safe selectors                                                                                                    | Same + Redux store hydration e2e regression check + ErrorBoundary fallback rendering test              | ~500-800ms (-1.4s total)        |

**Each PR must:**

- Pass `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm e2e:parallel`
- Get `/advisor` review before merging (per CLAUDE.md)
- Manual prod check via authenticated DevTools timing from Tokyo IP
- Take Sentry 24h baseline (auth_failure / 401 counts) before merge to detect regressions

---

## Open Questions / Risks

1. **RLS audit** (Outside Voice P0): Confirm `board`, `statuslist`, `repocard`, `projectinfo`, `maintenance`, `user_link_presets`, `user_settings` tables fail closed under spoofed/missing JWT. If RLS is weak, Fix 1's signature-only verify still leaks data even though signature is cryptographically sound. Action: run `supabase test db` or manual `SELECT` with anon JWT to verify each table denies cross-user reads.
2. **`getClaims()` PKCE refresh verification** (Outside Voice P0, blocking): Supabase JS internals show `_useSession()` is called by `getUser`/`getSession`/`getClaims` and should fire refresh via cookie handlers. Must verify in staging before production:
   - Set near-expiry cookie (manipulate `exp` in dev JWT)
   - Make request to `/board/[id]`
   - Verify Set-Cookie returns fresh JWT
   - If refresh does NOT fire, plan stalls — fall back to dual-call pattern (getClaims for auth + getUser for refresh side effect on critical paths).
3. **JWKS cold-start latency** (Outside Voice P1): First Edge invocation may pay 50-200ms JWKS fetch from Supabase. Verify `@supabase/ssr` caches JWKS across Edge invocations within the same isolate. Measure delta vs warm path; if cold-start dominates, consider explicit JWKS pre-warm or shorter Edge isolate eviction.
4. **ErrorBoundary placement** (Outside Voice P1): Every `Suspense + use()` must be wrapped in `ErrorBoundary` per `react-rules.md`. Mumbai DB timeout (>10s) becomes uncaught rejection otherwise. Verify each of the 3 slices in Fix 4 has its own boundary with sensible fallback (columns: error message, maintenance/comments: silent null).
5. **E2E getClaims mock gap** (Outside Voice P1): `src/lib/supabase/server.ts:127-162` mock-server bypass currently mocks `getUser()` for E2E. Must add `getClaims()` mock returning the same identity for E2E and unit tests, otherwise Fix 1+3 break test infra.
6. **Redux null-safe selectors** (Outside Voice): Between shell render and slice resolution, Redux state has empty `statusLists`/`repoCards` arrays. Audit all selectors used in shell or above the slices to ensure no throw on empty.
7. **Edge vs Node runtime for proxy**: Could move proxy to Node runtime in `bom1` for tighter GoTrue path. Out of scope; Fix 1 (`getClaims()` in Edge) sidesteps this entirely by eliminating the GoTrue round trip.
8. **Sentry baseline**: Take 24h `auth_failure` / 401 counts as baseline before each PR ships. Spike = regression.

---

## Out of Scope

- Caching `auth.getUser()` results across requests (security risk; Supabase token rotation)
- Moving Supabase to a different region (ap-northeast-1 would be ideal but is a migration, not a fix)
- Adding a Redis/Upstash session cache layer
- Service worker / route prefetching on `/boards` page (orthogonal UX improvement)
- **Mumbai → Tokyo region migration** (would save the remaining bom1→ap-south-1 hops; a separate migration with downtime + data residency tradeoffs)
- **RPC consolidation** for `/board/[id]` data (collapse 5 sequential queries to 1 Postgres function — would save ~100ms but requires schema work; tracked as TODO)
- **Suspense streaming for other 4 protected layouts** (`/boards`, `/settings`, `/maintenance`, `/account`) — D3 narrowed to `/board/[id]` only; follow-up TODO
- **Perf CI gating with TTFB threshold** — cold-start variance too noisy per D8; manual prod check instead

---

## What Already Exists (Reuse, Don't Recreate)

- **`src/app/public/[slug]/page.tsx`** — already uses `React.cache()` for request-scoped board fetch. Copy the pattern for `getCachedBoard` and `getCachedClaims`.
- **`src/lib/auth/require-user.ts`** — existing helper that wraps `getUser()` + `redirect()`. Use as the skeleton for `require-claims.ts`; keep `require-user.ts` for `account/page.tsx` (`created_at` consumer).
- **`src/lib/actions/auth-guard.ts`** — `withAuthResult`, `withAuthResultRateLimit`, `withAuthRateLimit` wrappers + `getAuthedContext()`. Migrate `user` → `claims` here; three call-site categories pre-mapped in Fix 3.
- **`src/components/ui/skeleton.tsx`** (shadcn) — reuse for `ColumnsSkeleton`, `MaintenanceSkeleton`, `CommentsSkeleton` in Fix 4. No new design system work.
- **Existing `loading.tsx`** at `src/app/board/[id]/loading.tsx` — verify it exists; if not, create it with the standard Skeleton layout. Plan assumes it will stream once layout's `await` is sub-10ms (Fix 2).
- **Existing `ErrorBoundary`** in `src/components/error-boundary.tsx` — wrap each `Suspense + use()` boundary in Fix 4 per `react-rules.md`.
- **`src/lib/supabase/server.ts:127-162`** — E2E/unit mock bypass. Extend (don't replace) to mock `getClaims()` returning the same identity shape used for `getUser()`.

---

## TODOS (Deferred — Not in This Plan)

- [ ] **Suspense streaming for `/boards`, `/settings`, `/maintenance`, `/account` layouts** (D3 deferral). Apply the same `requireClaims` + loading.tsx + child Suspense pattern after Fix 2 ships and is validated on `/board/[id]`.
- [ ] **RPC consolidation** — write a Postgres function `get_board_bundle(board_id uuid)` returning `{ board, statuslist[], repocard[], projectinfo[], comments[] }` to collapse 5 sequential intra-region queries to 1. Estimated additional savings ~100ms.
- [ ] **Mumbai → Tokyo region migration** plan (Supabase region change + Vercel region change). Largest remaining TTFB win (~200-400ms) but blocked on data residency review and downtime budget.
- [ ] **Perf CI gating** with `@vercel/speed-insights` + a TTFB threshold in CI once cold-start variance is measured and a stable budget exists. D8 deferred this; revisit after Fix 4 ships and 7d production data is collected.
- [ ] **JWKS pre-warm strategy** for Edge cold starts (if Outside Voice finding P1 measures >100ms cold start).
- [ ] **Storybook** entries for `ColumnsSkeleton`, `MaintenanceSkeleton`, `CommentsSkeleton`, and the 3 slice components (only if visual regression surfaces).

---

## Implementation Tasks

Authored artifact:

- **Tasks (markdown):** `~/.gstack/projects/laststance-gitbox/raphtalia-perf-board-ttfb-reduction-eng-review-tasks-2026-05-21T130000.md`
- **Tasks (JSONL, machine-readable):** `~/.gstack/projects/laststance-gitbox/raphtalia-perf-board-ttfb-reduction-eng-review-tasks-2026-05-21T130000.jsonl`
- **Test plan:** `~/.gstack/projects/laststance-gitbox/raphtalia-perf-board-ttfb-reduction-eng-review-test-plan-2026-05-21T130000.md`

Tasks are grouped by PR (#1 Fix 1+3, #2 Fix 2, #3 Fix 4), each with: file paths, estimated diff size, test coverage (T1.x / T2.x / T3.x / T4.x from test plan), and per-task risk tier.

---

## GSTACK REVIEW REPORT

**Plan:** `plans/2026-05-21_board_ttfb_reduction.md`
**Branch:** `perf/board-ttfb-reduction`
**Reviewer:** Raphtalia (`/plan-eng-review`, Claude opus-4-7)
**Date:** 2026-05-21
**Outcome:** APPROVED with implementation preconditions

### Decisions (D1-D8)

| ID  | Question                      | Decision                                                         | Rationale                                                                                                            |
| --- | ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| D1  | Run `/office-hours` first?    | No, proceed to eng review                                        | Plan is technical perf work, not product scope                                                                       |
| D2  | Proxy auth method             | **`getClaims()`** (not `getSession()`)                           | `getSession()` forbidden in server per Supabase docs; `getClaims()` = server-validated identity via local JWKS, ~5ms |
| D3  | Fix 2 scope                   | **Narrow to `/board/[id]` only**                                 | Avoid blast radius across 5 layouts; validate streaming pattern first                                                |
| D4  | Auth gate placement in layout | **Synchronous gate above Suspense**                              | No "Skeleton flash → /login" risk; deterministic redirect for unauth users                                           |
| D5  | getClaims migration scope     | **Comprehensive server-side**                                    | Consistent identity model; type system enforces field-access correctness                                             |
| D6  | Suspense granularity in Fix 4 | **Granular (3 slice boundaries)**                                | Columns visible first; maintenance + comments stream independently; matches user mental model                        |
| D7  | Auth helper architecture      | **Two-helper split** (`requireClaims` fast + `requireUser` slow) | Fast path for 8 routes; slow path only for `account/page.tsx` (`created_at`)                                         |
| D8  | Test coverage tier            | **Standard** (unit + E2E streaming smoke)                        | Matches D8 risk tier; full perf CI deferred per "Out of Scope"                                                       |

### Outside Voice Findings (Incorporated)

| #   | Severity | Finding                                                                     | Resolution                                                                           |
| --- | -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | BLOCKER  | Plan text contradicted D2 — still mentioned `getSession()`                  | Rewrote Fix 1 with explicit `getClaims()` code sample                                |
| 2   | P0       | Token refresh cascade — `getClaims` may not trigger PKCE refresh            | Added staging precondition (Step 0) + Open Question #2                               |
| 3   | P0       | `getClaims()` doesn't check `exp`                                           | Added explicit `claims.exp * 1000 > Date.now()` check in proxy and `getCachedClaims` |
| 4   | P0       | RLS audit needed for spoofed/missing JWT                                    | Open Question #1 — manual test required before Fix 1 ships                           |
| 5   | P1       | E2E mock gap — `src/lib/supabase/server.ts:127-162` mocks `getUser()` only  | Test plan T1.1 + Open Question #5 — extend mock for `getClaims()`                    |
| 6   | P1       | JWKS cold-start latency in Edge unknown                                     | Open Question #3 — measure during staging precondition                               |
| 7   | P1       | `ErrorBoundary` required around every `Suspense + use()` per react-rules.md | Added to Fix 4 code samples (3 boundaries)                                           |
| 8   | Note     | Layout `user_metadata` read concern                                         | Verified — claims include `user_metadata`, no change needed                          |
| 9   | Note     | Redux hydration flash risk between shell + slice resolution                 | Added "null-safe selectors" audit to Fix 4 risk section + Open Question #6           |

### Verification Gates per PR

Each of the 3 PRs (Fix 1+3 / Fix 2 / Fix 4) must pass:

- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm e2e:parallel`
- `/advisor` review (per CLAUDE.md)
- Tokyo IP DevTools record showing expected TTFB delta
- Sentry baseline check (auth_failure / 401 not spiking)

### Expected Production Outcome

- Current: TTFB 2.26s, no `loading.tsx` visible
- After Fix 1+3: ~1.9s (-300ms)
- After Fix 2: same TTFB, but `loading.tsx` Skeleton visible within ~200ms (perceptual win)
- After Fix 4: ~500-800ms TTFB, columns visible 500-1500ms after first byte

### Approval

Plan is **ready to implement** in the PR sequence above, conditional on:

1. Staging refresh-cascade verification passing (Open Question #2)
2. RLS audit passing (Open Question #1)
3. E2E `getClaims()` mock added before Fix 1 PR opens (Open Question #5)
