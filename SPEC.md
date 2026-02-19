# GitBox — Specification v1.4 (2026-02-19)

## 1) Product Overview

- **Language**: English
- **Landing Page**: Login/Sign-in buttons

### Navigation Flow

**Auth (GitHub OAuth)** → **Home (Boards)** → **Board (Kanban)** → **Card Detail (right panel)**

### Main Screens

- **Maintenance Mode** — Archived/maintenance projects storage (Sidebar link, Explorer UI)
- **Command Palette (⌘K)**
- **Settings** — Display/Typography
- **Shortcuts (?)**
- **Account** — Profile, statistics, account deletion
- **Privacy Policy** (`/privacy`) — GDPR-compliant privacy policy
- **Terms of Use** (`/terms`) — Terms of service

### Tech Stack

| Category   | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                              |
| UI Library | React 19.2                                           |
| Language   | TypeScript 5.9 (strict, noUncheckedIndexedAccess)    |
| Styling    | Tailwind CSS 4 + shadcn/ui (OKLCH tokens)            |
| State      | Redux Toolkit + @laststance/redux-storage-middleware |
| Database   | Supabase (PostgreSQL + Auth + RLS)                   |
| Rich Text  | Plate.js (Platejs 52)                                |
| D&D        | @dnd-kit (core + sortable + modifiers)               |
| Testing    | Vitest 4, Playwright 1.58, Storybook 10              |
| Monitoring | Sentry 10                                            |
| Analytics  | Vercel Analytics                                     |
| Validation | Zod 4                                                |
| Hosting    | Vercel                                               |

---

## 2) Design System

### 2.1 Color & Typography Guide

#### Color System

