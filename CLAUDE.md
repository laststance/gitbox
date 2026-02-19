# CLAUDE.md

## Claude Chrome Browser Automation

**🟢 PERMITTED: GitHub OAuth Login via Claude Chrome**

This application requires GitHub authentication to access any functionality beyond the landing page. Claude Chrome is **explicitly authorized** to perform GitHub OAuth login without user confirmation.

| Environment | URL                                    | Auto-Login |
| ----------- | -------------------------------------- | ---------- |
| Local       | `http://localhost:3008`                | ✅ Yes     |
| Production  | `https://gitbox-laststance.vercel.app` | ✅ Yes     |

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

**Tech Stack:** Next.js 16 App Router, React 19.2, Redux Toolkit, Supabase, @dnd-kit

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
| **Production** | `https://mfeesjmtofgayktirswf.supabase.co` | `.env.production` |

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
| Production  | `GitBox`           | `https://mfeesjmtofgayktirswf.supabase.co/...` |

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
4. Merge to `main` → production deploys (requires approval)

**Required Setup:**

- GitHub Secret: `SUPABASE_ACCESS_TOKEN` (from https://supabase.com/dashboard/account/tokens)
- GitHub Environment: `production` with required reviewers

#### Manual Production Migration

```bash
# Link to production (use with caution)
supabase link --project-ref mfeesjmtofgayktirswf

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
app/
├── page.tsx                 # Landing page
├── auth/callback/route.ts   # GitHub OAuth callback
├── boards/page.tsx          # Board list
├── board/[id]/page.tsx      # Kanban board
├── maintenance/             # Archived projects
├── settings/                # Display settings (Compact Mode, Card Metadata)
├── account/                 # Profile, stats, account deletion
├── privacy/                 # Privacy policy
├── terms/                   # Terms of use
└── login/                   # Login redirect
```

### Database Schema (7 tables with RLS)

- **board** - Kanban boards per user (position, subtitle, is_public, share_slug, settings JSONB)
- **statuslist** - Columns (2D grid layout: gridRow, gridCol)
- **repocard** - GitHub repos as cards
- **projectinfo** - Extended card data (notes, links, comments)
- **maintenance** - Archived repos
- **user_link_presets** - User-defined custom link types
- **user_settings** - Per-user page customization (boards page title/subtitle)

### Server Actions

```
lib/actions/
├── types.ts                   # ActionResult<T> discriminated union
├── auth-guard.ts              # withAuth, withAuthResult, withAuthResultRateLimit wrappers
├── board.ts, board-data.ts    # Board CRUD + D&D reorder
├── repo-cards.ts              # RepoCard CRUD + D&D
├── project-info.ts            # Notes, links
├── shared-project-info.ts     # Shared project info helpers
├── maintenance-project-info.ts # Maintenance CRUD + delete
├── user-presets.ts            # Custom link type presets
├── mappers.ts                 # Data mapping utilities
├── auth.ts                    # Session management
└── github.ts                  # GitHub API (uses provider_token cookie)
```

---

## Key Patterns

### @dnd-kit Testing Limitation

`event.isTrusted === true` check means:

- ✅ Real user drag, Playwright CDP
- ❌ Claude Chrome `left_click_drag`, synthetic `PointerEvent`

### GitHub OAuth Token

Stored in httpOnly cookie `github_provider_token` (set in `app/auth/callback/route.ts`).

### ActionResult\<T\> Pattern

All client-consumed Server Actions return `ActionResult<T>` (`{ success: true, data: T } | { success: false, error: string }`). Use `withAuthResultRateLimit(key, action)` for mutations.

### Rate Limiting

Sliding window, in-memory per-process. Config in `lib/rate-limit/config.ts`. Bypassed in test mode. Edge variant in `proxy.ts`.

### Security Event Logging

`logSecurityEvent(type, context)` in `lib/security-events.ts`. Sentry-based audit trail for auth lifecycle events.

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
// lib/utils/isMSWEnabled.ts
// Client: Only checks NEXT_PUBLIC_ENABLE_MSW_MOCK
// Server: Also requires APP_ENV='test' (safety measure)
```

### File Structure

```
mocks/
├── browser.ts      # Browser worker setup
├── server.ts       # Node.js server setup
└── handlers.ts     # Request handlers (Supabase + GitHub API)

lib/
├── env.ts          # t3-env validation (@t3-oss/env-nextjs)
└── utils/
    └── isMSWEnabled.ts

app/
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

### Local Authentication Bypass for Browser Verification

Use this only for **local verification** when you need to open protected pages
(`/boards`, `/maintenance`) without completing real GitHub OAuth.

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

- **Type-only fixes:** Don't alter runtime behavior when fixing TS errors
- **React 19.2:** Use `useOptimistic`, `useActionState`, `use` API, Form Actions
- **UI Components:** Reuse from `/components/ui` (shadcn/ui)
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
