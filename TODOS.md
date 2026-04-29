# TODOs

Follow-up items surfaced during code review. Not ship-blockers — captured here so they don't get lost.

## Silent GitHub Token Refresh — P2 follow-ups

From the `/ship` adversarial review of `feat/silent-github-token-refresh` (PR #TBD).

### UX

- [ ] **Preserve `?query` and `#hash` on silent refresh redirect.** `useOrganizationData.ts:65` and `useRepositoryData.ts:62` (and any other call site) pass `window.location.pathname` only; users on `/board/abc?filter=open#card-123` land on `/board/abc` after refresh. Pass `${pathname}${search}${hash}` instead. `sanitizeNextPath` already accepts the full string.
- [ ] **Clear refresh attempt counter on `/login?error=token_refresh_failed`.** When the route bails on `attempt > MAX_REFRESH_ATTEMPTS`, sessionStorage still reads `2`; the next visit bails immediately even though it's a new session. Either clear in `/login` mount when that error is present, or have the route emit a clearing `Set-Cookie` signal.

### Concurrency / correctness

- [ ] **Multi-tab PKCE collision.** Tab A mid-refresh + Tab B clicking "Sign in with GitHub" can clobber the Supabase `sb-…-code-verifier` cookie, causing "invalid grant" on the slower tab's `/auth/callback`. Detect "code verifier mismatch" specifically in callback and treat as recoverable (silent restart) rather than surfacing the raw error.
- [ ] **401 interceptor races freshly-set cookie.** `axios-github.ts:101-110` unconditionally calls `deleteGitHubTokenCookie()` on any 401. A stale request resolving after refresh completes can nuke the fresh cookie. Gate deletion on the in-flight token matching the current cookie value.
- [ ] **Race on rapid combobox open/close.** `useOrganizationData` and `useRepositoryData` lack `AbortController` and a `cancelled` flag. Out-of-order resolution from rapid open→close→open can land stale data. Add an `ignore` flag in the effect closure.

### Security / rate-limit

- [ ] **`x-forwarded-for` first-IP spoofing on Vercel.** `getForwardedClientIp` takes `split(',')[0]`, which on Vercel can be attacker-controlled (Vercel appends rather than replaces). Bypass is rate-limit-only and requires authenticated session. Switch to `x-real-ip` (Vercel-set) or read the LAST entry of x-forwarded-for.
- [ ] **Server-side `attempt` cap bypassed when `sessionStorage` unavailable.** If Safari private mode / quota exceeded, the client always sends `attempt=1`; the server cap (`> 1`) never trips. Add a server-side short-lived nonce/cookie counter, or send `attempt=2` after first in-memory attempt when storage fails.
- [ ] **Error message reflection in `/login?message=...`.** `route.ts:80,124` reflect `rateLimitResult.error` and `oauthError.message` via `encodeURIComponent` to a redirect URL. Emit fixed error codes only (`rate_limited`, `oauth_failed`); keep messages in server logs / Sentry.

### Tests

- [ ] **Dedicated unit tests for `sanitizeNextPath`** (especially the `null`-input branch — currently exercised only indirectly via the refresh-route tests).
- [ ] **Dedicated unit tests for `getForwardedClientIp`** — multi-hop chain, whitespace, empty header, malformed input.

### Risk acceptance

- [ ] **30-day provider token cookie TTL — risk re-confirm.** Materially expands replay window vs. previous 8h. Cookie flags are good (`httpOnly`, `secure` in prod, `SameSite=Lax`); scope is `read:user user:email repo` (write access included). If write access isn't required for current product surface, narrow the OAuth scopes.