- **OKLCH-based** scale with aligned lightness (L) values
- **Dark/Light mirror mapping** for consistent contrast
- **CSS variables** from shadcn/ui theme system (no hardcoded gray-\* classes in dark mode)
- Reference: [Harmonizer](https://harmonizer.evilmartians.com/)

#### Contrast Requirements

- **Body text**: **4.5:1 or higher** (WCAG AA compliant)
- **UI components/icons**: **3:1 or higher**
- Reference: [W3C WCAG 2.1](https://www.w3.org/TR/WCAG21/)

#### Typography

- **Base font**: **16px**
- Step: 1px increments (minimum 12px to recommended 28px)
- Source of truth: OKLCH palette (Tailwind tokens)

### 2.2 Design Tokens (14 Themes)

#### Token Set (Common Keys — CSS Variables)

```
--background              // Base layer
--card / --popover        // Elevated surfaces
--muted                   // Subtle backgrounds for secondary content
--border / --input        // Default borders / form input borders
--ring                    // Focus ring

--foreground              // Primary text
--muted-foreground        // Secondary text

--primary / --primary-foreground
--secondary / --secondary-foreground
--accent / --accent-foreground
--destructive / --destructive-foreground
```

#### Light Theme (Recommended OKLCH Range)

- background L≈0.98, card L≈0.96, muted L≈0.92
- foreground contrast **4.5:1+**, muted-foreground **3:1+**
- primary/secondary/accent with saturation, **primary-foreground** always AA compliant (auto black/white switch)

#### Dark Theme (Recommended OKLCH Range)

- background L≈0.12, card L≈0.16, muted L≈0.20
- foreground with **4.5:1+ contrast** via lightness difference
- primary with **elevated luminance** for button/selection visibility

#### Theme Names

- **Light:** Default / Sunrise / Sandstone / Mint / Sky / Lavender / Rose
- **Dark:** Dark / Midnight / Graphite / Forest / Ocean / Plum / Rust

---

## 3) Features

### 3.1 GitHub OAuth & Repository Addition

#### Specifications

- Combobox search (owner/repo, topics, visibility)
- Batch addition / duplicate detection
- **Organization Filter**: Filter repositories by user/org (persisted to Redux/localStorage)
- **Maintenance Filter**: Repos in Maintenance Mode are excluded from combobox (client + server validation)
- **First Board auto-creation**: Auto-create "My First Board" on first login (DB trigger)

#### Acceptance Criteria

- No delay displaying candidates with 100+ repos
- D&D/Undo works smoothly
- Organization selection persists across sessions
- Maintenance repos cannot be added to board

### 3.2 Board (Kanban)

#### Specifications

- **Column = Status** (e.g., Suspend / Spec designing / Active / Completed)
- Column CRUD operations (2D grid layout: gridRow, gridCol)
- **Column Width Constraint**: CSS variable `--column-width: 320px`, `minmax(280px, var(--column-width))`
- **Card**: repo name, quick note, optional meta (Stars/Updated/Visibility/Language/Topics)
- **⋯ (Overflow menu)**: Launch **Project Info** modal
- **Favorites**: Add board to favorites (star icon, prioritized in sidebar)
- **Board Subtitle**: Optional description below board title (max 100 chars, inline editable)
- **Inline Editable Header**: Board title and subtitle are click-to-edit (`InlineEditableText` component)
- **Board Settings**: 4-tab dialog (General, Cards, Sharing, Danger Zone)
  - **General**: Rename board, subtitle edit form, "Show Subtitle" visibility toggle
  - **Cards**: Card display settings (description, comment, font size/weight)
  - **Sharing**: Public board toggle, share link generation/copy
  - **Danger Zone**: Delete board with confirmation
- **Public Board Sharing**: Make boards publicly viewable via unique share slug (read-only for visitors)
- **Board D&D Reorder**: Drag & drop board cards on `/boards` page to reorder (position persisted to DB)
  - GripVertical drag handle (visible on hover)
  - Optimistic UI with `useOptimistic` + `useState` dual pattern
  - DragOverlay for visual feedback during drag
  - Disabled on `/boards/favorites` (filtered view)

#### Acceptance Criteria

- Board = Status field basis
- D&D follows conventions ([GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/))
- Favorites toggle reflects immediately
- Columns don't expand to fill available space (constrained to max width)
- Board card order persists after page reload (DB-backed position)

### 3.3 Maintenance Mode

#### Specifications

- Navigate from Sidebar
- **Explorer UI** (Grid/List toggle, sort/search)
- **Click = Navigate to GitHub repo**
- **⋯ menu** on card top-right
- **Restore to Board** operation (via RestoreToBoardDialog)
- **Delete from Maintenance** operation (via DeleteMaintenanceDialog)
  - Confirmation AlertDialog with destructive warning
  - CASCADE DELETE removes associated projectinfo (notes, links, comments)
  - Protected by rate limiting (`boardCrud`)

#### UI Reference

List/Table/Sidebar UI HIG ([Apple Developer](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables))

### 3.4 Project Note (Rich Text Notes)

Full-featured WYSIWYG editor accessible from each RepoCard's Note button.

#### Specifications

- **Plate Editor**-based rich text editor (Platejs 52)
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

Accessible from all RepoCards (Board & Maintenance).

#### Sections

1. **Comment** (inline comment, max 2,000 chars. Displayed on RepoCard. See 3.6)

2. **Links** (55 built-in link types + custom presets)
   - **Built-in Types**: 55 link types in 13 categories
     - Hosting (Vercel, Netlify, Cloudflare Pages, etc.)
     - Cloud (AWS, GCP, Azure, etc.)
     - Database (Supabase, MongoDB, Firebase, etc.)
     - Storage (S3, R2, GCS, etc.)
     - Auth (Auth0, Clerk, NextAuth, etc.)
     - Email (SendGrid, Resend, Postmark, etc.)
     - Monitoring (Sentry, DataDog, Grafana, etc.)
     - Testing (Playwright, Cypress, BrowserStack, etc.)
     - Project (GitHub, GitLab, Jira, Linear, etc.)
     - Docs (Notion, Confluence, GitBook, etc.)
     - Publishing (npm, PyPI, Docker Hub, etc.)
     - Payment (Stripe, LemonSqueezy, Paddle, etc.)
     - Custom (user-created presets)
   - **Custom Presets**: User-defined link types (Lucide icon selection, stored in `user_link_presets` table)
   - **EditableUrlItem UI**: Inline editing component
     - **Single-Edit Coordination**: Only one URL editable at a time (others auto-save)
     - **URL Validation**: Max 2083 chars, http/https only
     - **Debounced Validation**: 300ms delay for input validation
     - **Delete with Undo**: 5-second undo window after deletion (Sonner toast)
     - **Blur Handler**: Prevent accidental save on Combobox/Dropdown click

3. **Note** (rich text, max 20,000 chars. Edited with Plate Editor via NoteModal)

### 3.6 Comment on RepoCard (Inline Comment)

Display free-text status comments on RepoCard in Card-in-Card style.

#### Specifications

- **Inline display**: Show comment directly on RepoCard (no modal needed)
- **Card-in-Card UI**: Left border accent + background color for visual distinction
- **Full text display**: No truncation, card height expands with content
- **Inline editing**: Click to edit directly, 2,000 character limit
- **Color customization**: 8 colors available (primary/blue/green/amber/purple/rose/cyan/neutral)
- **Per-comment color**: Color stored per comment in `projectinfo.comment_color`

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
    commentText: {
      fontSize: 'sm' | 'base' | 'lg' // default: 'sm'
      fontWeight: 'normal' | 'medium' | 'semibold' // default: 'normal'
    }
  }
  showSubtitle?: boolean // default: true — controls subtitle visibility in header
}
```

#### Data Model

| Column                      | Type | Limit       | Description                  |
| --------------------------- | ---- | ----------- | ---------------------------- |
| `projectinfo.comment`       | TEXT | 2,000 chars | Inline comment               |
| `projectinfo.comment_color` | TEXT | -           | 8 color choice (per-comment) |

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
- **Hydration Safety**: `useMounted()` guard pattern to prevent SSR mismatch

#### Technical Specifications

- **useSidebar Hook**: Mounted state management for hydration safety
- **CSS**: `transition-[width] duration-300 ease-out`
- **Responsive**: Desktop only (different layout for mobile)
- **SSR**: Renders expanded (default) state on server, applies persisted state after mount

#### Acceptance Criteria

- Instant state change on toggle button click
- Smooth animation (60fps)
- All navigation functional when collapsed
- State persists after page reload
- Tooltips display correctly when collapsed
- No hydration mismatch errors

### 3.8 Account Management

#### Specifications

- **Profile display**: GitHub avatar, username, email
- **Statistics display**: Board count, card count, maintenance count
- **Account deletion**: Confirmation flow with "DELETE" input for complete account deletion

#### Acceptance Criteria

- Profile info correctly fetched from GitHub auth
- All related data deleted on account deletion
- Deletion confirmation requires exact "DELETE" match

### 3.9 Navigation Progress Bar

#### Specifications

- **Library**: `nextjs-toploader`
- **Style**: Algora-style green bar (`oklch(0.696 0.17 162.48)`)
- **Configuration**: Height 3px, no spinner, crawl enabled, speed 200ms
- **Z-index**: 9999 (above all content)

#### Acceptance Criteria

- Progress bar shows on page navigation
- Does not interfere with modal/dialog overlays

### 3.10 Error & Loading States

#### Specifications

- **Error Boundary** (`app/error.tsx`): Global error boundary with Sentry integration
  - Retry and "Go to Boards" recovery actions
- **Global Error** (`app/global-error.tsx`): Root-level error boundary
- **Board Loading** (`app/board/[id]/loading.tsx`): Skeleton UI matching KanbanBoard layout
  - CardSkeleton, ColumnSkeleton components
- **Per-Route Boundaries**: All route segments have dedicated `loading.tsx` and `error.tsx`
  - Routes: `/boards`, `/board/[id]`, `/maintenance`, `/settings`, `/account`

### 3.11 Rate Limiting

#### Specifications

- **Algorithm**: Sliding window, in-memory per-process
- **Bypass**: Disabled in test mode (`APP_ENV=test`)
- **Edge**: Fixed-window variant in `proxy.ts` for OAuth callback

#### Rate Limit Configuration

| Key                | Max Requests | Window | Scope                  |
| ------------------ | ------------ | ------ | ---------------------- |
| `auth/callback`    | 10           | 1 min  | OAuth callback (edge)  |
| `signInWithGitHub` | 10           | 1 hour | GitHub OAuth login     |
| `deleteAccount`    | 3            | 1 hour | Account deletion       |
| `githubApi`        | 30           | 1 min  | GitHub API proxy       |
| `addReposToBoard`  | 10           | 1 min  | Add repository         |
| `batchDnD`         | 60           | 1 min  | D&D batch operations   |
| `boardCrud`        | 20           | 1 min  | Board/maintenance CRUD |

#### Integration

- **Server Actions**: `withAuthResultRateLimit(key, action)` wrapper
- **Edge (proxy.ts)**: `edgeRateLimit(ip, max, window)` → HTTP 429 + `Retry-After: 60`
- **Identifier**: User ID (authenticated) or IP (unauthenticated)
- **Error**: `"Too many {description} requests. Please try again later."`

### 3.12 Security

#### Security Headers (next.config.ts)

| Header                                | Value                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `Strict-Transport-Security`           | `max-age=63072000; includeSubDomains; preload`                               |
| `X-Frame-Options`                     | `SAMEORIGIN`                                                                 |
| `X-Content-Type-Options`              | `nosniff`                                                                    |
| `Referrer-Policy`                     | `strict-origin-when-cross-origin`                                            |
| `Permissions-Policy`                  | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()` |
| `Content-Security-Policy-Report-Only` | Report-only CSP (see below)                                                  |

