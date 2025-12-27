# GitBox

[![E2E Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/ryota-murakami/7782ae901e4ba955b064eadeeac72c45/raw/gitbox-e2e-coverage.json)](https://github.com/laststance/gitbox/actions/workflows/e2e.yml)
[![E2E Tests](https://github.com/laststance/gitbox/actions/workflows/e2e.yml/badge.svg)](https://github.com/laststance/gitbox/actions/workflows/e2e.yml)
[![Build](https://github.com/laststance/gitbox/actions/workflows/build.yml/badge.svg)](https://github.com/laststance/gitbox/actions/workflows/build.yml)
[![Test](https://github.com/laststance/gitbox/actions/workflows/test.yml/badge.svg)](https://github.com/laststance/gitbox/actions/workflows/test.yml)

PWA for managing GitHub repositories in Kanban format.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS, shadcn/ui
- **State**: Redux Toolkit
- **Database**: Supabase
- **Drag & Drop**: @dnd-kit
- **Testing**: Playwright (E2E), Vitest (Unit)

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3008
pnpm test       # Unit tests
pnpm e2e        # E2E tests
```

## License

MIT
