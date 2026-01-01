# GitBox

[![codecov](https://codecov.io/gh/laststance/gitbox/graph/badge.svg?token=4TKHCRY6A0)](https://codecov.io/gh/laststance/gitbox)
[![E2E Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/ryota-murakami/7782ae901e4ba955b064eadeeac72c45/raw/gitbox-e2e-coverage.json)](https://github.com/laststance/gitbox/actions/workflows/e2e.yml)
[![E2E Tests](https://github.com/laststance/gitbox/actions/workflows/e2e.yml/badge.svg)](https://github.com/laststance/gitbox/actions/workflows/e2e.yml)
[![Build](https://github.com/laststance/gitbox/actions/workflows/build.yml/badge.svg)](https://github.com/laststance/gitbox/actions/workflows/build.yml)
[![Test](https://github.com/laststance/gitbox/actions/workflows/test.yml/badge.svg)](https://github.com/laststance/gitbox/actions/workflows/test.yml)

GitBox is a wep app for managing GitHub repositories in a Kanban-style board.

- Live app: https://gitbox-laststance.vercel.app
- Repository: https://github.com/laststance/gitbox
- Issues: https://github.com/laststance/gitbox/issues

## Brand Image

![GitBox metallic hero image](./public/screenshots/hero-metallic.svg)

> The image above is a brand-focused concept image, not an in-app screenshot.

## Features

- Kanban boards for GitHub repositories
- Drag-and-drop organization
- GitHub OAuth-based access
- Supabase-backed persistence
- PWA-friendly experience

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS, shadcn/ui
- **State**: Redux Toolkit
- **Database**: Supabase
- **Drag & Drop**: @dnd-kit
- **Testing**: Playwright (E2E), Vitest (Unit)

## Getting Started

### Prerequisites

- Node.js 24.12.0 (Volta recommended)
- pnpm 10.26.2

### Setup

```bash
pnpm install
cp .env.local.example .env
```

Fill in the values in `.env` with your configuration.

### Environment Variables

| Variable                        | Required | Description                                            |
| ------------------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅       | Supabase project URL                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅       | Supabase anonymous key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅       | Supabase service role key (server-only)                |
| `GITHUB_CLIENT_ID`              | ✅       | GitHub OAuth App client ID                             |
| `GITHUB_CLIENT_SECRET`          | ✅       | GitHub OAuth App client secret                         |
| `NEXT_PUBLIC_SITE_URL`          | ✅       | Site URL for OAuth callbacks                           |
| `SENTRY_AUTH_TOKEN`             | ❌       | Sentry authentication token (optional)                 |
| `APP_ENV`                       | ❌       | Environment mode (`development`, `test`, `production`) |
| `NEXT_PUBLIC_ENABLE_MSW_MOCK`   | ❌       | Enable MSW mocking for tests                           |

**Vercel Environment Variables:**

When deploying to Vercel, the following are auto-injected:

- `VERCEL_ENV` - Current deployment environment
- `VERCEL_URL` - Deployment URL

Start the dev server:

```bash
pnpm dev
```

Open `http://localhost:3008` in your browser.

## Scripts

- `pnpm dev` - Start dev server
- `pnpm build` - Production build
- `pnpm start` - Start production server
- `pnpm lint` - Lint
- `pnpm typecheck` - TypeScript type check
- `pnpm test` - Unit tests
- `pnpm e2e` - E2E tests

## Security

See `SECURITY.md`.

## License

MIT. See `LICENSE`.