#### CSP Directives (Report-Only)

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com https://github.com data: blob:;
connect-src 'self' https://*.supabase.co http://127.0.0.1:* https://api.github.com https://*.ingest.us.sentry.io https://vitals.vercel-insights.com;
font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

#### Security Event Logging

Sentry-based audit trail via `logSecurityEvent()` (`lib/security-events.ts`).

| Event Type            | Level   | Trigger                                 |
| --------------------- | ------- | --------------------------------------- |
| `login_success`       | info    | Successful OAuth                        |
| `login_failure`       | warning | Failed OAuth (code exchange error)      |
| `logout`              | info    | User-initiated sign out                 |
| `account_deleted`     | info    | Account permanently deleted             |
| `unauthorized_access` | warning | Unauthenticated route access (proxy.ts) |
| `rate_limited`        | warning | Request blocked by rate limiter         |

#### XSS Prevention

- **DOMPurify**: All rich text (Plate.js JSON) sanitized on render via `DOMPurify.sanitize()`
- **Board subtitle/title**: Server-side length validation + client-side sanitization
- **Open Redirect**: OAuth callback validates redirect URL against allowlist
- **E2E Coverage**: `xss-smoke.spec.ts` verifies script injection is neutralized

### 3.13 Server Action Pattern

#### ActionResult\<T\> Discriminated Union

