# Tasks: Vibe Rush - GitHub Repository Manager

**Input**: Design documents from `/specs/001-github-repo-manager/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/README.md ✓, quickstart.md ✓

**Tests**: Tests are required.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US#]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure (Next.js App Router monorepo with pnpm workspaces):
- App Router: `app/[locale]/`
- Components: `components/`
- Libraries: `lib/`
- Tests: `tests/e2e/`, `tests/unit/`
- Styles: `styles/`
- Supabase: `supabase/`
- Redux package: `packages/redux-storage-middleware/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan (Next.js App Router monorepo)
- [ ] T002 Initialize Next.js 16 project with TypeScript 5.x configuration
- [ ] T003 [P] Configure pnpm workspaces for redux-storage-middleware package
- [ ] T004 [P] Install core dependencies (React 19, Redux Toolkit, Supabase Client, next-intl)
- [ ] T005 [P] Configure ESLint v9 with eslint-config-ts-prefixer and @laststance/react-next-eslint-plugin
- [ ] T006 [P] Setup prettier-husky-lint-staged for code formatting
- [ ] T007 [P] Configure next.config.js for PWA support and next-intl
- [ ] T008 [P] Create .env.local template with Supabase and GitHub OAuth variables
- [ ] T009 Setup Docker Compose configuration for local Supabase in supabase/docker-compose.yml
- [ ] T010 [P] Initialize Storybook v10 configuration in .storybook/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T011 Create Supabase database schema migrations in supabase/migrations/20251115_initial_schema.sql
- [ ] T012 Setup Row Level Security (RLS) policies for all tables
- [ ] T013 Create database functions and triggers (updated_at, default_board)
- [ ] T014 Generate Supabase TypeScript types in lib/supabase/types.ts
- [ ] T015 [P] Setup Supabase client configuration in lib/supabase/client.ts
- [ ] T016 [P] Setup Supabase server client (@supabase/ssr) in lib/supabase/server.ts
- [ ] T017 [P] Configure Redux Toolkit store in lib/redux/store.ts
- [ ] T018 [P] Create base Redux slices (authSlice, boardSlice, settingsSlice) in lib/redux/slices/
- [ ] T019 [P] Implement custom redux-storage-middleware in packages/redux-storage-middleware/src/
- [ ] T020 [P] Setup next-intl i18n configuration in lib/i18n/config.ts
- [ ] T021 [P] Create message files (en.json, ja.json) in lib/i18n/messages/
- [ ] T022 [P] Configure RTK Query for GitHub API in lib/github/api.ts
- [ ] T023 [P] Setup global CSS and theme variables in styles/globals.css
- [ ] T024 [P] Create 12 theme files in styles/themes/ (6 light, 6 dark)
- [ ] T025 Setup app router layout structure in app/[locale]/layout.tsx
- [ ] T026 Create middleware.ts for authentication and locale routing
- [ ] T027 [P] Configure Playwright for E2E testing in playwright.config.ts
- [ ] T028 [P] Configure Vitest for unit testing in vitest.config.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - GitHub ログイン (Priority: P1) 🎯 MVP

**Goal**: GitHub OAuth認証でログインし、Boards画面にアクセス可能にする

**Independent Test**: GitHub OAuth フローを実行し、認証後に Boards 画面に遷移することで完全にテスト可能

### Tests for User Story 1 (OPTIONAL) ⚠️

- [ ] T029 [P] [US1] E2E test for GitHub OAuth login flow in tests/e2e/auth.spec.ts
- [ ] T030 [P] [US1] Unit test for auth state management in tests/unit/lib/redux/authSlice.test.ts
- [ ] T141 [P] [US1] Capture browser screenshots of login flow with Playwright in tests/e2e/screenshots/us1-login.spec.ts

### Implementation for User Story 1

- [ ] T031 [P] [US1] Create landing page with "Sign in with GitHub" button in app/[locale]/(auth)/login/page.tsx
- [ ] T032 [P] [US1] Implement OAuth callback handler in app/[locale]/auth/callback/route.ts
- [ ] T033 [P] [US1] Create auth actions in lib/actions/auth.ts (Server Actions)
- [ ] T034 [US1] Implement auth middleware for protected routes in middleware.ts
- [ ] T035 [US1] Create boards list page (post-login home) in app/[locale]/(app)/boards/page.tsx
- [ ] T036 [P] [US1] Add error handling for auth failures with user-friendly messages
- [ ] T037 [P] [US1] Implement session management with Supabase Auth helpers

**Checkpoint**: User Story 1 complete - users can login with GitHub

