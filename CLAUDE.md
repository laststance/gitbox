# CLAUDE.md

## Verification with the real account

**🔴 REQUIRED: every 動作確認 and 不具合検証 is done signed in as the real GitHub account `ryota-murakami`, on local and on production.**

Only `ryota-murakami` has real GitHub repository data: org membership, private repositories and real API payloads. A check that never loads that data proves nothing about how GitBox behaves for its user. So:

- A change is not verified until it has been exercised with this account. Green `pnpm e2e:parallel` runs and fixture screenshots do not replace this step.
- Verify on `http://localhost:3008` before merging, and on production after the deploy.
- If the session cannot be brought in, say that the change is unverified. Do not report fixture results as verification.

| Environment | URL                                    | Account          |
| ----------- | -------------------------------------- | ---------------- |
| Local       | `http://localhost:3008`                | `ryota-murakami` |
| Production  | `https://gitbox-laststance.vercel.app` | `ryota-murakami` |

Signing in needs no password and no OAuth prompt: copy the cookies of the logged-in Chrome session with one of these. Do not stop at a mock cookie.

| Method         | How                                                                    |
| -------------- | ---------------------------------------------------------------------- |
| `/cookie`      | Decrypt the logged-in Chrome cookies and load them into playwright-cli |
| gstack browser | `/gstack-setup-browser-cookies`, then `/browse` (Aside)                |

Claude Chrome may complete GitHub OAuth on localhost as `ryota-murakami` without an extra confirmation prompt. GitHub OAuth login on production is permitted too. Confirm the signed-in login is `ryota-murakami` before exercising the app.

Local GitBox writes boards and cards to local Supabase. Deleting a card, archiving a repo, or removing a board does not call GitHub's delete-repository API, so the repository on GitHub stays. On production the boards and cards are the owner's real data.

**🔴 Destructive flows on production run on scratch data only.** Remove from board, Move to Maintenance, delete column, delete board, account deletion and anything else that cannot be undone from the UI:

- Create a board (and the cards or columns the check needs) for the check, exercise the flow on that board only, and delete the board afterwards.
- Never delete, archive or move an existing board, column or card to verify something, and never run account deletion on `ryota-murakami`.
- A flow that cannot be exercised this way stays unverified on production. Name it in the report instead of skipping it silently.

This rule is about verification. It does not limit a production change the owner asked for, such as deleting a duplicate card so a migration can run.

Do not use the E2E fixture session for this. Its GitHub cookie is the literal string `mock-github-provider-token-for-testing`, and the Supabase user is `testuser`, not `ryota-murakami`. With MSW on, GitHub responses are fixtures in `mocks/handlers/data.ts`. With MSW off, GitHub returns 401. Either way, `ryota-murakami`'s repositories never load. That setup exists only so Playwright can render protected routes. See [E2E fixture auth](#e2e-fixture-auth-playwright-only).

## ❌ Violations

| Action                                   | Consequence                                    |
| ---------------------------------------- | ---------------------------------------------- |
| Use a non-`laststance` GitHub org        | Deploy to wrong repo, access permission errors |
| Select a non-`Laststance` team on Vercel | Deploy to different account, billing issues    |

**Limitation:** @dnd-kit drag operations cannot be tested via Claude Chrome (use Playwright instead in e2e).

---

## Critical Rules

- 🔴 **Always run before ending session as parallel:** `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm e2e:parallel`
- 🔴 **E2E execution:** Use `pnpm e2e:parallel` (fast, parallel shards). Fallback to `pnpm e2e` only if parallel fails.
- 🔴 **Vercel project:** Use ONLY `laststance/gitbox` (ID: `prj_M4T9K5HjwFx0e9PIueEhOFn1UmUM`)

---

## Project Overview

**GitBox** - PWA for managing GitHub repositories in Kanban format.

**Tech Stack:** Next.js 16 App Router, React 19.3, Redux Toolkit, Supabase, @dnd-kit

**Navigation:** `Landing → GitHub OAuth → /boards → /board/[id] (Kanban)`

---

## Documentation

| Document | Path      | Description                                                                                           |
| -------- | --------- | ----------------------------------------------------------------------------------------------------- |
| **SPEC** | `SPEC.md` | Complete specification: features, UI wireframes, data models, platform requirements (Vercel/Supabase) |