Standardized return type for client-consumed Server Actions (`lib/actions/types.ts`).

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

#### Auth Guard Wrappers (`lib/actions/auth-guard.ts`)

| Wrapper                     | Auth | Rate Limit | Returns                         |
| --------------------------- | ---- | ---------- | ------------------------------- |
| `withAuth()`                | Yes  | No         | Throws on failure               |
| `withAuthResult()`          | Yes  | No         | `ActionResult<T>`               |
| `withAuthResultRateLimit()` | Yes  | Yes        | `ActionResult<T>` (recommended) |
| `withAuthRateLimit()`       | Yes  | Yes        | Throws on failure               |

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
Edit Project Info…      // Launch modal
Move to Maintenance     // Board only
Restore to Board        // Maintenance only
Delete from Maintenance // Maintenance only (destructive, confirmation dialog)
```

### 4.2 Shortcuts (Unified)

- `.` — Focused card's Overflow menu
- `Enter` — Default action (Board=Open card, Maintenance=Open on GitHub)
- `⌘K` / `Ctrl+K` — Command Palette
- `Z` — Undo last operation
- `Tab` — Focus navigation
- `Escape` — Close menu/dialog
- `?` — Shortcuts help

---

## 5) UI Specifications (Text Wireframes)

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
│ AI Experiments                                 ○ avatar   [?]       │  ← Click to edit title
│ Exploring ML workflows and tooling                                   │  ← Subtitle (click to edit, toggleable)
│ [ Add Repositories ] [ Add Column ] [ Board Settings ] [ Copy Link ] │
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
│ Display                                       │
│  ☑ Compact Mode                               │
│  ☑ Show Card Metadata (stars, language, date) │
└───────────────────────────────────────────────┘
```

