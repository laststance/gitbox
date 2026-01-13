# GitBox — Specification v1.0 (2026-01-13)

## 1) Product Overview

- **Language**: English
- **Landing Page**: Login/Sign-in buttons

### Navigation Flow

**Auth (GitHub OAuth)** → **Home (Boards)** → **Board (Kanban)** → **Card Detail (right panel)**

### Main Screens

- **Maintenance Mode** — Archived/maintenance projects storage (Sidebar link, Explorer UI)
- **Command Palette (⌘K)**
- **Settings** — Theme/Display/Typography
- **Shortcuts (?)**
- **Account** — Profile, statistics, account deletion
- **Privacy Policy** (`/privacy`) — GDPR-compliant privacy policy
- **Terms of Use** (`/terms`) — Terms of service

---

## 2) Design System

### 2.1 Color & Typography Guide

#### Color System

- **OKLCH-based** scale with aligned lightness (L) values
- **Dark/Light mirror mapping** for consistent contrast
- Reference: [Harmonizer](https://harmonizer.evilmartians.com/)

#### Contrast Requirements

- **Body text**: **4.5:1 or higher** (WCAG AA compliant)
- **UI components/icons**: **3:1 or higher**
- Reference: [W3C WCAG 2.1](https://www.w3.org/TR/WCAG21/)

#### Typography

- **Base font**: **16px**
- Step: 1px increments (minimum 12px to recommended 28px)
- Source of truth: Uploaded OKLCH palette (Tailwind tokens)

### 2.2 Design Tokens (14 Themes)

#### Token Set (Common Keys)

```
color.background         // Base layer
color.surface            // Card/panel
color.surfaceAlt         // Sub-surface (sidebar/toolbar)
color.border
color.overlay            // Modal/tooltip background

color.textPrimary
color.textSecondary
color.textMuted
color.focusRing

color.primary
color.primaryFg
color.secondary
color.secondaryFg
color.tertiary
color.tertiaryFg

color.success / warning / danger
```

#### Light Theme (Recommended OKLCH Range)

- background L≈0.98, surface L≈0.96, surfaceAlt L≈0.92
- textPrimary contrast **4.5:1+**, textSecondary **3:1+**
- primary/secondary/tertiary with saturation, **primaryFg** always AA compliant (auto black/white switch)

#### Dark Theme (Recommended OKLCH Range)

- background L≈0.12, surface L≈0.16, surfaceAlt L≈0.20
- textPrimary with **4.5:1+ contrast** via lightness difference
- primary with **elevated luminance** for button/selection visibility

#### Theme Names

- **Light:** Light / Sunrise / Sandstone / Mint / Sky / Lavender / Rose
- **Dark:** Dark / Midnight / Graphite / Forest / Ocean / Plum / Rust

---

## 3) Features

### 3.1 GitHub OAuth & Repository Addition

#### Specifications

- Combobox search (owner/repo, topics, visibility)
- Batch addition / duplicate detection
- **Organization Filter**: Filter repositories by user/org (persisted)
- **First Board auto-creation**: Auto-create "My First Board" on first login

#### Acceptance Criteria

- No delay displaying candidates with 100+ repos
- D&D/Undo works smoothly
- Organization selection persists across sessions

### 3.2 Board (Kanban)

#### Specifications

- **Column = Status** (e.g., Suspend / Spec designing / Active / Completed)
- Column CRUD operations (2D grid layout: gridRow, gridCol)
- **Card**: repo name, quick note, optional meta (Stars/Updated/Visibility/Language/Topics)
- **⋯ (Overflow menu)**: Launch **Project Info** modal
- **Favorites**: Add board to favorites (star icon, prioritized in sidebar)
- **Board Settings**: Board name, card display settings (theme is app-wide)

#### Acceptance Criteria

- Board = Status field basis
- D&D follows conventions ([GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/))
- Favorites toggle reflects immediately

### 3.3 Maintenance Mode

#### Specifications

- Navigate from Sidebar
- **Explorer UI** (Grid/List toggle, sort/search)
- **Click = Navigate to GitHub repo**
- **⋯ menu** on card top-right
- **Restore to Board** operation

#### UI Reference

List/Table/Sidebar UI HIG ([Apple Developer](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables))

### 3.4 Project Note (Rich Text Notes)

Full-featured WYSIWYG editor accessible from each RepoCard's Note button.

#### Specifications

- **Plate Editor**-based rich text editor
- **Fixed Toolbar**: Always-visible formatting toolbar (Bold, Italic, Headings, Lists, etc.)
- **Floating Toolbar**: Context toolbar on text selection
- **Slash Commands**: `/` input shows command menu (/h1, /code, /table, etc.)
- **Markdown Autoformat**: `# `→H1, `* `→bullet, `1. `→numbered, `> `→quote
- **Character count**: Maximum 20,000 characters, real-time display
- **Auto draft save**: Auto-save during editing (Redux + localStorage persistence)

#### Supported Formats

| Category   | Elements                                                       |
| ---------- | -------------------------------------------------------------- |
| **Block**  | Heading (H1-H3), Paragraph, Blockquote, Code Block, Table      |
| **List**   | Bullet List, Numbered List                                     |
| **Inline** | Bold, Italic, Underline, Strikethrough, Inline Code, Highlight |
| **Media**  | Link (URL embed)                                               |

#### Data Format

- **Storage format**: JSON (Slate format)
- **Legacy support**: Auto-migration from plain text
- **Character calculation**: Extract text from JSON and count

#### Acceptance Criteria

- Keyboard shortcuts work (Cmd+B=Bold, Cmd+I=Italic)
- Slash commands insert blocks
- Markdown autoformat converts correctly
- Format preserved after save and reopen
- Data persists after page refresh

### 3.5 Project Info (Modal)

Accessible from all RepoCards.

#### Sections

1. **Comment** (inline comment, max 2,000 chars. Displayed on RepoCard. See 3.6)

2. **Links** (55 built-in link types + custom presets)
   - **Built-in Types**: 55 link types in 12 categories
     - Development (GitHub, GitLab, Bitbucket, etc.)
     - Deployment (Vercel, Netlify, AWS, etc.)
     - Database (Supabase, MongoDB, Firebase, etc.)
     - Monitoring (Sentry, DataDog, etc.)
     - Documentation (Notion, Confluence, etc.)
     - Analytics (Google Analytics, Mixpanel, etc.)
     - Communication (Slack, Discord, etc.)
     - Others
   - **Custom Presets**: User-defined link types (Lucide icon selection)
   - **EditableUrlItem UI**: Inline editing component
     - **Single-Edit Coordination**: Only one URL editable at a time (others auto-save)
     - **URL Validation**: Max 2083 chars, http/https only
     - **Debounced Validation**: 300ms delay for input validation
     - **Delete with Undo**: 5-second undo window after deletion (Sonner toast)
     - **Blur Handler**: Prevent accidental save on Combobox/Dropdown click

3. **Note** (rich text, max 20,000 chars. Edited with Plate Editor)

### 3.6 Comment on RepoCard (Inline Comment)

Display free-text status comments on RepoCard in Card-in-Card style.

#### Specifications

- **Inline display**: Show comment directly on RepoCard (no modal needed)
- **Card-in-Card UI**: Left border accent + background color for visual distinction
- **Full text display**: No truncation, card height expands with content
- **Inline editing**: Click to edit directly, 2,000 character limit
- **Color customization**: 8 colors available (primary/red/orange/yellow/green/blue/purple/pink)

#### UI Wireframe

```
┌─────────────────────────────────────────┐
│ laststance/redux-vanilla            ⋯  │
│                                         │
│ [Unmaintained] 🍵 Zero Abstraction...  │  ← GitHub desc (optional)
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 💬 npm release done, no feature     │ │  ← Comment
│ │    additions planned for now        │ │     Card-in-Card
│ │                            ✏️       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📄 Note                                 │
└─────────────────────────────────────────┘
```

#### Board Settings

```typescript
interface BoardSettings {
  cardDisplay?: {
    showGitHubDescription: boolean // default: true
    showComment: boolean // default: true
    commentStyle: {
      fontSize: 'sm' | 'base' | 'lg' // default: 'sm'
      bold: boolean // default: false
      borderColor: string // default: 'primary'
      backgroundColor: string // default: 'muted/30'
    }
  }
}
```

#### Data Model

| Column                      | Type | Limit       | Description    |
| --------------------------- | ---- | ----------- | -------------- |
| `projectinfo.comment`       | TEXT | 2,000 chars | Inline comment |
| `projectinfo.comment_color` | TEXT | -           | 8 color choice |

#### Acceptance Criteria

- Comment displays on RepoCard
- Full text display (no truncate)
- Toggle visibility in Board Settings
- Inline editing with instant save
- Empty state shows "+ Add comment" placeholder

### 3.7 Sidebar Collapse

#### Specifications

- **Toggle Button**: Button at sidebar bottom to expand/collapse
- **Expanded State**: Width 256px (w-64), full text display
- **Collapsed State**: Width 64px (w-16), icons only
- **Transition Animation**: 300ms ease-out smooth width change
- **Tooltips**: On collapse, tooltip on hover for each nav item (side="right")
- **State Persistence**: Persisted to localStorage via Redux Storage Middleware

#### Technical Specifications

- **useSidebar Hook**: Mounted state management for hydration safety
- **CSS**: `transition-[width] duration-300 ease-out`
- **Responsive**: Desktop only (different layout for mobile)

#### Acceptance Criteria

- Instant state change on toggle button click
- Smooth animation (60fps)
- All navigation functional when collapsed
- State persists after page reload
- Tooltips display correctly when collapsed

### 3.8 Account Management

#### Specifications

- **Profile display**: GitHub avatar, username, email
- **Statistics display**: Board count, card count, maintenance count
- **Account deletion**: Confirmation flow with "DELETE" input for complete account deletion

#### Acceptance Criteria

- Profile info correctly fetched from GitHub auth
- All related data deleted on account deletion
- Deletion confirmation requires exact "DELETE" match

---

## 4) Interactions

### 4.1 Overflow "⋯" Menu (Board & Maintenance Common)

Three-dot menu on each RepoCard opens "Overflow menu" for quick actions ([Material Design](https://m3.material.io/components/menus/guidelines))

#### Menu Items (Common)

```
Open on GitHub
Open Production URL
Open Tracking dashboard
Open Supabase dashboard
Edit Project Info…   // Launch modal
Move to Maintenance  // Board only
Restore to Board     // Maintenance only
```

### 4.2 Shortcuts (Unified)

- `.` — Focused card's Overflow menu
- `Enter` — Default action (Board=Open card, Maintenance=Open on GitHub)
- `⌘K` / `Ctrl+K` — Command Palette
- `Z` — Undo last D&D move (max 10 history, Redux managed)
- `Tab` — Focus navigation
- `Escape` — Close menu/dialog
- `?` — Shortcuts help

---

## 5) UI Specifications (Text Wireframes)

**Important**: All UI generated from wireframes below using [Magic MCP](https://github.com/21st-dev/magic-mcp)

### 5.1 Sidebar (All Screens, Collapsible)

#### Expanded State (256px / w-64)

```
┌───────────────────────────────┐
│ GitBox                         │
│ ───────────────────────────── │
│ Boards                    [▼]  │  ← Collapsible
│  • All Boards                  │
│  • Favorites                   │
│  • New Board (+)               │
│ ───────────────────────────── │
│ Maintenance Mode               │  ← completed / maintenance projects
│ ───────────────────────────── │
│ Settings                       │
│ Shortcuts                      │
│ Theme: [Sunrise ▾]             │  ← Global theme selector (14 themes + System)
│ ───────────────────────────── │
│ Account                        │  ← Profile, stats, deletion
│ Sign out                       │
│ ───────────────────────────── │
│ [« Collapse]                   │  ← Collapse toggle button
└───────────────────────────────┘
```

#### Collapsed State (64px / w-16)

```
┌────────┐
│ [Logo] │
│ ────── │
│  [📋]  │  ← Boards (Tooltip: "Boards")
│  [⭐]  │  ← Favorites (Tooltip: "Favorites")
│  [+]   │  ← New Board (Tooltip: "New Board")
│ ────── │
│  [📦]  │  ← Maintenance (Tooltip: "Maintenance Mode")
│ ────── │
│  [⚙️]  │  ← Settings (Tooltip: "Settings")
│  [⌨️]  │  ← Shortcuts (Tooltip: "Shortcuts")
│  [🎨]  │  ← Theme (Tooltip: "Theme")
│ ────── │
│  [👤]  │  ← Account (Tooltip: "Account")
│  [🚪]  │  ← Sign out (Tooltip: "Sign out")
│ ────── │
│  [»]   │  ← Expand toggle button
└────────┘
```

#### Specifications

| Item          | Expanded     | Collapsed           |
| ------------- | ------------ | ------------------- |
| Width         | 256px (w-64) | 64px (w-16)         |
| Text          | Full display | Hidden              |
| Icons         | Left of text | Centered            |
| Tooltip       | None         | Right side on hover |
| Toggle button | "« Collapse" | "»" icon            |

#### Animation

- **Transition**: `transition-[width] duration-300 ease-out`
- **Content**: Text fades with opacity
- **Icons**: Smooth position movement

### 5.2 Board (Kanban with Overflow Menus)

```
┌──────────────────────────────────────────────────────────────────────┐
│ AI Experiments                                 ○ avatar   [?]       │
│ [ Add Repositories ] [ Filter ] [ Compact ] [ Refresh ] [ ⌘K ]     │
│                                                                      │
│ Pending           Planning            Focus Development  Production Release │
│ ┌───────────────────────────┐   ┌───────────────────────────┐         │
│ │ repo-ml-lab        [⋯]    │   │ ui-research        [⋯]    │         │
│ │ "On hold this week"       │   │ "Draft spec"              │         │
│ └───────────────────────────┘   └───────────────────────────┘         │
│ ↑ drag to reorder (priority)     ← drag across lists to change status │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Project Info (Modal)

```
┌───────────────────────────────────────────────────┐
│ Project Info – laststance/app-studio              │
│---------------------------------------------------│
│ Quick note                                        │
│ [ "Heads down on auth rollout…" ]                 │
│---------------------------------------------------│
│ Links                                             │
│ • Production URL(s):  https://app.example.com     │
│ • Tracking:           https://plausible.io/...    │
│ • Supabase:           https://supabase.com/...    │
│---------------------------------------------------│
│ [ Save ] [ Cancel ]                               │
└───────────────────────────────────────────────────┘
```

### 5.4 Maintenance Mode (Explorer UI)

#### Grid View

```
┌───────────────────────────────────────────────────────────────┐
│ Maintenance Mode                              ○ avatar  [?]  │
│ [ Search archived... ] [ Grid ▾ ] [ Sort: Updated ▾ ]        │
│                                                               │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│ │ lib-utils  ⋯  │  │ ui-research ⋯ │  │ core-cli   ⋯  │  ...  │
│ │ "Shipped…"    │  │ "Docs only"   │  │ "Security"   │       │
│ │ Updated 2025-10-11  ⭐410         │  │ Updated 2025-07-01    │
│ └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                               │
│ [Open on GitHub]  [Restore to Board]                          │
└───────────────────────────────────────────────────────────────┘
```

#### List View (Same screen toggle)

```
Name              Note                 Updated        Stars   Actions
lib-utils         "Shipped…"           2025-10-11     410     [⋯]
ui-research       "Docs only"          2025-09-03     128     [⋯]
core-cli          "Security"           2025-07-01      87     [⋯]
```

### 5.5 Settings

```
┌───────────────────────────────────────────────┐
│ Settings                                      │
│-----------------------------------------------│
│ Theme (14 + System)                           │
│  ○ System (OS preference)                     │
│  Light: default / Sunrise / Sandstone / Mint /│
│         Sky / Lavender / Rose                 │
│  Dark : dark / Midnight / Graphite / Forest / │
│         Ocean / Plum / Rust                   │
│-----------------------------------------------│
│ Display                                       │
│  ☑ Compact Mode                               │
│  ☑ Show Card Metadata (stars, language, date) │
│-----------------------------------------------│
│ Typography                                    │
│  Base size: [16px] (12-20px range)            │
└───────────────────────────────────────────────┘
```

**Theme**:

- **Access**: Settings screen or Sidebar Theme dropdown
- **Scope**: App-wide (no board-specific settings)
- **14 themes + System**: Light 7 + Dark 7 + OS preference follow

**Display Settings**:

- **Compact Mode**: Reduce card/column padding for higher information density
- **Show Card Metadata**: Toggle stars, language, update date visibility

**Persistence**: Redux + localStorage (`redux-storage-middleware`)

### 5.6 NoteModal (Rich Text Editor)

````
┌───────────────────────────────────────────────────────────┐
│ Project Note                                          [×] │
│ Add notes about owner/repo-name. Use toolbar for         │
│ formatting.                                               │
│-----------------------------------------------------------│
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [B] [I] [U] [S] [~] [<>] | [H▾] | [•] [1.] | [🔗] [📊] │ │ ← Fixed Toolbar
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │                                                       │ │
│ │  # Project Overview                                   │ │ ← H1 Heading
│ │                                                       │ │
│ │  This project uses **React** and _TypeScript_.        │ │ ← Bold, Italic
│ │                                                       │ │
│ │  ## Key Features                                      │ │ ← H2 Heading
│ │  • Authentication system                              │ │ ← Bullet List
│ │  • Dashboard with analytics                           │ │
│ │  • API integration                                    │ │
│ │                                                       │ │
│ │  ```typescript                                        │ │ ← Code Block
│ │  const config = { theme: 'dark' }                     │ │
│ │  ```                                                  │ │
│ │                                                       │ │
│ │  > Note: Deploy to production after testing.          │ │ ← Blockquote
│ │                                                       │ │
│ │  | Header 1 | Header 2 | Header 3 |                   │ │ ← Table
│ │  |----------|----------|----------|                   │ │
│ │  | Cell 1   | Cell 2   | Cell 3   |                   │ │
│ │                                                       │ │
│ │  Type / for commands...                               │ │ ← Placeholder
│ │                                                       │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│                                    1,234 / 20,000         │ ← Character Count
│                                    Draft saved 10:30 AM   │ ← Auto-save Status
│                                                           │
│                              [ Cancel ]  [ Save ]         │
└───────────────────────────────────────────────────────────┘
````

#### Toolbar Buttons

| Icon     | Function        | Shortcut |
| -------- | --------------- | -------- |
| **B**    | Bold            | Cmd+B    |
| _I_      | Italic          | Cmd+I    |
| <u>U</u> | Underline       | Cmd+U    |
| ~~S~~    | Strikethrough   | -        |
| `<>`     | Inline Code     | -        |
| 🖌️       | Highlight       | -        |
| H▾       | Heading (H1-H3) | -        |
| •        | Bullet List     | -        |
| 1.       | Numbered List   | -        |
| 🔗       | Link            | Cmd+K    |
| 📊       | Table           | -        |

---

## 6) Data Model

### 6.1 Database Tables (Supabase)

```sql
-- Board: Kanban Board
Board {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  name text NOT NULL,
  description text,
  is_favorite boolean DEFAULT false,  -- Favorite board
  created_at, updated_at
}

-- StatusList: Kanban Column (Grid layout support)
StatusList {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES Board,
  name text NOT NULL,
  color text,
  order integer,
  grid_row integer DEFAULT 0,  -- 2D grid row position
  grid_col integer DEFAULT 0,  -- 2D grid column position
  created_at, updated_at
}

-- RepoCard: GitHub Repository Card
RepoCard {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES Board,
  status_list_id uuid REFERENCES StatusList,
  repo_name text NOT NULL,
  repo_owner text NOT NULL,
  order integer,
  created_at, updated_at
  -- note moved to ProjectInfo
}

-- ProjectInfo: Extended Project Details
ProjectInfo {
  id uuid PRIMARY KEY,
  repo_card_id uuid REFERENCES RepoCard,
  maintenance_id uuid REFERENCES Maintenance,  -- Maintenance link
  links jsonb,  -- {type, url, icon}[] - 55 built-in types
  note text,  -- Rich text (Plate Editor, max 20,000 chars)
  comment text,  -- Inline comment (max 2,000 chars)
  comment_color text DEFAULT 'primary',  -- 8 colors
  created_at, updated_at
}

-- UserLinkPresets: User-defined Link Types
UserLinkPresets {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  name text NOT NULL,
  icon text NOT NULL,  -- Lucide icon name
  created_at, updated_at
}

-- Maintenance: Archived Repositories
Maintenance {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  created_at, updated_at
}
```

### 6.2 Frontend State (Redux + localStorage)

```typescript
// Settings Slice (Persistence: localStorage)
Settings {
  theme: ThemeName,              // 14 themes + system (global setting)
  typography: { baseSize, scale },
  compactMode: boolean,
  showCardMetadata: boolean,
  organizationFilter: string,    // AddRepositoryCombobox filter
  sidebarCollapsed: boolean,     // Sidebar collapse state (default: false)
}

// Board Slice (Session)
Board {
  activeBoard: Board | null,
  statusLists: StatusListDomain[],
  repoCards: RepoCardForRedux[],
  loading: boolean,
  error: string | null,
  lastDragOperation: DragOperation | null,  // For Undo
  undoHistory: DragOperation[],             // Max 10 entries
}

// Draft Slice (Persistence: localStorage)
Draft {
  [repoCardId]: { note: JSON, comment: string },  // Auto-save
}

// Auth Slice (Session)
Auth {
  isAuthenticated: boolean,
}
```

### 6.3 RepoCard Meta (GitHub API)

```typescript
// Fetched from GitHub API, not stored in DB
RepoCardMeta {
  stars: number,
  updatedAt: string,
  visibility: 'public' | 'private',
  language: string | null,
  topics: string[],
}
```

---

## 7) Quality Assurance

### 7.1 Accessibility & Visual Tests (Automated)

- Measure **contrast** across 14 themes × representative screens (Board/Maintenance/Modal)
- Standards: small text 4.5:1, UI 3:1
- **Build fails if not met** (aligns with axe rules)
- Reference: [Deque University](https://dequeuniversity.com/rules/axe/4.8/color-contrast)

### 7.2 Performance Requirements

- No delay displaying candidates with 100+ repositories
- D&D/Undo operations work smoothly
- Grid/List toggle reflects instantly with one click

---

## 8) Acceptance Criteria (Integrated)

### Common

- **Overflow menu** has **same structure** and shortcuts (e.g., `.` to open) in both **Board/Maintenance**
- Same modal accessible from ⋯ on all RepoCards (Board/Maintenance common)

### Maintenance Mode

- **Grid/List** toggle with one click
- **Enter=Open on GitHub** as default action
- Explorer UI provides select/sort/delete/restore per list/table HIG

### Accessibility

- All 14 themes meet **4.5:1** for body text, **3:1+** for UI elements (includes automated tests)

---

## 9) Implementation Phases

### Phase 1: Basic Features (MVP)

- Board/Kanban basic features
- GitHub OAuth & Repository addition
- Project Info (Notes, Links)

### Phase 2: Full Version

- Complete Maintenance Mode implementation
- 14 theme support (Light 7 + Dark 7)
- Comment on RepoCard feature
- Account management (profile, stats, deletion)
- Favorites feature

---

## 10) Platform Requirements

### 10.1 Web Fundamentals (PWA & Meta)

#### Open Graph / Twitter Card

Social media preview images and metadata.

| Item             | File                      | Size     |
| ---------------- | ------------------------- | -------- |
| OG Image         | `app/opengraph-image.tsx` | 1200×630 |
| Twitter Card     | `app/twitter-image.tsx`   | 1200×600 |
| Favicon          | `app/icon.svg`            | SVG      |
| Apple Touch Icon | `app/apple-icon.tsx`      | 180×180  |

#### Metadata Configuration

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: 'GitBox - Organize Your GitHub Repositories',
  description: 'PWA for managing GitHub repositories in Kanban format',
  keywords: ['GitHub', 'Repository Manager', 'Kanban', 'PWA'],
  openGraph: { ... },
  twitter: { card: 'summary_large_image', ... },
}
```

#### PWA Manifest

`public/manifest.json` enables PWA installation.

```json
{
  "name": "GitBox",
  "short_name": "GitBox",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

### 10.2 Hosting (Vercel)

#### Project Configuration

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Dashboard      | https://vercel.com/laststance/gitbox   |
| Project ID     | `prj_M4T9K5HjwFx0e9PIueEhOFn1UmUM`     |
| Team           | `laststance`                           |
| Production URL | `https://gitbox-laststance.vercel.app` |

#### Environment Variables

| Environment | Variables                                                          |
| ----------- | ------------------------------------------------------------------ |
| Production  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod) |
| Preview     | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (dev)  |
| Development | `.env.local` with dev project credentials                          |

### 10.3 Backend (Supabase)

#### Environment Separation

| Environment | Supabase Project                           | Purpose                      |
| ----------- | ------------------------------------------ | ---------------------------- |
| Development | `https://jqtxjzdxczqwsrvevmyk.supabase.co` | Local dev (`localhost:3008`) |
| Production  | `https://mfeesjmtofgayktirswf.supabase.co` | Production deployment        |

#### GitHub OAuth Configuration

Each Supabase project requires its own GitHub OAuth App:

| Setting                | Dev Project                                                 | Prod Project                                                |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| GitHub OAuth App       | `gitbox-dev`                                                | `gitbox-prod`                                               |
| Authorization callback | `https://jqtxjzdxczqwsrvevmyk.supabase.co/auth/v1/callback` | `https://mfeesjmtofgayktirswf.supabase.co/auth/v1/callback` |

#### Redirect URLs (Supabase Auth)

```toml
# supabase/config.toml
[auth]
additional_redirect_urls = [
  "http://localhost:3008/auth/callback",
  "https://*-laststance.vercel.app/auth/callback",
  "https://gitbox-laststance.vercel.app/auth/callback",
]
```

#### Migration Workflow

1. Create migration: `supabase migration new <description>`
2. Write SQL in `supabase/migrations/YYYYMMDDHHMMSS_<description>.sql`
3. Test on dev: `supabase link --project-ref jqtxjzdxczqwsrvevmyk` → `supabase db push --linked`
4. Merge to `main` → Production deploys via GitHub Actions

#### RLS (Row Level Security)

All tables have RLS enabled. Users can only access their own data via `user_id` match.

---

## 11) Drag & Drop Specification

### 11.1 Technical Constraints

#### @dnd-kit isTrusted Requirement

@dnd-kit only accepts events with `event.isTrusted === true` for security.

| Event Source             | isTrusted | D&D Works  |
| ------------------------ | --------- | ---------- |
| Real user interaction    | ✅ true   | ✅ Works   |
| Playwright CDP           | ✅ true   | ✅ Works   |
| Playwright mouse API     | ❌ false  | ❌ Ignored |
| JavaScript dispatchEvent | ❌ false  | ❌ Ignored |
| Claude Chrome MCP        | ❌ false  | ❌ Ignored |

**E2E Testing**: Must use Playwright CDP helper (`e2e/helpers/cdp-drag.ts`)

### 11.2 Card Drag & Drop

#### 11.2.1 Same Column Card Reorder

```
┌──────────────┐         ┌──────────────┐
│ In Progress  │         │ In Progress  │
│┌────────────┐│  drag   │┌────────────┐│
││ Card A     ││ ───┐    ││ Card B     ││
│├────────────┤│    │    │├────────────┤│
││ Card B     ││ <──┘    ││ Card A     ││ ← Swapped
│├────────────┤│         │├────────────┤│
││ Card C     ││         ││ Card C     ││
│└────────────┘│         │└────────────┘│
└──────────────┘         └──────────────┘
```

| Item          | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Status        | ✅ Implemented                                         |
| E2E Coverage  | ✅ Covered (`should reorder cards within same column`) |
| Server Action | `batchUpdateRepoCardOrders()`                          |
| CDP Helper    | `cdpCardDragAndDrop()`                                 |

#### 11.2.2 Cross-Column Move

```
┌──────────────┐  ┌──────────────┐         ┌──────────────┐  ┌──────────────┐
│ In Progress  │  │ Review       │         │ In Progress  │  │ Review       │
│┌────────────┐│  │              │  drag   │              │  │┌────────────┐│
││ Card A     ││ ─┼──────────────┼───►     │              │  ││ Card A     ││
│└────────────┘│  │              │         │              │  │└────────────┘│
└──────────────┘  └──────────────┘         └──────────────┘  └──────────────┘
```

| Item          | Value                                               |
| ------------- | --------------------------------------------------- |
| Status        | ✅ Implemented                                      |
| E2E Coverage  | ✅ Covered (`should move card to different column`) |
| Server Action | `updateRepoCardPosition()`                          |
| CDP Helper    | `cdpCardToColumnDragAndDrop()`                      |

### 11.3 Column Drag & Drop

#### 11.3.1 Column Swap (Position Exchange)

```
Row 0: [ A ] [ B ] [ C ]    →    Row 0: [ B ] [ A ] [ C ]
         ↓___↑                           (A and B swapped)
        drag A → B
```

| Item          | Value                                              |
| ------------- | -------------------------------------------------- |
| Status        | ✅ Implemented                                     |
| E2E Coverage  | ✅ Covered (grid position verification, drag exec) |
| Server Action | `swapStatusListPositions()`                        |
| CDP Helper    | `cdpColumnDragAndDrop()`                           |
| Note          | DropZone is sensitive - must exceed target center  |

#### 11.3.2 NewRowDropZone (New Row Creation)

```
Row 0: [ A ] [ B ] [ C ] [ D ]
                    ↓ drag down
         ┌─────────────────────────────┐
         │ Drop column to create row   │  ← NewRowDropZone
         └─────────────────────────────┘
                    ↓
Row 0: [ A ] [ B ] [ D ]
Row 1: [ C ]                           ← New row created
```

| Item          | Value                            |
| ------------- | -------------------------------- |
| Status        | ✅ Implemented                   |
| E2E Coverage  | ✅ Covered                       |
| Server Action | `updateStatusListPosition()`     |
| CDP Helper    | `cdpColumnToNewRowDragAndDrop()` |

#### 11.3.3 ColumnInsertZone (Empty Slot Insert)

```
Row 0: [ A ] [   ] [ B ] [ C ]
               ↑
         drag A → empty slot
               ↓
Row 0: [   ] [ A ] [ B ] [ C ]    (Subsequent columns shift right)
```

| Item          | Value                              |
| ------------- | ---------------------------------- |
| Status        | ✅ Implemented                     |
| E2E Coverage  | ✅ Covered                         |
| Server Action | `batchUpdateStatusListPositions()` |
| CDP Helper    | `cdpColumnToInsertZone()`          |

#### 11.3.4 Same Row Horizontal Move

Achieved via ColumnInsertZone or Column Swap

#### 11.3.5 Vertical Column Swap (Cross-Row Position Exchange)

```
Row 0: [ A ] [   ] [   ]         Row 0: [ B ] [   ] [   ]
Row 1: [ B ] [   ] [   ]   →     Row 1: [ A ] [   ] [   ]
         ↓___↑                           (A and B swap rows)
        drag A → B
```

**Precondition**: Multi-row configuration after moving column to Row 1+ via NewRowDropZone

| Item          | Value                                              |
| ------------- | -------------------------------------------------- |
| Status        | ✅ Implemented                                     |
| E2E Coverage  | ✅ Covered                                         |
| Server Action | `swapStatusListPositions()`                        |
| CDP Helper    | `cdpColumnDragAndDrop()`                           |
| Note          | Row position exchange between same gridCol columns |

#### 11.3.6 Diagonal Column Swap (Cross-Row/Col Position Exchange)

```
Row 0: [ A ] [   ] [   ]         Row 0: [   ] [   ] [ B ]
Row 1: [   ] [   ] [ B ]   →     Row 1: [ A ] [   ] [   ]
         ↘_________↗                     (A and B swap diagonally)
        drag A → B
```

| Item          | Value                                    |
| ------------- | ---------------------------------------- |
| Status        | ✅ Implemented                           |
| E2E Coverage  | ✅ Covered                               |
| Server Action | `swapStatusListPositions()`              |
| CDP Helper    | `cdpColumnDragAndDrop()`                 |
| Note          | Both gridRow and gridCol fully exchanged |

### 11.4 Previously Unimplemented Features

#### 11.4.1 Column Auto-Height (Height Auto-Expansion)

| Item         | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Status       | ✅ Implemented (2025-12-28)                                                |
| E2E Coverage | ✅ Covered (`e2e/kanban.spec.ts` - Column Auto-Height tests)               |
| Files        | `KanbanBoard.tsx`, `SortableColumn.tsx`, `StatusColumn.tsx`, `cdp-drag.ts` |
| Method       | CSS Grid `minmax(min-content, auto)` + height constraint removal           |

### 11.5 E2E Test Coverage Requirements

| Test Name                    | Status                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| Card: Column display         | ✅ Added (`should display cards in columns`)                   |
| Card: Cross-column move      | ✅ Added (`should move card to different column`)              |
| Card: Same column reorder    | ✅ Added (`should reorder cards within same column`)           |
| Card: statusId update        | ✅ Verified in above tests                                     |
| Column: Grid position verify | ✅ Added (`should have correct initial column grid positions`) |
| Column: Swap operation       | ✅ Added (`should execute column drag operation successfully`) |
| Column: Vertical Swap        | ✅ Added (11.3.5 - 2 tests in `column-dnd.spec.ts`)            |
| Column: Diagonal Swap        | ✅ Added (11.3.6 - 3 tests in `column-dnd.spec.ts`)            |
| Column: NewRowDropZone       | ✅ Added (6 test cases in `column-dnd.spec.ts`)                |
| Column: ColumnInsertZone     | ✅ Added (5 test cases in `column-dnd.spec.ts`)                |
| Column: Auto-Height          | ✅ Added (`e2e/kanban.spec.ts` - 6 tests)                      |

### 11.6 CDP Drag Helper List

```typescript
// e2e/helpers/cdp-drag.ts
export async function cdpDragAndDrop(page, source, target, options?)
export async function cdpColumnDragAndDrop(page, sourceId, targetId, options?)
export async function cdpCardDragAndDrop(page, sourceId, targetId, options?)
export async function cdpCardToColumnDragAndDrop(
  page,
  cardId,
  columnId,
  options?,
)
export async function cdpColumnToNewRowDragAndDrop(
  page,
  columnId,
  row,
  options?,
)
export async function cdpColumnToGridPosition(
  page,
  columnId,
  row,
  col,
  options?,
)
export async function cdpColumnToInsertZone(page, columnId, row, col, options?)
```

---

## References

- [Harmonizer - Evil Martians](https://harmonizer.evilmartians.com/)
- [W3C WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Material Design 3 - Menus](https://m3.material.io/components/menus/guidelines)
- [Apple HIG - Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [GitHub Docs - Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/)
- [Supabase Docs](https://supabase.com/docs/)
- [Deque University - Color Contrast](https://dequeuniversity.com/rules/axe/4.8/color-contrast)