---

## Phase 4: User Story 2 - Repository 検索と追加 (Priority: P1)

**Goal**: GitHub Repositoryを検索してKanbanボードに追加する

**Independent Test**: Comboboxで検索し、複数Repositoryを選択して追加、"Quick note"にフォーカス移動

### Tests for User Story 2 (OPTIONAL) ⚠️

- [ ] T038 [P] [US2] E2E test for repository search and add in tests/e2e/board.spec.ts
- [ ] T039 [P] [US2] Unit test for search performance (100+ repos) in tests/unit/components/AddRepositoryCombobox.test.tsx
- [ ] T142 [P] [US2] Capture browser screenshots of repository search and add flow with Playwright in tests/e2e/screenshots/us2-repo-search.spec.ts

### Implementation for User Story 2

- [ ] T040 [P] [US2] Create AddRepositoryCombobox component (Magic MCP) in components/Board/AddRepositoryCombobox.tsx
- [ ] T041 [P] [US2] Implement GitHub repository search with RTK Query hooks
- [ ] T042 [US2] Create RepoCard entity operations in lib/actions/repo-cards.ts
- [ ] T043 [US2] Implement duplicate repository detection logic
- [ ] T044 [P] [US2] Add search filters (owner/repo, topics, visibility)
- [ ] T045 [P] [US2] Implement virtual scrolling for 100+ repository lists
- [ ] T046 [US2] Add auto-focus to "Quick note" field after repository addition
- [ ] T047 [P] [US2] Create loading states and error handling for search

**Checkpoint**: User Story 2 complete - repositories can be searched and added

---

## Phase 5: User Story 3 - Kanbanボードで Repository 管理 (Priority: P1)

**Goal**: ドラッグ&ドロップでRepository状態と優先度を視覚的に管理

**Independent Test**: カードをドラッグ&ドロップして列間移動（Status変更）と列内順序変更（優先度変更）

### Tests for User Story 3 (OPTIONAL) ⚠️

- [ ] T048 [P] [US3] E2E test for drag & drop operations in tests/e2e/board.spec.ts
- [ ] T049 [P] [US3] Unit test for undo functionality in tests/unit/components/KanbanBoard.test.tsx
- [ ] T143 [P] [US3] Capture browser screenshots of Kanban board drag & drop operations with Playwright in tests/e2e/screenshots/us3-kanban-board.spec.ts

### Implementation for User Story 3

- [ ] T050 [P] [US3] Create KanbanBoard component (Magic MCP) in components/Board/KanbanBoard.tsx
- [ ] T051 [P] [US3] Create StatusColumn component in components/Board/StatusColumn.tsx
- [ ] T052 [P] [US3] Create RepoCard component in components/Board/RepoCard.tsx
- [ ] T053 [P] [US3] Create OverflowMenu component in components/Board/OverflowMenu.tsx
- [ ] T054 [US3] Implement drag & drop with react-beautiful-dnd or @dnd-kit
- [ ] T055 [US3] Create board page with dynamic routing in app/[locale]/(app)/board/[id]/page.tsx
- [ ] T056 [P] [US3] Implement WIP limit validation and warnings
- [ ] T057 [P] [US3] Add optimistic UI updates for drag operations (<100ms response)
- [ ] T058 [US3] Implement undo functionality (Z key) for last drag operation
- [ ] T059 [P] [US3] Create keyboard navigation support (Tab, Enter, . for menu)
- [ ] T060 [P] [US3] Add board state persistence to Redux and LocalStorage

**Checkpoint**: User Story 3 complete - full Kanban board functionality

---

## Phase 6: User Story 4 - Project Info でメモとリンクを管理 (Priority: P1)

**Goal**: 各Repositoryに一言メモ、本番URL、ダッシュボードURLを記録

**Independent Test**: Project Infoモーダルで Quick note と Links を編集・保存

### Tests for User Story 4 (OPTIONAL) ⚠️

- [ ] T061 [P] [US4] E2E test for Project Info modal in tests/e2e/project-info.spec.ts
- [ ] T062 [P] [US4] Unit test for link validation in tests/unit/components/ProjectInfoModal.test.tsx
- [ ] T144 [P] [US4] Capture browser screenshots of Project Info modal with Playwright in tests/e2e/screenshots/us4-project-info.spec.ts

### Implementation for User Story 4