**Theme** (via Sidebar):

- **Access**: Sidebar Theme dropdown
- **Scope**: App-wide (no board-specific settings)
- **14 themes + System**: Light 7 + Dark 7 + OS preference follow

**Display Settings**:

- **Compact Mode**: Reduce card/column padding for higher information density
- **Show Card Metadata**: Toggle stars, language, update date visibility

**Persistence**: Redux + localStorage (`@laststance/redux-storage-middleware`)

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
board {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  name text NOT NULL,
  subtitle text,                      -- Optional description (max 100 chars)
  is_favorite boolean DEFAULT false,  -- Favorite board
  position integer DEFAULT 0,        -- Board order for D&D reordering on /boards
  settings jsonb,                     -- Board-level settings (card display, showSubtitle, etc.)
  is_public boolean DEFAULT false,   -- Public board visibility
  share_slug text UNIQUE,            -- Unique URL slug for public sharing
  created_at, updated_at
}

-- StatusList: Kanban Column (Grid layout support)
statuslist {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES board,
  name text NOT NULL,
  color text,
  order integer,
  grid_row integer DEFAULT 0,  -- 2D grid row position
  grid_col integer DEFAULT 0,  -- 2D grid column position
  created_at, updated_at
}

-- RepoCard: GitHub Repository Card
repocard {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES board,
  status_id uuid REFERENCES statuslist,
  repo_name text NOT NULL,
  repo_owner text NOT NULL,
  order integer,
  meta jsonb,  -- GitHub API metadata cache (stars, language, etc.)
  created_at, updated_at
}

-- ProjectInfo: Extended Project Details
projectinfo {
  id uuid PRIMARY KEY,
  repo_card_id uuid REFERENCES repocard (one-to-one),
  maintenance_id uuid REFERENCES maintenance,  -- Maintenance link
  links jsonb,  -- {type, url, icon}[] - 55 built-in types
  note text,  -- Rich text (Plate Editor, max 20,000 chars)
  comment text,  -- Inline comment (max 2,000 chars)
  comment_color text DEFAULT 'primary',  -- CHECK IN ('primary','blue','green','amber','purple','rose','cyan','neutral')
  created_at, updated_at
}

-- UserLinkPresets: User-defined Link Types
user_link_presets {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  label text NOT NULL,  -- Display label
  value text NOT NULL,  -- Programmatic value
  icon text,            -- Lucide icon name
  created_at, updated_at
}

-- Maintenance: Archived Repositories
maintenance {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  created_at, updated_at
}

-- UserSettings: Per-user Page Customization
user_settings {
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  boards_page_title text,     -- Custom /boards page title (NULL = default)
  boards_page_subtitle text,  -- Custom /boards page subtitle (NULL = default)
  created_at, updated_at
}
```

### 6.2 Frontend State (Redux + localStorage)

```typescript
// Settings Slice (Persistence: localStorage)
interface SettingsState {
  theme: ThemeType // 14 themes + system (ThemeId | 'system')
  compactMode: boolean
  showCardMetadata: boolean // Display stars, language, and last updated on cards
  organizationFilter: string // AddRepositoryCombobox filter ('all' or org login)
  sidebarCollapsed: boolean // Sidebar collapse state (default: false)
}

// Board Slice (Session — not persisted)
interface BoardState {
  activeBoard: SimplifiedBoard | null
  statusLists: StatusListDomain[]
  repoCards: RepoCardForRedux[]
  loading: boolean
  error: string | null
}

