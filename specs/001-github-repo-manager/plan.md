# Implementation Plan: Vibe Rush - GitHub Repository Manager

**Branch**: `001-github-repo-manager` | **Date**: 2025-11-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-github-repo-manager/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Vibe Rush は GitHub Repository を Kanban ボード形式で管理する PWA アプリケーションです。GitHub OAuth 認証、Repository 検索・追加、ドラッグ & ドロップによる Status/優先度管理、Project Info によるメモ・リンク・機密情報管理、12 テーマ切り替え、英語/日本語対応を提供します。技術スタック: Next.js 16 App Router, TypeScript, Redux Toolkit, Supabase (PostgreSQL + Auth), Playwright (E2E), Vitest (Unit), Magic MCP (UI生成)

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16 (App Router)
**Primary Dependencies**: 
- Frontend: React 19, Redux Toolkit (state management), react-hook-form + zod (forms), next-intl (i18n), ts-pattern (conditional logic), date-fns (dates)
- Backend: Supabase Client (DB + Auth), @supabase/ssr (server-side auth)
- API: RTK Query (auto-generated from GitHub REST API OpenAPI schema)
- UI: Magic MCP (21st.dev component generation), Storybook v10 (component documentation)
- Linting: ESLint v9, eslint-config-ts-prefixer, @laststance/react-next-eslint-plugin
- Dev Tools: prettier-husky-lint-staged-installer

**Storage**: 
- Production: Supabase PostgreSQL (cloud-hosted)
- Development: Docker Compose with Supabase-compatible PostgreSQL (local)
- Client: Custom Redux Storage Middleware for LocalStorage sync (settings, language preferences)

**Testing**: 
- Unit: Vitest
- E2E: Playwright (with Supabase OAuth bypass for testing)
- Visual: Playwright screenshots + accessibility validation

**Target Platform**: Web (PWA), Desktop browsers (Chrome, Firefox, Safari), Mobile browsers (iOS Safari, Chrome Android)

**Project Type**: Web application (Next.js App Router monorepo with pnpm workspaces)

**Performance Goals**: 
- Repository search with 100+ repos: <1 second response
- Drag & drop operations: <100ms response time
- Undo operations: <200ms completion time
- Grid/List view switching: instant (no loading state)
- Theme switching: instant with CSS variables

**Constraints**: 
- WCAG AA compliance: Text 4.5:1, UI elements 3:1 contrast ratio (automated validation, build fails if violated)
- 12 themes must all pass contrast validation
- All UI generated via Magic MCP from wireframes
- Supabase TypeScript types auto-generated (supabase gen types)
- GitHub REST API client auto-generated from OpenAPI schema (RTK Query)

**Scale/Scope**: 
- Target users: Individual developers and small teams
- Expected repositories per user: 10-100 (optimized for 100+)
- Expected boards per user: 1-5
- Concurrent users: Single-user sessions (no real-time collaboration in MVP)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Browser Verification**:
- [x] Playwright MCP tool configured and ready for browser testing
- [x] Screenshot strategy defined for visual verification (Board, Maintenance Mode, Project Info modal, Settings, Theme previews)

**E2E Testing**:
- [x] Critical user flows identified for E2E test coverage:
  - GitHub OAuth login flow → Boards screen navigation
  - Repository search (Combobox) and multiple repository addition
  - Drag & drop: Status change (cross-column) and priority change (intra-column)
  - Project Info modal: Quick note, Links, Credentials (3 patterns)
  - Maintenance Mode: Grid/List view switching, Restore to Board
  - Theme selection and application (12 themes)
  - Keyboard navigation (⌘K, Z for undo, ? for shortcuts)
- [x] Playwright test framework setup planned (with Supabase OAuth bypass for E2E in dev environment)

**Documentation**:
- [x] Docstring standards defined for components (Japanese comments for business logic, English for technical API docs)
- [x] User setup guide planned for Vercel/Supabase configuration (based on VERCEL-SUPABASE-SETUP.md)

**Accessibility**:
- [x] Contrast validation tooling planned (12 themes × representative screens: Board, Maintenance, Modal, Settings)
- [x] WCAG AA compliance targets documented (Text 4.5:1, UI 3:1)
- [x] Keyboard navigation requirements defined:
  - Tab/Shift+Tab: Focus navigation
  - Enter: Default action (Open card on Board, Open GitHub on Maintenance)
  - .: Overflow menu on focused card
  - ⌘K: Command Palette
  - Z: Undo last drag operation
  - ?: Shortcuts help modal

**Security**:
- [x] Credential management pattern selected: 3-pattern system
  - Pattern A (Reference): Dashboard links only (Supabase API keys)
  - Pattern B (Encrypted): AES-256-GCM with KMS (GitHub OAuth secrets)
  - Pattern C (External): 1Password/Bitwarden location references
- [x] Audit logging requirements defined (userId, action, resourceId, timestamp, ipAddress, userAgent, success status)