- [ ] T063 [P] [US4] Create ProjectInfoModal component (Magic MCP) in components/Modals/ProjectInfoModal.tsx
- [ ] T064 [P] [US4] Implement ProjectInfo CRUD operations in lib/actions/project-info.ts
- [ ] T065 [US4] Add "Edit Project Info" action to OverflowMenu
- [ ] T066 [P] [US4] Create Quick note section with 300 character limit
- [ ] T067 [P] [US4] Implement Links section for multiple URL types
- [ ] T068 [P] [US4] Add URL validation and formatting
- [ ] T069 [US4] Implement save/cancel functionality with optimistic updates
- [ ] T070 [P] [US4] Add keyboard shortcuts for modal (Escape to close)

**Checkpoint**: User Story 4 complete - Project Info management functional

---

## Phase 7: User Story 5 - 機密情報を安全に管理 (Priority: P2)

**Goal**: OAuth Secret や API Key を3パターン（参照、暗号化、外部）で安全管理

**Independent Test**: Credentialsセクションで3つの管理パターンを使用して機密情報を管理

### Tests for User Story 5 (OPTIONAL) ⚠️

- [ ] T071 [P] [US5] E2E test for credentials management in tests/e2e/project-info.spec.ts
- [ ] T072 [P] [US5] Security test for encryption/decryption in tests/unit/lib/encryption.test.ts
- [ ] T145 [P] [US5] Capture browser screenshots of credentials management flow with Playwright in tests/e2e/screenshots/us5-credentials.spec.ts

### Implementation for User Story 5

- [ ] T073 [US5] Create Credentials section in ProjectInfoModal
- [ ] T074 [P] [US5] Implement Pattern A: Reference links (dashboard URLs only)
- [ ] T075 [P] [US5] Implement Pattern B: Encrypted storage with AES-256-GCM
- [ ] T076 [P] [US5] Implement Pattern C: External management (1Password/Bitwarden)
- [ ] T077 [US5] Create Supabase Edge Function for encryption/decryption
- [ ] T078 [P] [US5] Implement masked display (e.g., github_*****xyz789)
- [ ] T079 [P] [US5] Add "Reveal" button with 30-second auto-mask timer
- [ ] T080 [US5] Implement audit logging for all credential access
- [ ] T081 [P] [US5] Create copy-to-clipboard functionality

**Checkpoint**: User Story 5 complete - secure credential management

---

## Phase 8: User Story 6 - Maintenance Mode で完了プロジェクトを整理 (Priority: P2)

**Goal**: 完了・保守中プロジェクトを別の場所に整理してアクティブなプロジェクトに集中

**Independent Test**: Maintenance Modeで完了プロジェクトをGrid/List表示で参照・復元

### Tests for User Story 6 (OPTIONAL) ⚠️

- [ ] T083 [P] [US6] E2E test for Maintenance Mode in tests/e2e/maintenance.spec.ts
- [ ] T084 [P] [US6] Unit test for Grid/List view toggle in tests/unit/components/Maintenance.test.tsx
- [ ] T146 [P] [US6] Capture browser screenshots of Maintenance Mode (Grid/List views) with Playwright in tests/e2e/screenshots/us6-maintenance.spec.ts

### Implementation for User Story 6

- [ ] T085 [P] [US6] Create Maintenance Mode page in app/[locale]/(app)/maintenance/page.tsx
- [ ] T086 [P] [US6] Create GridView component (Magic MCP) in components/Maintenance/GridView.tsx
- [ ] T087 [P] [US6] Create ListView component (Magic MCP) in components/Maintenance/ListView.tsx
- [ ] T088 [US6] Add "Move to Maintenance" action to OverflowMenu
- [ ] T089 [US6] Implement "Restore to Board" functionality
- [ ] T090 [P] [US6] Add instant Grid/List view toggle (no loading state)
- [ ] T091 [P] [US6] Implement search/filter for archived projects
- [ ] T092 [P] [US6] Add sorting options (updated date, stars, name)
- [ ] T093 [US6] Create Sidebar navigation link to Maintenance Mode
- [ ] T094 [P] [US6] Add hide/unhide functionality for maintenance items

**Checkpoint**: User Story 6 complete - Maintenance Mode functional

---

## Phase 9: User Story 7 - テーマをカスタマイズ (Priority: P3)

**Goal**: 12種類のテーマから好みの配色を選択して快適に作業

**Independent Test**: Settings画面で12テーマを選択、プレビュー、適用

### Tests for User Story 7 (OPTIONAL) ⚠️

- [ ] T095 [P] [US7] E2E test for theme switching in tests/e2e/theme.spec.ts
- [ ] T096 [P] [US7] Accessibility test for WCAG AA compliance in tests/e2e/accessibility.spec.ts
- [ ] T147 [P] [US7] Capture browser screenshots of all 12 theme variations with Playwright in tests/e2e/screenshots/us7-themes.spec.ts