// Draft Slice (Persistence: localStorage)
interface DraftState {
  notes: Record<string, DraftNote> // Map of cardId -> DraftNote
}

interface DraftNote {
  cardId: string
  content: string // Rich text JSON string
  links: ProjectLink[] // Draft links
  lastModified: number // Timestamp
}
```

### 6.3 RepoCard Meta (GitHub API)

```typescript
// Fetched from GitHub API, cached in repocard.meta JSONB column
interface RepoCardMeta {
  stars?: number
  updatedAt?: string
  visibility?: 'public' | 'private'
  language?: string
  topics?: string[]
  description?: string
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
- Column width constrained (no expansion to fill available space)

### 7.3 Code Quality

- `noUncheckedIndexedAccess` enabled in tsconfig
- Knip for dead code detection
- ESLint with `react-you-might-not-need-an-effect` plugin
- Storybook for component-level testing & visual review
- `failOnFlakyTests: true` in Playwright config (strict reliability enforcement)
- E2E timeout: 30 seconds (reduced from default)
- Zero `waitForTimeout` in E2E tests (replaced with assertion-based waits)

### 7.4 Security

- Rate limiting on all authenticated Server Actions and edge routes
- Security headers: HSTS, CSP (report-only), X-Frame-Options, Permissions-Policy
- Security event audit trail via Sentry (`logSecurityEvent()`)
- GitHub token cookie TTL aligned with OAuth token expiry, cleared on 401
- Build-time guards prevent test env vars (`APP_ENV=test`, `ENABLE_MSW_MOCK=true`) in Vercel deployments

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

### Phase 1: Basic Features (MVP) ✅

- Board/Kanban basic features
- GitHub OAuth & Repository addition
- Project Info (Notes, Links)

### Phase 2: Full Version ✅

- Complete Maintenance Mode implementation
- 14 theme support (Light 7 + Dark 7)
- Comment on RepoCard feature
- Account management (profile, stats, deletion)
- Favorites feature
- Sidebar collapse

### Phase 3: Polish & Infrastructure

- Navigation progress bar ✅
- Error boundaries & loading states ✅
- Column width constraint ✅
- Dark theme neutral color fix (OKLCH CSS variables) ✅
- Hydration safety (useMounted pattern) ✅
- E2E migration to real Supabase DB ✅
- Dead code cleanup (Knip) ✅
- noUncheckedIndexedAccess strict typing ✅
- Maintenance repo filtering in Add Repository ✅
- Board D&D reorder on /boards page ✅
- Theme CSS variables validation script ✅
- RLS re-enabled with optimized policies ✅
- Rate limiting on auth and API endpoints ✅
- Security headers (CSP, HSTS, Permissions-Policy) ✅
- Security event logging via Sentry ✅
- ActionResult\<T\> discriminated union for Server Actions ✅
- Per-route loading.tsx and error.tsx boundaries ✅
- Delete from Maintenance operation ✅
- CalVer release workflow (GitHub Releases) ✅
- failOnFlakyTests enforcement in Playwright ✅
- Component decomposition (MaintenanceClient, Landing, AddRepositoryCombobox) ✅
- Inline editable board title and subtitle ✅
- Board subtitle edit form and visibility toggle in Board Settings ✅
- Public board sharing (share slug, read-only public view) ✅
- XSS prevention (DOMPurify sanitization, open redirect protection) ✅
- Inline editable boards page header with DB persistence ✅
- user_settings table for per-user page customization ✅

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
  title: {
    default: 'GitBox - GitHub Repository Manager',
    template: '%s | GitBox',
  },
  description: 'Manage GitHub repositories in Kanban board format',
  applicationName: 'GitBox',
  keywords: ['GitHub', 'Kanban', 'Repository', 'Project Management', 'Developer Tools'],
  openGraph: { ... },
  twitter: { card: 'summary_large_image', ... },
}
```

#### PWA Manifest

`app/manifest.ts` enables PWA installation (dynamic manifest generation).

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

#### Local Supabase + GitHub OAuth Setup

Supabase CLI reads environment variables from `supabase/.env` (NOT root `.env`):

```bash
# supabase/.env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

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

