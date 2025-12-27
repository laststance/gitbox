# Technology Stack

## Architecture

**Next.js App Router + React 19 + Redux Toolkit + Supabase**

Client-server hybrid architecture where:

- Server Actions handle data mutations and GitHub API calls (secure token access)
- Redux manages client-side UI state with localStorage persistence
- Supabase provides database, authentication, and Row Level Security (RLS)

## Core Technologies

- **Language**: TypeScript 5.x (strict mode)
- **Framework**: Next.js 16 (App Router, Server Actions, RSC)
- **Runtime**: Node.js 24+ (via Volta)
- **Package Manager**: pnpm (workspace monorepo)

## Key Libraries

| Category    | Library                            | Purpose                             |
| ----------- | ---------------------------------- | ----------------------------------- |
| State       | Redux Toolkit + react-redux        | Client state with localStorage sync |
| UI          | shadcn/ui + Radix + Tailwind CSS 4 | Component primitives                |
| Drag & Drop | @dnd-kit/\*                        | Kanban card movement                |
| Forms       | react-hook-form + zod              | Validation                          |
| Database    | @supabase/supabase-js + ssr        | PostgreSQL with RLS                 |
| Animation   | framer-motion                      | UI transitions                      |
| Patterns    | ts-pattern                         | Type-safe pattern matching          |

## Development Standards

### Type Safety

- TypeScript strict mode enabled
- No `any` types unless explicitly justified
- Zod schemas for runtime validation
- Indexed Access Types for API type reuse

### Code Quality

- ESLint with `@laststance/react-next-eslint-plugin` custom rules:
  - `all-memo`: Components wrapped in memo() (page/layout exempt)
  - `no-use-reducer`: Use Redux instead of useReducer
  - `no-set-state-prop-drilling`: Avoid passing setState as props
- Prettier formatting
- Husky + lint-staged pre-commit hooks

### Testing

- **Unit**: Vitest + Testing Library
- **E2E**: Playwright (with MSW for API mocking)
- **Visual**: Storybook 10 with a11y addon
- MSW for API mocking in test environments only

## Development Environment

### Required Tools

- Node.js 24+ (managed via Volta)
- pnpm 10.x
- Supabase CLI (for local development)

### Common Commands

```bash
# Dev: pnpm dev (port 3008)
# Build: pnpm build
# Test: pnpm test && pnpm e2e
# Quality: pnpm lint && pnpm typecheck
```

## Key Technical Decisions

1. **Server Actions over RTK Query for GitHub API** - HTTP-only cookies store OAuth tokens; only server-side code can access them securely
2. **Redux over useReducer** - Enforced via ESLint rule for consistent state management patterns
3. **@dnd-kit over alternatives** - Accessibility-first, keyboard navigation, works with virtualization
4. **MSW for testing only** - Never enabled in development/production; test isolation pattern
5. **Workspace monorepo** - `@gitbox/redux-storage-middleware` as local package

---

_Document standards and patterns, not every dependency_
