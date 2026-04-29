# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-04-29

### Added

- Silent GitHub OAuth token refresh on expired provider token. When a Server Action returns `errorCode: 'GITHUB_TOKEN_MISSING'`, the client redirects to `/api/auth/github/refresh?next=<path>`, which silently re-runs OAuth via Supabase and returns the user to the original page.
- `sanitizeNextPath` utility for open-redirect-safe `next` query parameter handling. Reused by `/auth/callback` and `/api/auth/github/refresh`.
- `getForwardedClientIp` utility consolidating `x-forwarded-for` parsing for rate-limit IP resolution.
- `handleGitHubTokenMissing` client helper with module-level lock and `sessionStorage` attempt counter for loop protection.
- `errorCode: 'GITHUB_TOKEN_MISSING'` discriminant on `ActionResult<T>` failure variant; emitted by 4 GitHub Server Actions.
- Unit tests for the refresh route, both new hooks, the client helper, the cookie module, the 401 interceptor, and `errorCode` propagation across GitHub Server Actions.
- E2E spec covering the refresh route's attempt-cap bail-out (`e2e/logged-in/silent-token-refresh.spec.ts`).
- gstack skill-routing rules in `CLAUDE.md`.

### Changed

- GitHub provider token cookie TTL extended from 8 hours to 30 days, aligned with the Supabase refresh token lifetime. Cookie remains `httpOnly`, `secure` (production), and `SameSite=Lax`.
- `signOut`, `deleteAccount`, and the axios 401 interceptor now use the shared `deleteGitHubTokenCookie` helper.
- `auth.ts`, `github.ts`, `public-board.ts`, and the refresh route now use the shared `getForwardedClientIp` helper for consistent x-forwarded-for parsing.

### Fixed

- Bookmark-after-8-hours bug: users returning to a bookmarked `/board/<id>` after the previous 8-hour cookie window no longer hit "GitHub token not found. Please sign in again." The flow now silently re-authenticates and lands them back on the original page.

## [0.2.0] - prior

Initial tracked release.

[Unreleased]: https://github.com/laststance/gitbox/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/laststance/gitbox/compare/v0.2.0...v0.3.0