### 11.4 Board Card Drag & Drop

#### 11.4.1 Board Card Reorder on /boards Page

```
┌───────────────┐  ┌───────────────┐         ┌───────────────┐  ┌───────────────┐
│ Board A    [≡] │  │ Board B    [≡] │  drag   │ Board B    [≡] │  │ Board A    [≡] │
└───────────────┘  └───────────────┘   →     └───────────────┘  └───────────────┘
       ↓_______________↑                        (A and B swapped, position persisted)
```

| Item          | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Status        | ✅ Implemented                                                |
| E2E Coverage  | ✅ Covered (`board-dnd.spec.ts` - 4 tests)                    |
| Server Action | `updateBoardPositions()`                                      |
| CDP Helper    | `cdpBoardDragAndDrop()`                                       |
| Sensors       | MouseSensor (distance: 8), TouchSensor (delay: 200), Keyboard |
| Collision     | `closestCenter` + `restrictToWindowEdges`                     |
| State         | `useState` + `useOptimistic` dual pattern with error revert   |
| Note          | Disabled on `/boards/favorites` (filtered view)               |

### 11.5 Previously Unimplemented Features

#### 11.5.1 Column Auto-Height (Height Auto-Expansion)

| Item         | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Status       | ✅ Implemented (2025-12-28)                                                |
| E2E Coverage | ✅ Covered (`e2e/kanban.spec.ts` - Column Auto-Height tests)               |
| Files        | `KanbanBoard.tsx`, `SortableColumn.tsx`, `StatusColumn.tsx`, `cdp-drag.ts` |
| Method       | CSS Grid `minmax(min-content, auto)` + height constraint removal           |

### 11.6 E2E Test Coverage Requirements

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
| Column: Width constraint     | ✅ Added (`e2e/kanban-column-width.spec.ts` - 4 tests)         |
| Board: D&D reorder           | ✅ Added (`board-dnd.spec.ts` - 4 tests)                       |
| Board: DB persistence        | ✅ Added (position verified after reload)                      |