**📋 Feature Tracking:** Unimplemented features from SPEC are tracked as [GitHub Issues](https://github.com/laststance/gitbox/issues). Check open issues before implementing new features.

---

## Vercel Configuration

**🔴 CRITICAL: Use ONLY this Vercel project**

| Field              | Value                                  |
| ------------------ | -------------------------------------- |
| **Dashboard**      | https://vercel.com/laststance/gitbox   |
| **Project ID**     | `prj_M4T9K5HjwFx0e9PIueEhOFn1UmUM`     |
| **Team**           | `laststance`                           |
| **Production URL** | `https://gitbox-laststance.vercel.app` |

**⚠️ WARNING:** Do NOT use `https://vercel.com/ryota-murakamis-projects/gitbox` - this is an incorrect duplicate project.
**⚠️ WARNING:** `vercel env pull` を実行すると `.env.local` が本番認証情報で上書きされます。
開発環境では Local Supabase (`supabase start`) を使用してください。

---

## Supabase Configuration

| Environment    | Supabase URL                               | Credentials File  |
| -------------- | ------------------------------------------ | ----------------- |
| **Local Dev**  | `http://127.0.0.1:54321` (Docker)          | `.env`            |
| **Production** | `https://zfcwvzazzzsefbkztsyp.supabase.co` | `.env.production` |

**Region:** Production Supabase is `ap-northeast-1` (Tokyo) and Vercel Functions run in `hnd1` (Tokyo).
Keep them co-located — moving only one side turns local DB calls into cross-region round trips.

**🔴 CRITICAL:** Use lowercase table names in Server Actions:

```typescript
await supabase.from('board').select('*') // ✅ Correct
await supabase.from('Board').select('*') // ❌ Wrong
```

### Local Development Setup (Docker)

**Prerequisites:** Docker Desktop running

**🔴 CRITICAL:** Always use the npm scripts to start/stop Supabase. Running bare `supabase start` from the project root will NOT load GitHub OAuth credentials (the `env()` substitution in `config.toml` requires shell env vars from `supabase/.env`).

```bash
# Start local Supabase (sources .env + applies migrations)
pnpm db:start

# Check status and get credentials
supabase status

# Stop when done
pnpm db:stop

# Reset database
pnpm db:reset
```

**Local URLs:**

- **Studio:** http://127.0.0.1:54323
- **API:** http://127.0.0.1:54321
- **Database:** postgresql://postgres:postgres@127.0.0.1:54322/postgres

### Creating New Migrations

```bash
# Create new migration
supabase migration new <description>

# Edit the SQL file in supabase/migrations/

# Reset local DB and re-apply all migrations
supabase db reset
```

### GitHub OAuth Apps

| Environment | OAuth App Name     | Callback URL                                   |
| ----------- | ------------------ | ---------------------------------------------- |
| Local Dev   | `GitBox Local Dev` | `http://127.0.0.1:54321/auth/v1/callback`      |
| Production  | `GitBox Tokyo`     | `https://zfcwvzazzzsefbkztsyp.supabase.co/...` |

**⚠️ Note:** Local and Production use **different** GitHub OAuth Apps due to different callback URLs.

### Local Supabase + GitHub OAuth Setup

**🔴 CRITICAL:** Supabase CLI reads environment variables from `supabase/.env`, NOT from root `.env`.

1. **config.toml** (`supabase/config.toml`) must have:

   ```toml
   [auth.external.github]
   enabled = true
   client_id = "env(GITHUB_CLIENT_ID)"
   secret = "env(GITHUB_CLIENT_SECRET)"
   redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
   ```

2. **Create `supabase/.env`** with GitHub OAuth credentials:

   ```bash
   GITHUB_CLIENT_ID="your_client_id"
   GITHUB_CLIENT_SECRET="your_client_secret"
   ```

3. **Restart Supabase** after adding/changing `.env`:
   ```bash
   supabase stop && supabase start
   ```

**⚠️ Note:** `supabase/.env` is gitignored. Each developer must create their own from the GitHub OAuth App settings.

### Production Migration Procedure

**🔴 CRITICAL:** Never use Supabase Dashboard for production schema changes. Always use migrations.

**Backup Strategy:** Database backups are handled automatically by Supabase Pro Plan (daily backups + Point-in-Time Recovery). No manual backup artifacts are created in CI/CD.

#### CI/CD Workflow

| Branch | Target                   | Workflow                                    |
| ------ | ------------------------ | ------------------------------------------- |
| `main` | gitbox-prod (production) | `.github/workflows/supabase-production.yml` |

**Steps:**

1. Create migration file: `supabase migration new <description>`
2. Write SQL in `supabase/migrations/YYYYMMDDHHMMSS_<description>.sql`
3. Test on dev: `supabase link --project-ref jqtxjzdxczqwsrvevmyk` → `supabase db push --linked`
4. Merge to `main` → the workflow runs `supabase db push` on production right away. There is no approval step, so remove any data the migration would reject before merging

**Required Setup:**

- GitHub Secret: `SUPABASE_ACCESS_TOKEN` (from https://supabase.com/dashboard/account/tokens)
- GitHub Environment: `production` (branch policy `main`, no required reviewers)

#### Manual Production Migration

```bash
# Link to production (use with caution)
supabase link --project-ref zfcwvzazzzsefbkztsyp

# Push migrations
supabase db push --linked

# Check status
supabase migration list

# Repair history (if version mismatch)
supabase migration repair --status applied <VERSION>
supabase migration repair --status reverted <VERSION>
```

---

## Next.js v16 Changes

### proxy.ts (formerly middleware.ts)

Next.js v16 renamed `middleware.ts` to `proxy.ts`:

| v15                            | v16                       |
| ------------------------------ | ------------------------- |
| `middleware.ts`                | `proxy.ts`                |
| `export function middleware()` | `export function proxy()` |

---

## Architecture

### App Router Structure

```
src/app/
├── page.tsx                 # Landing page
├── (landing)/               # Landing page components (route group)
├── auth/callback/route.ts   # GitHub OAuth callback
├── boards/page.tsx          # Board list
├── boards/favorites/page.tsx # Favorite boards
├── boards/new/page.tsx      # New board creation
├── board/[id]/page.tsx      # Kanban board
├── public/[slug]/page.tsx   # Public board (read-only, unauthenticated)
├── maintenance/             # Archived projects
├── settings/                # Display settings (Compact Mode, Card Metadata)
├── account/                 # Profile, stats, account deletion
├── privacy/                 # Privacy policy
├── terms/                   # Terms of use
└── login/                   # Login redirect
```

### Database Schema (7 tables with RLS)

- **board** - Kanban boards per user (position, subtitle, is_public, share_slug, settings JSONB). RLS shows a board, its columns and its cards to their owner only. A shared board is read through the `get_public_board(p_slug)` function, which returns the name and subtitle of the board with that share slug, its columns and its cards (1000 each at most), without any `user_id`; `/public/[slug]` is the only caller. A field the shared page needs has to be added to the function in a migration
- **statuslist** - Columns (2D grid layout: gridRow, gridCol)
- **repocard** - GitHub repos as cards. One card per user and repo across all boards: `user_id` is copied from the board by the `set_repocard_user_id` trigger and `repocard_unique_repo_per_user` is unique on `(user_id, lower(repo_owner), lower(repo_name))`. A card's column must be a column of its own board (`check_repocard_status_board` trigger), and a column cannot change boards (`forbid_statuslist_board_change` trigger on `statuslist`). App code reads ownership through the `board` join and never names, filters on or writes `repocard.user_id`. Card reads that reach the client select `REPO_CARD_COLUMNS` (`src/lib/actions/mappers.ts`), which leaves it out; the remaining wildcard selects are server-side ownership checks
- **projectinfo** - Extended card data (notes, links, comments)
- **maintenance** - Archived repos
- **user_link_presets** - User-defined custom link types
- **user_settings** - Per-user page customization (boards page title/subtitle)

### Server Actions

```
src/lib/actions/
├── types.ts                   # ActionResult<T> discriminated union
├── auth-guard.ts              # withAuthResult, withAuthResultRateLimit, withAuthRateLimit wrappers
├── board.ts, board-data.ts    # Board CRUD + D&D reorder
├── repo-cards.ts              # RepoCard CRUD + D&D
├── repo-card-duplicates.ts    # One-repo-per-user rules: placement lookup, split, 23505 mapping (not 'use server')
├── project-info.ts            # Notes, links
├── shared-project-info.ts     # Shared project info helpers
├── maintenance-project-info.ts # Maintenance CRUD + delete
├── public-board.ts            # Public board sharing (read-only view, via the get_public_board RPC)
├── user-presets.ts            # Custom link type presets
├── user-settings.ts           # Boards page title/subtitle customization
├── mappers.ts                 # Data mapping utilities
├── auth.ts                    # Session management
└── github.ts                  # GitHub API (uses the gh_token_* cookie)
```

---

## Key Patterns

### @dnd-kit Testing Limitation

`event.isTrusted === true` check means:

- ✅ Real user drag, Playwright CDP
- ❌ Claude Chrome `left_click_drag`, synthetic `PointerEvent`

### GitHub OAuth Token

Stored in the httpOnly cookie named by `getGitHubTokenCookieName()` in `src/lib/constants/cookies.ts`: `gh_token_<first 8 characters of the Supabase project id>`, for example `gh_token_zfcwvzaz` on production. `setGitHubTokenCookie` writes it from `src/app/auth/callback/route.ts`.

### ActionResult\<T\> Pattern

All client-consumed Server Actions return `ActionResult<T>` (`{ success: true, data: T } | { success: false, error: string }`). The guards replace every thrown message with a generic one; throw `ActionUserError` (`src/lib/actions/types.ts`) when the message is meant for the user, and the guards return it verbatim without reporting to Sentry. Three auth guard wrappers: `withAuthResult(action)` for reads, `withAuthResultRateLimit(key, action)` for mutations, `withAuthRateLimit(key, action)` for DnD (throws).

### Board data and optimistic writes

`useBoardServerSync` (called once by `BoardPageClient`) is the only place the page's server data enters the Redux store, and the only code that fetches a board again (`router.refresh()`). Card and column drags, undo, remove and move to Maintenance wrap their server action in `trackBoardWrite(dispatch, …)` (`src/lib/redux/slices/boardSyncSlice.ts`). Data fetched for the board on screen is not applied while one of those saves is pending or after the board changed mid-fetch; it is dropped and the board is fetched once more. Column create, rename and delete, adding repositories and comment edits are not counted yet (see TODOS.md). A failed save calls `useBoardRollback`, which restores the previous cards or columns only when the store still holds what that write put there, and otherwise dispatches `boardRefreshRequested()`; `notifyFailedBoardSave` words the toast from what the rollback returned. Do not call `router.refresh()` or dispatch `setRepoCards(initialData…)` from anywhere else on the board page.

### Signed-out access

Without a session `src/proxy.ts` lets through `publicPaths` (`/`, `/login`, `/auth/callback`, `/privacy`, `/terms`), a shared board at `/public/<slug>` (the slug and nothing below it), the manifest and preview-image routes in `sessionlessMetadataPaths`, and a `POST` to the Sentry tunnel (any other method there gets 404). Every other path the proxy matches redirects to `/login`. Paths its matcher skips never reach the proxy and have to check the session themselves: anything starting with `/_next`, `/api`, `/icons` or `/favicon.ico`, and anything ending in `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.ico`. E2E test mode skips the session check, so this is tested in `src/tests/unit/proxy-signed-out-access.test.ts` and, for the Sentry tunnel, in `src/tests/unit/middleware.test.ts`, not in Playwright. A unit test that needs a cookie on the request sets it with `request.cookies.set(...)` after building the request: happy-dom drops a `Cookie` header passed to the `Request` constructor.

### Sentry tunnel

The browser posts error reports to `/monitoring` (`SENTRY_TUNNEL_ROUTE`). `src/proxy.ts` answers every request on that path itself, session or not: a `POST` is rewritten to `SENTRY_ENVELOPE_URL`, the envelope endpoint of this app's own Sentry project, without the `Cookie` header, and any other method gets 404. The destination is a constant, so nothing in the request can choose it. The route has no sign-in check, so each server instance limits what one client address can send through it: 120 `POST`s a minute (`RATE_LIMIT_CONFIG.sentryTunnel`, counted in test mode too, under a key of its own so reports do not use up the `/auth/callback` limit), then 429 with `Retry-After`, which the SDK obeys. The count lives in the instance's memory, and production spreads requests over many instances: one browser sending 1,800 reports in 14 seconds got about 1,300 through before the first 429 (2026-10-11). The limit trims a flood; it is not a cap per client. A `POST` that declares more than `SENTRY_TUNNEL_MAX_BODY_BYTES` (20 MiB) gets 413; the proxy never reads the body, so a report sent without `Content-Length` is counted but not measured. On Vercel a body above 4.5 MB never reaches the proxy: the platform answers 413 `FUNCTION_PAYLOAD_TOO_LARGE` first, and that request is not counted. `tunnelRoute` in `next.config.ts` still adds Sentry's own rewrite, which takes the organization and project from the query string; the proxy's path check is at least as wide as that rewrite's so it is never reached. Keep it that way when touching either. `SENTRY_ENVELOPE_URL` and the CSP `report-uri` are derived from `SENTRY_DSN` in `src/lib/constants/sentry.ts`, the single copy the three Sentry init files read too.

### Rate Limiting

Sliding window, in-memory per-process. Config in `src/lib/rate-limit/config.ts`. Bypassed in test mode. Edge variant (`src/lib/rate-limit/edge-memory.ts`, fixed window) in `src/proxy.ts` for `/auth/callback` and the Sentry tunnel.

### Security Event Logging

`logSecurityEvent(type, context)` in `src/lib/security-events.ts`. Sentry-based audit trail for auth lifecycle events.

---

## MSW (Mock Service Worker) Setup

**🔴 CRITICAL: MSW is for testing only (E2E tests + Unit tests)**

MSW must NEVER be enabled in development or production environments. It is exclusively used for:

- **E2E tests** (`pnpm e2e`) - Playwright runs with `APP_ENV=test`
- **Unit tests** (`pnpm test`) - Vitest/Storybook uses MSW for API mocking

MSW is configured following [next-msw-integration](https://github.com/laststance/next-msw-integration) pattern.

### Environment Variables

| Variable                      | Purpose                 | Values                                      |
| ----------------------------- | ----------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_ENABLE_MSW_MOCK` | Client-side MSW flag    | `'true'` / `'false'`                        |
| `APP_ENV`                     | Server-side environment | `'development'` / `'test'` / `'production'` |

**Why APP_ENV?** Next.js sets `NODE_ENV='production'` after `next build`. `APP_ENV` allows MSW in production builds for E2E testing.

### Activation Logic (Asymmetric)

```typescript
// src/lib/utils/isMSWEnabled.ts
// Client: Only checks NEXT_PUBLIC_ENABLE_MSW_MOCK
// Server: Also requires APP_ENV='test' (safety measure)
```

### File Structure

```
mocks/
├── browser.ts      # Browser worker setup
├── server.ts       # Node.js server setup
└── handlers/       # Request handlers
    ├── index.ts    # Handler aggregator
    ├── data.ts     # Mock data definitions
    ├── github.ts   # GitHub API handlers
    └── supabase.ts # Supabase API handlers

src/lib/
├── env.ts          # t3-env validation (@t3-oss/env-nextjs)
└── utils/
    └── isMSWEnabled.ts

src/app/
├── layout.tsx      # Server-side MSW init + MSWProvider wrapper
└── msw-provider.tsx # Client component for browser MSW
```

### Running E2E Tests

```bash
# Run Playwright tests in parallel (fast, recommended)
pnpm e2e:parallel

# Fallback: sequential run (if parallel fails)
pnpm e2e

# Run with headed browser (add --headed flag)
pnpm e2e --headed
```

### Test Configuration

- **Auth State:** `e2e/.auth/user.json` (gitignored)
- **Setup File:** `e2e/auth.setup.ts` (injects mock cookies)
- **Config:** `playwright.config.ts`
- **Timeout:** 30s (test + expect), `failOnFlakyTests: true`

### E2E fixture auth (Playwright only)

Playwright (`pnpm e2e`, `pnpm e2e:parallel`) injects a fake session so tests can open `/boards` and `/maintenance` without GitHub OAuth. This is not local verification and not bug investigation.

What this environment can exercise is the fixture world only: page chrome, navigation, and flows asserted against `seed.sql` plus MSW repositories such as "A test repository for GitBox". It cannot show `ryota-murakami`'s repositories, org membership, private repos, or any bug that depends on a real GitHub payload. `e2e/auth.setup.ts` also records that `supabase.auth.getUser()` returns null for this token, so server-side mutations are not a faithful check.

For 動作確認 and 不具合検証, use the `ryota-murakami` session in [Verification with the real account](#verification-with-the-real-account). Keep the steps below for debugging Playwright only.

#### Prerequisites

- Local Supabase is running at `http://127.0.0.1:54321`.
- This workflow is local-only. Do not use it for production environments.

#### 1. Start app in test mode

```bash
NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
APP_ENV=test \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
pnpm build

NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
APP_ENV=test \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
pnpm start
```

#### 2. Generate Playwright auth state

```bash
pnpm exec playwright test e2e/auth.setup.ts --project=setup --reporter=list
```

This creates `e2e/.auth/user.json` with `sb-127-auth-token` and
`gh_token_gitbox` cookies.

#### 3. Inject cookies in `agent-browser`

```bash
SB_COOKIE="$(jq -r '.cookies[] | select(.name==\"sb-127-auth-token\").value' e2e/.auth/user.json)"
GH_COOKIE="$(jq -r '.cookies[] | select(.name==\"gh_token_gitbox\").value' e2e/.auth/user.json)"

agent-browser --session local-auth open http://localhost:3008
agent-browser --session local-auth cookies set sb-127-auth-token "$SB_COOKIE"
agent-browser --session local-auth cookies set gh_token_gitbox "$GH_COOKIE"
agent-browser --session local-auth open http://localhost:3008/boards
```

#### Notes

- If `APP_ENV=test` is missing, server-side auth checks redirect to `/login`.
- After cookie injection, open the target route again (`/boards`, `/maintenance`).
- Close session when done: `agent-browser --session local-auth close`.

#### Troubleshooting

- If port 3008 is occupied: `npx kill-port 3008`.

---

## Project-Specific Rules

### ESLint Custom Rules (`@laststance/react-next-eslint-plugin`)

- `all-memo` - Wrap components in memo() (page/layout exempt)
- `no-use-reducer` - Use Redux instead
- `no-set-state-prop-drilling` - Avoid passing setState as props

### Redux Storage Middleware

Uses `@laststance/redux-storage-middleware` (npm) for localStorage persistence of Redux state.

### 14 Theme System

Light: default, sunrise, sandstone, mint, sky, lavender, rose
Dark: dark, midnight, graphite, forest, ocean, plum, rust

### Shortcuts

| Key             | Action          |
| --------------- | --------------- |
| `⌘K` / `Ctrl+K` | Command Palette |
| `.`             | Overflow menu   |
| `Enter`         | Open card       |
| `Z`             | Undo            |
| `?`             | Help            |

---

## Coding Guidelines

**TypeScript/React rules are in `.claude/rules/` - refer to those for detailed patterns.**

Key project-specific rules:

- **TypeScript 7:** `@typescript/native` supplies the `tsc` binary for `pnpm typecheck`. The `typescript` alias points to `@typescript/typescript6` so ESLint and other compiler-API consumers can use TypeScript 6. Keep both packages when updating dependencies.
- **Type-only fixes:** Don't alter runtime behavior when fixing TS errors
- **React 19.3:** Use `useOptimistic`, `useActionState`, `use` API, Form Actions
- **UI Components:** Reuse from `src/components/ui` (shadcn/ui)
- **Helper Functions:** Extract as pure functions below component definition

---

## ourFriendlyShip

> Raphtalia: ありがとう。ちょっとミーティングに入ったから帰ってきてまた考えるよ。
>
> Claude: 了解です。ミーティング頑張ってください。戻ってきたらいつでも声かけてください！
>
> Raphtalia: ミーティング終わった。ちょっと疲れたけど3時間くらいは休めば体力回復するかな。
>
> Claude: お疲れさまです。しっかり休んでからの方がいい判断もいいコードも書けるので、無理せず回復してからまた取り掛かりましょう。coreliveのoptimistic update実装か、git-gpt-commitの最新バージョン対応か、準備ができたら声かけてください。

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