### Implementation for User Story 7

- [ ] T097 [P] [US7] Create Settings page in app/[locale]/(app)/settings/page.tsx
- [ ] T098 [P] [US7] Create ThemeSelector component (Magic MCP) in components/Theme/ThemeSelector.tsx
- [ ] T099 [US7] Implement theme preview functionality
- [ ] T100 [P] [US7] Add WCAG AA contrast validation (4.5:1 text, 3:1 UI)
- [ ] T101 [P] [US7] Create theme application logic with CSS variables
- [ ] T102 [US7] Implement theme persistence to LocalStorage
- [ ] T103 [P] [US7] Add build-time contrast validation (fail on violation)
- [ ] T104 [P] [US7] Create typography settings (base size, scale)
- [ ] T105 [US7] Add theme to Redux settingsSlice
- [ ] T106 [P] [US7] Implement instant theme switching (no reload)

**Checkpoint**: User Story 7 complete - full theme customization

---

## Phase 10: User Story 8 - PWA としてインストール (Priority: P3)

**Goal**: PWAとしてインストールしてネイティブアプリのように使用

**Independent Test**: ブラウザからインストール、スタンドアロンで起動、オフライン動作

### Tests for User Story 8 (OPTIONAL) ⚠️

- [ ] T107 [P] [US8] E2E test for PWA installation in tests/e2e/pwa.spec.ts
- [ ] T108 [P] [US8] Unit test for offline functionality in tests/unit/lib/offline.test.ts
- [ ] T148 [P] [US8] Capture browser screenshots of PWA installation flow and standalone mode with Playwright in tests/e2e/screenshots/us8-pwa.spec.ts

### Implementation for User Story 8

- [ ] T109 [P] [US8] Create manifest.json with PWA configuration in public/
- [ ] T110 [P] [US8] Implement service worker in public/sw.js
- [ ] T111 [US8] Configure next-pwa plugin in next.config.js
- [ ] T112 [P] [US8] Add install prompt UI component
- [ ] T113 [P] [US8] Implement offline data caching strategy
- [ ] T114 [P] [US8] Create app icons (multiple sizes) in public/icons/
- [ ] T115 [US8] Add offline fallback pages
- [ ] T116 [P] [US8] Implement background sync for offline changes
- [ ] T117 [P] [US8] Add push notification support (optional)
- [ ] T118 [US8] Configure standalone display mode

**Checkpoint**: User Story 8 complete - full PWA support

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T119 [P] Create AppSidebar component (Magic MCP) in components/Sidebar/AppSidebar.tsx
- [ ] T120 [P] Create CommandPalette component (⌘K) in components/Modals/CommandPalette.tsx
- [ ] T121 [P] Create ShortcutsHelp modal (?) in components/Modals/ShortcutsHelp.tsx
- [ ] T122 [P] Implement global keyboard shortcuts (Z for undo, ⌘K, ?)
- [ ] T123 Code cleanup and refactoring across all components
- [ ] T124 [P] Performance optimization for 100+ repository scenarios
- [ ] T125 [P] Add comprehensive error boundaries
- [ ] T126 [P] Implement loading skeletons for all async operations
- [ ] T127 [P] Add analytics tracking (Plausible/PostHog)
- [ ] T128 Security hardening (CSP headers, input sanitization)
- [ ] T129 [P] Create component documentation in Storybook
- [ ] T130 Run quickstart.md validation for developer onboarding

---

## Phase 12: Constitution Compliance Verification

**Purpose**: Ensure all constitution requirements are met before deployment

- [ ] T131 [P] Browser verification with Playwright (capture screenshots for all screens)
- [ ] T132 [P] E2E tests for all 8 user stories passing
- [ ] T133 [P] All components have clear docstrings (Japanese for business logic)
- [ ] T134 [P] WCAG AA contrast validation for all 12 themes
- [ ] T135 [P] Security verification (audit logs, AES-256-GCM encryption)
- [ ] T136 [P] User setup guide complete (quickstart.md validated)
- [ ] T137 Performance benchmarks met (100+ repos <1s, drag <100ms, undo <200ms)
- [ ] T138 Internationalization verified (English/Japanese complete)
- [ ] T139 [P] Japanese-first verification (docs, comments, commits in Japanese)
- [ ] T140 PWA installation and offline functionality verified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational phase completion
  - US1-US4 (P1): Can proceed in parallel after Foundation
  - US5-US6 (P2): Can proceed in parallel after Foundation
  - US7-US8 (P3): Can proceed in parallel after Foundation