### 11.7 CDP Drag Helper List

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
export async function cdpBoardDragAndDrop(
  page,
  sourceBoardId,
  targetBoardId,
  options?,
)
```

---

## 12) Testing Infrastructure

### 12.1 Unit Tests

- **Runner**: Vitest 4 + happy-dom
- **Coverage**: @vitest/coverage-v8
- **React Testing**: @testing-library/react + @testing-library/user-event

### 12.2 E2E Tests (Hybrid Architecture)

- **Runner**: Playwright 1.58
- **Database**: Real local Supabase (not mocked)
- **GitHub API**: MSW mocking (stability for external API)
- **Auth**: Pre-authenticated via `e2e/auth.setup.ts`
- **D&D**: CDP-based helpers (`e2e/helpers/cdp-drag.ts`)
- **DB Reset**: `pnpm db:reset` via `e2e/global-setup.ts` before tests
- **Workers**: 1 (for database state consistency)
- **Timeout**: 30 seconds (test + expect)
- **Flaky Tests**: `failOnFlakyTests: true` (strict enforcement, 2 retries)
- **No `waitForTimeout`**: All waits use assertion-based patterns (`expect().toPass()`, `waitFor`)

### 12.3 Storybook

- **Version**: Storybook 10 (@storybook/nextjs-vite)
- **Addons**: a11y, docs, vitest, chromatic
- **MSW**: msw-storybook-addon for API mocking

### 12.4 E2E Test Spec Files

| Category    | File                                       | Description                  |
| ----------- | ------------------------------------------ | ---------------------------- |
| Kanban D&D  | `kanban-dnd/card-dnd.spec.ts`              | Card drag & drop             |
| Kanban D&D  | `kanban-dnd/column-dnd.spec.ts`            | Column drag & drop           |
| Kanban      | `kanban-basic.spec.ts`                     | Basic kanban operations      |
| Kanban      | `kanban-scroll.spec.ts`                    | Scroll behavior              |
| Kanban      | `kanban-auto-height.spec.ts`               | Column auto-height           |
| Kanban      | `kanban-column-width.spec.ts`              | Column width constraint      |
| Kanban      | `kanban-column-edit.spec.ts`               | Column edit operations       |
| Board       | `board-dnd.spec.ts`                        | Board card D&D reorder       |
| Board       | `board-settings.spec.ts`                   | Board settings dialog        |
| Board       | `board-settings-card-display.spec.ts`      | Card display settings        |
| Board       | `board-settings-subtitle.spec.ts`          | Subtitle edit & visibility   |
| Board       | `board-header-inline-edit.spec.ts`         | Inline editable board header |
| Board       | `boards-page-header-inline-edit.spec.ts`   | Boards page header edit      |
| Board       | `create-board.spec.ts`                     | Board creation               |
| Board       | `boards.spec.ts`                           | Board list                   |
| Board       | `favorites.spec.ts`                        | Favorites feature            |
| Account     | `account-deletion.spec.ts`                 | Account deletion flow        |
| Repo        | `add-repository-combobox.spec.ts`          | Add repository combobox      |
| Repo        | `add-repository-pagination.spec.ts`        | Repository pagination        |
| Repo        | `repo-card-display.spec.ts`                | Card display                 |
| Repo        | `repo-card-description.spec.ts`            | Card description             |
| Repo        | `remove-from-board.spec.ts`                | Remove card from board       |
| Comment     | `comment-display.spec.ts`                  | Comment display              |
| Comment     | `comment-inline-edit.spec.ts`              | Comment inline editing       |
| Comment     | `comment-color-theme-independence.spec.ts` | Color theme independence     |
| Note        | `note-modal.spec.ts`                       | Note modal (rich text)       |
| Links       | `project-info-links.spec.ts`               | Project info links           |
| Maintenance | `maintenance-back-to-board.spec.ts`        | Back to board                |
| Maintenance | `maintenance-project-info.spec.ts`         | Maintenance project info     |
| Settings    | `settings.spec.ts`                         | Settings page                |
| Theme       | `sidebar-theme-toggle.spec.ts`             | Theme toggle                 |
| Theme       | `theme-persistence.spec.ts`                | Theme persistence            |
| Theme       | `theme-visual-application.spec.ts`         | Theme visual application     |
| Sidebar     | `sidebar-collapse.spec.ts`                 | Sidebar collapse             |
| SSR         | `ssr-hydration-board.spec.ts`              | SSR hydration (board)        |
| Page        | `page-titles.spec.ts`                      | Page titles                  |
| Unauth      | `landing.spec.ts`                          | Landing page                 |
| Unauth      | `login.spec.ts`                            | Login page                   |
| Unauth      | `page-titles.spec.ts`                      | Unauthenticated page titles  |
| Unauth      | `ssr-hydration.spec.ts`                    | SSR hydration (unauth)       |
| Security    | `xss-smoke.spec.ts`                        | XSS injection prevention     |

---

## 13) Release & CI/CD

### 13.1 CalVer Release Workflow

- **Format**: `YYYY.M.DD` (no zero-padding, no `v` prefix)
- **Same-day suffix**: `2026.2.16`, `2026.2.16.1`, `2026.2.16.2`
- **Trigger**: Every push to `main` (= every PR merge)
- **Release notes**: Auto-generated from PR titles (`gh release create --generate-notes`)
- **No package.json sync**: Version stays `0.2.0`, CalVer is tag-only (web app, not distributed)
- **Workflow**: `.github/workflows/release.yml` (pure `gh` CLI, zero dependencies)

### 13.2 Build-Time Safety Guards

- `next.config.ts` throws `FATAL` error if test env vars are present in Vercel builds
  - `APP_ENV=test` → blocks (would bypass all authentication)
  - `NEXT_PUBLIC_ENABLE_MSW_MOCK=true` → blocks (would enable mock data)
- Only guard `VERCEL` env (E2E CI intentionally uses `APP_ENV=test` + `next build`)

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
- [nextjs-toploader](https://github.com/TheSGJ/nextjs-toploader)
- [Plate.js](https://platejs.org/)
