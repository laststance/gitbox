# Project Structure

## Organization Philosophy

**Feature-first with shared utilities** - Routes organized by feature in `app/`, reusable components in `components/`, business logic in `lib/`.

## Directory Patterns

### App Router Pages

**Location**: `/app/`
**Purpose**: Route handlers and page components
**Pattern**: `[route]/page.tsx` for pages, `[route]/route.ts` for API endpoints

```
app/
├── page.tsx              # Landing page (/)
├── auth/callback/        # OAuth callback handler
├── boards/page.tsx       # Board list (/boards)
├── board/[id]/page.tsx   # Kanban board (/board/:id)
├── settings/             # Theme settings
└── maintenance/          # Archived projects
```

### Feature Components

**Location**: `/components/[Feature]/`
**Purpose**: Domain-specific components organized by feature
**Pattern**: PascalCase directories with index exports

```
components/
├── Board/          # Kanban board components (StatusList, RepoCard, etc.)
├── Boards/         # Board list and creation
├── Modals/         # Dialog components
├── Layout/         # App shell components
├── CommandPalette/ # ⌘K command interface
└── Sidebar/        # Navigation sidebar
```

### UI Primitives

**Location**: `/components/ui/`
**Purpose**: Design-system aligned primitives from shadcn/ui
**Pattern**: kebab-case files with Storybook stories

- No business logic in UI components
- Each component exports component + TypeScript types
- Story files co-located: `button.tsx` + `button.stories.tsx`

### Server Actions

**Location**: `/lib/actions/`
**Purpose**: Server-side data operations with Supabase
**Pattern**: Domain-grouped files with `'use server'` directive

```
lib/actions/
├── board.ts        # Board CRUD
├── repo-cards.ts   # RepoCard + drag operations
├── github.ts       # GitHub API (uses provider_token cookie)
├── project-info.ts # Notes, links, credentials
├── auth.ts         # Session management
└── audit-log.ts    # Security event logging
```

### State Management

**Location**: `/lib/redux/`
**Purpose**: Redux store and slice definitions
**Pattern**: Feature-based slices with typed hooks

```
lib/redux/
├── store.ts        # Store configuration + typed hooks
├── providers.tsx   # React provider wrapper
└── slices/         # Feature slices (authSlice, boardSlice, settingsSlice)
```

### Database

**Location**: `/supabase/migrations/`
**Purpose**: PostgreSQL schema changes
**Pattern**: Timestamped SQL migrations

## Naming Conventions

- **Files**: kebab-case for utilities, PascalCase for components
- **Components**: PascalCase (`RepoCard.tsx`, `StatusList.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAppDispatch`)
- **Server Actions**: camelCase verbs (`createBoard`, `moveCard`)

## Import Organization

```typescript
// 1. External packages
import { useState } from 'react'
import { useDispatch } from 'react-redux'

// 2. Absolute imports from project
import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/lib/redux/store'

// 3. Relative imports
import { CardDetails } from './CardDetails'
```

**Path Aliases**:

- `@/*`: Project root
- `@/components/*`: `/components`
- `@/lib/*`: `/lib`
- `@gitbox/*`: Workspace packages

## Code Organization Principles

1. **Colocation**: Tests and stories next to source files
2. **Server/Client boundary**: Server Actions in `/lib/actions/`, client state in `/lib/redux/`
3. **Encapsulation**: Feature folders export only public API
4. **No circular imports**: Shared utilities in `/lib/utils/`

---

_Document patterns, not file trees. New files following patterns shouldn't require updates_