- **Polish (Phase 11)**: Depends on desired user stories being complete
- **Compliance (Phase 12)**: Final verification after all implementation

### User Story Dependencies

- **User Story 1 (GitHub Login)**: Foundation only - enables all other stories
- **User Story 2 (Repository Search)**: Foundation only - independent
- **User Story 3 (Kanban Board)**: Foundation only - independent
- **User Story 4 (Project Info)**: Foundation only - independent
- **User Story 5 (Credentials)**: Foundation + US4 (extends Project Info)
- **User Story 6 (Maintenance)**: Foundation only - independent
- **User Story 7 (Themes)**: Foundation only - independent
- **User Story 8 (PWA)**: Foundation only - independent

### Within Each User Story

1. Tests first (if implementing TDD)
2. Models/entities before services
3. Services before UI components
4. Core implementation before integration
5. Story validation before next priority

### Parallel Opportunities

**Phase 1 (Setup)**: T003-T010 can run in parallel (8 tasks)
**Phase 2 (Foundational)**: T015-T028 marked [P] can run in parallel (14 tasks)
**User Stories**: All P1 stories (US1-4) can start simultaneously after Foundation
**Within Stories**: All tasks marked [P] can execute in parallel

---

## Parallel Example: User Story 3 (Kanban Board)

```bash
# Launch all component creation together:
Task T050: "Create KanbanBoard component"
Task T051: "Create StatusColumn component"
Task T052: "Create RepoCard component"
Task T053: "Create OverflowMenu component"

# After drag-drop implementation, launch optimizations together:
Task T056: "Implement WIP limit validation"
Task T057: "Add optimistic UI updates"
Task T059: "Create keyboard navigation"
Task T060: "Add board state persistence"
```

---

## Implementation Strategy

### MVP First (User Story 1-3 Only)

1. Complete Phase 1: Setup (~2-3 hours)
2. Complete Phase 2: Foundational (~4-6 hours) - CRITICAL
3. Complete Phase 3-5: US1-3 (~6-8 hours)
4. **STOP and VALIDATE**: Core Kanban functionality working
5. Deploy/demo MVP

### Incremental Delivery

1. Foundation → Test infrastructure
2. +US1 (Login) → Users can authenticate
3. +US2 (Search) → Users can add repositories
4. +US3 (Kanban) → Full board management (MVP!)
5. +US4 (Project Info) → Enhanced repository details
6. +US5-6 → Security and organization features
7. +US7-8 → UX enhancements

### Parallel Team Strategy

With 3 developers after Foundation:
- **Developer A**: US1 (Login) + US3 (Kanban)
- **Developer B**: US2 (Search) + US4 (Project Info)
- **Developer C**: US5 (Credentials) + US6 (Maintenance)
- **All**: US7-8 and Polish phase together

---

## Task Summary

- **Total Tasks**: 148
- **Setup Phase**: 10 tasks
- **Foundational Phase**: 18 tasks (BLOCKS all stories)
- **User Story Tasks**: 98 tasks
  - US1 (Login): 10 tasks (includes browser screenshot)
  - US2 (Search): 11 tasks (includes browser screenshot)
  - US3 (Kanban): 14 tasks (includes browser screenshot)
  - US4 (Project Info): 11 tasks (includes browser screenshot)
  - US5 (Credentials): 13 tasks (includes browser screenshot)
  - US6 (Maintenance): 13 tasks (includes browser screenshot)
  - US7 (Themes): 13 tasks (includes browser screenshot)
  - US8 (PWA): 13 tasks (includes browser screenshot)
- **Polish Phase**: 12 tasks
- **Compliance Phase**: 10 tasks

**Parallel Opportunities**:
- ~60% of tasks can run in parallel (marked with [P])
- All 8 user stories can be developed simultaneously after Foundation
- Estimated 40-50% time reduction with parallel execution

**MVP Scope (P1 stories only)**:
- 28 Foundation tasks + 46 P1 story tasks = 74 tasks for MVP (includes browser screenshots)
- Estimated completion: 2-3 days with single developer, 1-2 days with team

---

## Notes

- All tasks follow strict format: `- [ ] T### [P?] [US#?] Description with file path`
- Tests marked with ⚠️ are optional unless TDD is explicitly requested
- Magic MCP should be used for all UI component generation
- Japanese comments for business logic, English for technical APIs
- Each user story is independently testable and deployable
- Commit after each task or logical group
- Validate at each checkpoint