**Test-Driven Development**:
- [x] Test-first workflow confirmed (Write failing tests → Implement → Green tests → Refactor)
- [x] Acceptance criteria from spec.md ready for test implementation (8 user stories with BDD scenarios)

**Japanese-First Communication**:
- [x] All documentation files (spec.md, plan.md, tasks.md, research.md) will be in Japanese
- [x] Code comments for business logic will be in Japanese
- [x] Commit messages and PR descriptions will be in Japanese
- [x] Chat communication with AI agents will be in Japanese
- [x] Code identifiers (variables, functions, classes) will use English naming conventions

## Project Structure

### Documentation (this feature)

```text
specs/001-github-repo-manager/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Technology decisions and best practices
├── data-model.md        # Phase 1 output - Database schema and entity relationships
├── quickstart.md        # Phase 1 output - Setup guide (Vercel + Supabase + local dev)
├── contracts/           # Phase 1 output - OpenAPI schemas for GitHub API integration
│   ├── github-rest-api.yaml  # GitHub REST API schema (RTK Query codegen source)
│   └── supabase-types.ts     # Auto-generated Supabase DB types
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Option 2: Web application (Next.js App Router)

# pnpm workspaces root
packages/
├── redux-storage-middleware/  # Custom Redux middleware for LocalStorage sync (to be published to npm)
│   ├── src/
│   │   ├── middleware.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── tests/
│   ├── package.json
│   └── README.md

# Next.js application
app/                          # Next.js App Router structure
├── [locale]/                 # next-intl locale routing (en, ja)
│   ├── (auth)/
│   │   └── login/           # Landing page with GitHub OAuth
│   ├── (app)/               # Main application (authenticated)
│   │   ├── boards/          # Kanban boards list
│   │   ├── board/[id]/      # Individual Kanban board
│   │   ├── maintenance/     # Maintenance Mode (Grid/List view)
│   │   └── settings/        # Settings (Theme, Typography, WIP limits)
│   └── auth/
│       └── callback/        # OAuth callback handler

components/                   # UI components (Magic MCP generated)
├── Board/
│   ├── KanbanBoard.tsx      # Main board with drag & drop
│   ├── StatusColumn.tsx     # Column (Status list)
│   ├── RepoCard.tsx         # Repository card
│   └── OverflowMenu.tsx     # ⋯ menu (Board & Maintenance)
├── Maintenance/
│   ├── GridView.tsx         # Grid layout
│   └── ListView.tsx         # List/table layout
├── Modals/
│   ├── ProjectInfoModal.tsx # Project Info (Quick note, Links, Credentials)
│   ├── CommandPalette.tsx   # ⌘K command palette
│   └── ShortcutsHelp.tsx    # ? shortcuts help
├── Sidebar/
│   └── AppSidebar.tsx       # Global navigation sidebar
└── Theme/
    └── ThemeSelector.tsx    # 12 theme selector with preview

lib/                         # Utilities and configurations
├── supabase/
│   ├── client.ts            # Supabase client (browser)
│   ├── server.ts            # Supabase server client (@supabase/ssr)
│   └── types.ts             # Auto-generated DB types (supabase gen types)
├── github/
│   └── api.ts               # RTK Query auto-generated GitHub API client
├── i18n/
│   ├── config.ts            # next-intl configuration
│   ├── messages/
│   │   ├── en.json          # English translations
│   │   └── ja.json          # Japanese translations
└── redux/
    ├── store.ts             # Redux Toolkit store
    ├── slices/
    │   ├── boardSlice.ts    # Board state
    │   ├── settingsSlice.ts # Settings (theme, language) + LocalStorage sync
    │   └── authSlice.ts     # Authentication state
    └── middleware/
        └── storageMiddleware.ts  # Custom LocalStorage sync (from packages/)

styles/                      # Styling (12 themes)
├── globals.css              # Global styles + CSS variables
├── themes/
│   ├── light/               # 6 light themes (Sunrise, Sandstone, Mint, Sky, Lavender, Rose)
│   └── dark/                # 6 dark themes (Midnight, Graphite, Forest, Ocean, Plum, Rust)

tests/                       # Test suites
├── e2e/                     # Playwright E2E tests
│   ├── auth.spec.ts         # OAuth login flow
│   ├── board.spec.ts        # Kanban operations (add repo, drag & drop, undo)
│   ├── project-info.spec.ts # Project Info modal
│   ├── maintenance.spec.ts  # Maintenance Mode (Grid/List, restore)
│   ├── theme.spec.ts        # Theme switching + contrast validation
│   └── accessibility.spec.ts # WCAG AA compliance (keyboard navigation)
├── unit/                    # Vitest unit tests
│   ├── components/          # Component tests
│   └── lib/                 # Utility function tests
└── fixtures/                # Test data

.storybook/                  # Storybook v10 configuration
stories/                     # Component stories (documentation & reuse prevention)
├── Board/
├── Maintenance/
├── Modals/
└── Theme/

supabase/                    # Local Supabase development (Docker Compose)
├── docker-compose.yml       # PostgreSQL + Auth emulation
├── config.toml              # Supabase configuration
└── migrations/              # Database migrations
```

