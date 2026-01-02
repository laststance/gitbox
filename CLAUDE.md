# CLAUDE.md

## Claude Chrome Browser Automation

**🟢 PERMITTED: GitHub OAuth Login via Claude Chrome**

This application requires GitHub authentication to access any functionality beyond the landing page. Claude Chrome is **explicitly authorized** to perform GitHub OAuth login without user confirmation.

| Environment | URL                                    | Auto-Login |
| ----------- | -------------------------------------- | ---------- |
| Local       | `http://localhost:3008`                | ✅ Yes     |
| Production  | `https://gitbox-laststance.vercel.app` | ✅ Yes     |

**Limitation:** @dnd-kit drag operations cannot be tested via Claude Chrome (use Playwright instead in e2e).

---

## Critical Rules

- 🔴 **Always run before ending session as parallel:** `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm e2e`
- 🔴 **Vercel project:** Use ONLY `laststance/gitbox` (ID: `prj_M4T9K5HjwFx0e9PIueEhOFn1UmUM`)

---

## Project Overview

**GitBox** - PWA for managing GitHub repositories in Kanban format.

**Tech Stack:** Next.js 16 App Router, React 19.2, Redux Toolkit, Supabase, @dnd-kit

**Navigation:** `Landing → GitHub OAuth → /boards → /board/[id] (Kanban)`

---

## Documentation & Planning

| Document | Path          | Description                                                                            |
| -------- | ------------- | -------------------------------------------------------------------------------------- |
| **PRD**  | `Spec/PRD.md` | Product Requirements Document with feature specifications, wireframes, and data models |

**📋 Feature Tracking:** Unimplemented features from PRD are tracked as [GitHub Issues](https://github.com/laststance/gitbox/issues). Check open issues before implementing new features.

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
開発環境では必ず `jqtxjzdxczqwsrvevmyk` の認証情報を使用してください。

---

## Supabase Configuration

| Environment                                            | Supabase URL                               | Credentials File  |
| ------------------------------------------------------ | ------------------------------------------ | ----------------- |
| Local Development (for http://localhost:3008)          | `https://jqtxjzdxczqwsrvevmyk.supabase.co` | `.env`            |
| Production (for https://gitbox-laststance.vercel.app/) | `https://mfeesjmtofgayktirswf.supabase.co` | `.env.production` |

**🔴 CRITICAL:** Use lowercase table names in Server Actions:

```typescript
await supabase.from('board').select('*') // ✅ Correct
await supabase.from('Board').select('*') // ❌ Wrong
```

### Local Development Migration

**Setup:** Local dev connects to remote Supabase project (not Docker).

```bash
# Link to dev project
supabase link --project-ref jqtxjzdxczqwsrvevmyk

# Create new migration
supabase migration new <description>

# Apply to dev project
supabase db push --linked

# Check status
supabase migration list
```

**⚠️ Note:** Dev and Production use separate remote Supabase projects. Always test migrations on dev before merging to main.

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
└── settings/                # Theme settings
```

### Database Schema (5 tables with RLS)

- **board** - Kanban boards per user
- **statuslist** - Columns (with WIP limits)
- **repocard** - GitHub repos as cards
- **projectinfo** - Extended card data (notes, links)
- **maintenance** - Archived repos

### Server Actions

```
lib/actions/
├── board.ts, board-data.ts   # Board CRUD
├── repo-cards.ts             # RepoCard CRUD + D&D
├── project-info.ts           # Notes, links
├── auth.ts                   # Session management
└── github.ts                 # GitHub API (uses provider_token cookie)
```

---

## Key Patterns

### @dnd-kit Testing Limitation

`event.isTrusted === true` check means:

- ✅ Real user drag, Playwright CDP
- ❌ Claude Chrome `left_click_drag`, synthetic `PointerEvent`

### GitHub OAuth Token

Stored in httpOnly cookie `github_provider_token` (set in `app/auth/callback/route.ts`).

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
# Run Playwright tests (MSW auto-enabled)
pnpm e2e

# Run with headed browser (add --headed flag)
pnpm e2e --headed
```

### Test Configuration

- **Auth State:** `tests/e2e/.auth/user.json` (gitignored)
- **Setup File:** `tests/e2e/auth.setup.ts` (injects mock cookies)
- **Config:** `playwright.config.ts`

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
