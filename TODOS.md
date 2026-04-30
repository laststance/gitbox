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