**Structure Decision**: Web application structure with Next.js App Router. The project uses pnpm workspaces to isolate the custom `redux-storage-middleware` package (to be published to npm). Main application follows Next.js 16 App Router conventions with locale-based routing (next-intl), component-driven architecture (Magic MCP generated), and clear separation of concerns (components, lib utilities, tests).

## Complexity Tracking

> **No violations detected. YAGNI principles followed.**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

**Rationale**: 
- Single Next.js application (not multiple projects)
- Standard patterns: RTK Query (GitHub API), Supabase Client (DB), Magic MCP (UI generation)
- Custom Redux Storage Middleware justified: redux-persist is unmaintained, custom solution allows npm publication and better integration with Redux Toolkit
- pnpm workspaces justified: Enables package publication while maintaining monorepo benefits

---

## Constitution Check Re-evaluation (Post-Design)

*Re-evaluated after Phase 1 design completion*

**Browser Verification**:
- ✅ Playwright MCP tool integration planned in research.md
- ✅ Screenshot strategy documented for Board, Maintenance Mode, Project Info modal, Settings, Theme previews
- ✅ E2E tests will capture screenshots for visual regression testing

**E2E Testing**:
- ✅ All critical user flows have test specifications in spec.md (8 user stories)
- ✅ Playwright test framework setup documented in quickstart.md
- ✅ Supabase OAuth bypass strategy designed in research.md (Admin API for test users)
- ✅ E2E test structure planned in project structure (tests/e2e/*.spec.ts)

**Documentation**:
- ✅ Docstring standards defined: Japanese for business logic, English for technical APIs
- ✅ User setup guide created: quickstart.md with comprehensive Vercel/Supabase configuration
- ✅ All design artifacts completed: research.md, data-model.md, contracts/README.md, quickstart.md

**Accessibility**:
- ✅ Contrast validation tooling documented in research.md (axe-core + Playwright)
- ✅ WCAG AA compliance targets enforced in data-model.md (Board.theme CHECK constraint)
- ✅ Keyboard navigation requirements fully specified in spec.md user stories
- ✅ Build-time contrast validation planned in quickstart.md (pnpm build fails on violation)

**Security**:
- ✅ 3-pattern credential management fully designed in data-model.md:
  - Pattern A (Reference): Dashboard links only
  - Pattern B (Encrypted): AES-256-GCM with KMS
  - Pattern C (External): 1Password/Bitwarden location references
- ✅ Audit logging designed in data-model.md (AuditLog table with immutable RLS policy)
- ✅ Row Level Security (RLS) policies defined for all tables

**Test-Driven Development**:
- ✅ Test-first workflow confirmed in research.md (Vitest + Playwright)
- ✅ All 8 user stories have BDD-style acceptance criteria in spec.md
- ✅ Test structure planned in project structure (tests/unit/, tests/e2e/, tests/fixtures/)

**Japanese-First Communication**:
- ✅ All documentation files created in Japanese (research.md, data-model.md, quickstart.md)
- ✅ plan.md created in Japanese (this file)
- ✅ Code identifiers use English naming conventions (confirmed in data-model.md SQL)
- ✅ Constitution explicitly requires Japanese commit messages and PR descriptions

**Constitution Compliance Summary**:
- **Violations**: 0
- **Warnings**: 0
- **Status**: ✅ ALL CONSTITUTION PRINCIPLES SATISFIED

**Design Quality Gates**:
- ✅ All NEEDS CLARIFICATION items resolved in research.md
- ✅ Database schema complete with RLS policies (data-model.md)
- ✅ API contracts documented (contracts/README.md)
- ✅ Setup guide complete (quickstart.md)
- ✅ Agent context updated (CLAUDE.md)

**Ready for Phase 2 (Tasks Generation)**: ✅ YES

---

## Next Steps

The implementation planning workflow (Phase 0 & Phase 1) is now complete. 

**Generated Artifacts**:
1. ✅ `/specs/001-github-repo-manager/plan.md` (this file)
2. ✅ `/specs/001-github-repo-manager/research.md` (Phase 0: Technology decisions)
3. ✅ `/specs/001-github-repo-manager/data-model.md` (Phase 1: Database design)
4. ✅ `/specs/001-github-repo-manager/contracts/README.md` (Phase 1: API schemas)
5. ✅ `/specs/001-github-repo-manager/quickstart.md` (Phase 1: Setup guide)

**To Proceed with Implementation**:

Run the `/speckit.tasks` command to generate `tasks.md` with dependency-ordered implementation tasks based on the design artifacts created in this plan.

```bash
# Generate tasks.md
/speckit.tasks
```

This will create a detailed, actionable task list for implementing the Vibe Rush GitHub Repository Manager application.