# GitBox — Specification v1.5 (2026-02-27)

## 1) Product Overview

- **Language**: English
- **Landing Page**: Login/Sign-in buttons

### Navigation Flow

**Auth (GitHub OAuth)** → **Home (Boards)** → **Board (Kanban)** → **Card Detail (right panel)**

### Main Screens

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
| UI Library | React 19.3                                           |
| Language   | TypeScript 7 (strict, noUncheckedIndexedAccess)      |
| Styling    | Tailwind CSS 4 + shadcn/ui (OKLCH tokens)            |
| State      | Redux Toolkit + @laststance/redux-storage-middleware |
| Database   | Supabase (PostgreSQL + Auth + RLS)                   |
| Rich Text  | Plate.js (Platejs 53)                                |
| D&D        | @dnd-kit (core + sortable + modifiers)               |
| Testing    | Vitest 5, Playwright 1.63, Storybook 10              |
| Monitoring | Sentry 11                                            |
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
- **One repository, one card per user** ([#215](https://github.com/laststance/gitbox/issues/215)): a repository can sit on at most one of a user's boards. Identity is `owner/name`, case-insensitive. The database enforces it.
- **Shared board**: on a board that is shared by a public link, the combobox says above its buttons that anyone who has the link will see the added repositories with their descriptions
- **Already placed elsewhere**: the combobox lists repos held by another board (`On <board name>`) under their own heading, each with a link to that board, instead of offering them. Repos on the current board stay hidden. Placements are fetched every time the combobox opens.
- **Panel**: the combobox panel is 480px wide. From 640px of window width it stands below the Add Repositories button and ends at the right edge of the header, so all of it is on the page; below 640px it spans the screen. It ends above the bottom edge of the window, however far down its button stands: its two lists give up height and scroll by themselves, and the search box and Cancel / Add stay in view. Where less than 26rem would be left below the button, the panel moves up over the header instead, as far as the top edge of the window; and it follows its button when the header changes while the panel is open (the sidebar opens, the title is edited)
- **First Board auto-creation**: On sign-in, a user who has no board gets a board named "First Board" with the Software Release columns (`createFirstBoardIfNeeded` in the OAuth callback; the board and its columns are written together by the `create_board_with_status_lists` database function)

#### Acceptance Criteria

- No delay displaying candidates with 100+ repos
- D&D/Undo works smoothly
- Organization selection persists across sessions
- A repo held by another board cannot be added or moved in as a duplicate; the UI names the holding board

### 3.2 Board (Kanban)

#### Specifications

- **Column = Status** (e.g., Suspend / Spec designing / Active / Completed)
- Column CRUD operations (2D grid layout: gridRow, gridCol)
- **Column Width Constraint**: CSS variable `--column-width: 320px`, `minmax(280px, var(--column-width))`
- **Card**: repo name, quick note, optional meta (Stars/Updated/Visibility/Language/Topics)
- **⋯ (Overflow menu)**: external links, Move to Another Board and Remove from Board (see 4.1). Notes and links open from the card's Note button
- **A save without an answer**: a drag, an undo or a removal that gets no answer from the server within 15 seconds stays on screen. A notice says that the change could not be confirmed and offers **Reload page**, and the board is fetched again once the request has settled
- **Favorites**: Add board to favorites (star icon, prioritized in sidebar)
- **Board Subtitle**: Optional description below board title (max 100 chars, inline editable)
- **Inline Editable Header**: Board title and subtitle are click-to-edit (`InlineEditableText` component)
- **Names without a space**: a board name, a column name, a repository name, a subtitle or the title of the boards page that is one long word (snake_case, no hyphen) breaks where its line ends: in the header of a board, in a column header, on a card, on a board's card in the boards list, in a dialog and in the lists of boards and columns of the move dialog. The controls beside it stay in reach (the buttons of the board header, "Column options", the menu of a card, "Create Board"), and a dialog and its lists stay as wide as the screen on a phone. A select shows one line of the chosen name. An ordinary word is not broken to make room: a board name of one word that fits its card stays on one line there (it may run on under the star and the menu of the card), and so does a title of the boards page that fits the line
- **Boards page header**: the title and the subtitle are click-to-edit. From 640px on "Create Board" stands at the right end of their row; below 640px it stands under them, as the buttons of a board's header do
- **Board Settings**: 4-tab dialog (General, Cards, Sharing, Danger Zone). On a phone, where the dialog is as wide as the screen, the tabs take a second row, so the dialog does not scroll sideways
  - **General**: Rename board, subtitle edit form, "Show Subtitle" visibility toggle
  - **Cards**: Card display settings (description, comment, font size/weight)
  - **Sharing**: Public board toggle, share link generation/copy, and a line that says what the link shows (board name, subtitle, columns, each repository's name, description, language and stars) and what it hides (comments, notes, links)
  - **Danger Zone**: Delete board with confirmation
- **Public Board Sharing**: Make boards publicly viewable via unique share slug (read-only for visitors)
- **Copy Link** (board header): Copies the public share link while the board is shared; otherwise the board's own address, with a note that only the owner can open it
- **Move to Another Board**: Move repo cards between boards via dialog (DB RPC `move_card_to_board`). The card keeps its note, links and comment, so this is how a repository is set aside and brought back: move it to a board of your own, and move it again later
  - The dialog can create the destination board: **New Board...** under the board selector, or the create form directly when the user has no other board. A board made there has one column, "Repositories"
  - The dialog opens on the board the last move from this board went to, when that board is still offered (remembered in this browser). Without one it opens on the newest board that is not shared by a public link
  - A board that is shared by a public link carries the mark of a public board in the list. When it is the destination, the dialog says that anyone who has the link will see the repository there with its description, and that notes, links and comments stay private
  - The columns of the destination are listed in the order its board shows them, and the first one (the left-most of the first row) is selected until another is picked
  - While the move or a board creation waits for the server the dialog stays open and its controls are disabled. After 15 seconds without an answer it says that the outcome could not be confirmed and can be closed again. After every move that was not confirmed the board is fetched again, and the same move can be sent a second time without harm. That fetch waits until the request has settled, so the dialog offers **Reload page** next to the message of a move with an unknown outcome. A move the server itself could not confirm (the database gave it no answer) is shown the same way
  - A board creation that could not be confirmed is not sent a second time from the dialog, because the board may exist: **Reload boards** loads the list again and shows it. When the creation got no answer in 15 seconds its request is still running and that load would wait behind it, so **Reload page** takes the place of Reload boards
  - The keyboard focus is on the Board select once the boards are loaded, and after a request that did not go through on the control needed next (Move, the name field, Reload boards, Reload page)
- **Remove from Board**: Deletes the card together with its note, links and comment, after a confirmation. The repository on GitHub is not affected
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
- A card moved to another board keeps its note, links and comment

### 3.3 Project Note (Rich Text Notes)

Full-featured WYSIWYG editor accessible from each RepoCard's Note button.

#### Specifications

- **Plate Editor**-based rich text editor (Platejs 53)
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

### 3.4 Project Info (Modal)

Accessible from all RepoCards.

#### Sections

1. **Comment** (inline comment, max 2,000 chars. Displayed on RepoCard. See 3.5)

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

### 3.5 Comment on RepoCard (Inline Comment)

Display free-text status comments on RepoCard in Card-in-Card style.

#### Specifications

- **Inline display**: Show comment directly on RepoCard (no modal needed)
- **Card-in-Card UI**: Left border accent + background color for visual distinction
- **Full text display**: No truncation, card height expands with content
- **Inline editing**: Click to edit directly, 2,000 character limit
- **Color customization**: 8 colors available (primary/blue/green/amber/purple/rose/cyan/neutral)
- **Per-comment color**: Color stored per comment in `projectinfo.comment_color`
- **Actions menu**: Edit, Color and Delete, from a button on the comment (shown on hover and on focus, and always where the main pointer is a finger). The colors open on hover, on a click or a tap, and from the keyboard. Of the menu, only Edit opens the editor: neither its button nor Color, a color or Delete does

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

### 3.6 Sidebar Collapse

#### Specifications

- **Toggle Button**: Button in the sidebar's header to expand/collapse: beside the name while the sidebar is expanded from 768px, in a row of its own under the logo as the 64px rail and as the sidebar that lies over the page
- **Expanded State**: Width 256px (w-64), full text display
- **Collapsed State**: Width 64px (w-16), icons only
- **Transition Animation**: 300ms ease-out smooth width change
- **Tooltips**: On collapse, tooltip on hover for each nav item (side="right")
- **State Persistence**: Persisted to localStorage via Redux Storage Middleware
- **Hydration Safety**: `useMounted()` guard pattern to prevent SSR mismatch

#### Technical Specifications

- **useSidebar Hook**: Mounted state management for hydration safety
- **CSS**: `transition-[width] duration-300 ease-out`
- **Responsive**: Below 768px the sidebar is the 64px icon rail at the left edge, whatever state is stored, and the page lies beside it. The toggle opens the full sidebar over the page, which keeps its place; the backdrop, Escape, a link of the sidebar and a second press on the toggle, which stays where it was in the rail, close it again. The sidebar is as high as the part of the screen that is in view. This opened state is not stored
- **SSR**: Renders expanded (default) state on server, applies persisted state after mount

#### Acceptance Criteria

- Instant state change on toggle button click
- Smooth animation (60fps)
- All navigation functional when collapsed
- State persists after page reload
- Tooltips display correctly when collapsed
- No hydration mismatch errors

### 3.7 Account Management

#### Specifications

- **Profile display**: GitHub avatar, username, email
- **Statistics display**: Board count, card count
- **Account deletion**: Confirmation flow with "DELETE" input for complete account deletion

#### Acceptance Criteria

- Profile info correctly fetched from GitHub auth
- All related data deleted on account deletion
- Deletion confirmation requires exact "DELETE" match

### 3.8 Navigation Progress Bar

#### Specifications

- **Library**: `nextjs-toploader`
- **Style**: Algora-style green bar (`oklch(0.696 0.17 162.48)`)
- **Configuration**: Height 3px, no spinner, crawl enabled, speed 200ms
- **Z-index**: 9999 (above all content)

#### Acceptance Criteria

- Progress bar shows on page navigation
- Does not interfere with modal/dialog overlays

### 3.9 Error & Loading States

#### Specifications

- **Error Boundary** (`src/app/error.tsx`): Global error boundary with Sentry integration
  - Retry and "Go to Boards" recovery actions
- **Global Error** (`src/app/global-error.tsx`): Root-level error boundary
- **Board Loading** (`src/app/board/[id]/loading.tsx`): Skeleton UI matching KanbanBoard layout
  - CardSkeleton, ColumnSkeleton components
- **Per-Route Boundaries**: All route segments have dedicated `loading.tsx` and `error.tsx`
  - Routes: `/boards`, `/board/[id]`, `/settings`, `/account`

### 3.10 Rate Limiting

#### Specifications

- **Algorithm**: Sliding window, in-memory per-process
- **Scope of a count**: one server instance. Production runs many, so a client gets a multiple of the configured number through before it is refused
- **Bypass**: Disabled in test mode (`APP_ENV=test`)
- **Edge**: Fixed-window variant in `proxy.ts` for the OAuth callback and the Sentry tunnel. The tunnel limit also applies in test mode

#### Rate Limit Configuration

| Key                | Max Requests | Window | Scope                 |
| ------------------ | ------------ | ------ | --------------------- |
| `auth/callback`    | 10           | 1 min  | OAuth callback (edge) |
| `signInWithGitHub` | 10           | 1 hour | GitHub OAuth login    |
| `deleteAccount`    | 3            | 1 hour | Account deletion      |
| `githubApi`        | 30           | 1 min  | GitHub API proxy      |
| `addReposToBoard`  | 10           | 1 min  | Add repository        |
| `batchDnD`         | 60           | 1 min  | D&D batch operations  |
| `boardCrud`        | 20           | 1 min  | Board CRUD            |
| `userSettings`     | 20           | 1 min  | User settings         |
| `publicBoardView`  | 60           | 1 min  | Shared board view     |
| `sentryTunnel`     | 120          | 1 min  | Error reports (edge)  |

#### Integration

- **Server Actions**: `withAuthResultRateLimit(key, action)` wrapper
- **Edge (proxy.ts)**: `edgeRateLimit(ip, max, window)` → HTTP 429 + `Retry-After: 60`
- **Identifier**: User ID (authenticated) or IP (unauthenticated)
- **Error**: `"Too many {description} requests. Please try again later."`

### 3.11 Security

#### Security Headers (next.config.ts)

| Header                                | Value                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `X-DNS-Prefetch-Control`              | `on`                                                                         |
| `Strict-Transport-Security`           | `max-age=63072000; includeSubDomains; preload`                               |
| `X-Frame-Options`                     | `SAMEORIGIN`                                                                 |
| `X-Content-Type-Options`              | `nosniff`                                                                    |
| `Referrer-Policy`                     | `strict-origin-when-cross-origin`                                            |
| `Permissions-Policy`                  | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()` |
| `Content-Security-Policy-Report-Only` | Report-only CSP (see below)                                                  |

#### CSP Directives (Report-Only)

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com https://github.com data: blob:;
connect-src 'self' https://*.supabase.co http://127.0.0.1:* https://api.github.com https://*.ingest.us.sentry.io https://vitals.vercel-insights.com;
font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
upgrade-insecure-requests; report-uri <SENTRY_CSP_REPORT_URI>
```

`SENTRY_CSP_REPORT_URI` is the security endpoint of this app's Sentry project, derived from `SENTRY_DSN` in `src/lib/constants/sentry.ts`. `upgrade-insecure-requests` has no effect while the policy is report-only.

#### Security Event Logging

Sentry-based audit trail via `logSecurityEvent()` (`src/lib/security-events.ts`).

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

### 3.12 Server Action Pattern

#### ActionResult\<T\> Discriminated Union

Standardized return type for client-consumed Server Actions (`src/lib/actions/types.ts`).

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode?: ActionErrorCode }

type ActionErrorCode =
  'GITHUB_TOKEN_MISSING' | 'BOARD_CREATION_UNCONFIRMED' | 'MOVE_UNCONFIRMED'
```

`error` is the sentence the user reads. `errorCode` is set only where the browser has to tell one failure from another, and the browser branches on the code, never on the sentence. It signs in again without asking (`GITHUB_TOKEN_MISSING`). Or it treats the outcome as unknown: the board may exist, because the database gave the server no answer or one the server could not read (`BOARD_CREATION_UNCONFIRMED`), or the card may have moved, because the database gave no answer (`MOVE_UNCONFIRMED`).

#### Auth Guard Wrappers (`src/lib/actions/auth-guard.ts`)

| Wrapper                     | Auth | Rate Limit | Returns                         |
| --------------------------- | ---- | ---------- | ------------------------------- |
| `withAuthResult()`          | Yes  | No         | `ActionResult<T>`               |
| `withAuthResultRateLimit()` | Yes  | Yes        | `ActionResult<T>` (recommended) |
| `withAuthRateLimit()`       | Yes  | Yes        | Throws on failure               |

---

## 4) Interactions

### 4.1 Overflow "⋯" Menu

Three-dot menu on each RepoCard opens "Overflow menu" for quick actions ([Material Design](https://m3.material.io/components/menus/guidelines))

#### Menu Items

```
Open on GitHub
Open Production URL
Open Tracking dashboard
Open Supabase dashboard
Move to Another Board   // Dialog with board selector; keeps the note, links and comment
Remove from Board       // Destructive, confirmation dialog; deletes the card with its note, links and comment
```

### 4.2 Shortcuts (Unified)

- `.` — Focused card's Overflow menu
- `Enter` — Open card
- `⌘K` / `Ctrl+K` — Command Palette
- `Z` — Undo last operation (not while a dialog, a menu, a list of options, the command palette or the Add Repositories panel is open, and not while the sidebar lies over the page on a phone)
- `Tab` — Focus navigation
- `Escape` — Close the topmost menu, list or dialog. In the Add Repositories panel the open list of organizations closes first, and the panel with the next press
- `?` — Shortcuts help

---

## 5) UI Specifications (Text Wireframes)

### 5.1 Sidebar (All Screens, Collapsible)

#### Expanded State (256px / w-64)

```
┌───────────────────────────────┐
│ [Logo] GitBox             [«]  │  ← Collapse toggle button, beside the name
│ ───────────────────────────── │
│ Boards                    [▼]  │  ← Collapsible
│  • All Boards                  │
│  • Favorites                   │
│ ───────────────────────────── │
│ Settings                       │
│ Shortcuts                      │
│ Theme: [Sunrise ▾]             │  ← Global theme selector (14 themes + System)
│ ───────────────────────────── │
│ [Avatar] User name             │  ← Account: profile, stats, deletion
│ Sign Out                       │
└───────────────────────────────┘
```

#### Collapsed State (64px / w-16)

```
┌────────┐
│ [Logo] │
│ ────── │
│  [»]   │  ← Expand toggle button, in a row of its own under the logo
│ ────── │
│  [📋]  │  ← All Boards (Tooltip: "All Boards")
│  [⭐]  │  ← Favorites (Tooltip: "Favorites")
│ ────── │
│  [⚙️]  │  ← Settings (Tooltip: "Settings")
│  [⌨️]  │  ← Shortcuts (Tooltip: "Shortcuts")
│  [🎨]  │  ← Theme (Tooltip: "Theme")
│ ────── │
│  [👤]  │  ← Account (Tooltip: the user's name)
│  [🚪]  │  ← Sign Out (Tooltip: "Sign Out")
└────────┘
```

#### Specifications

| Item          | Expanded                       | Collapsed                    |
| ------------- | ------------------------------ | ---------------------------- |
| Width         | 256px (w-64)                   | 64px (w-16)                  |
| Text          | Full display                   | Hidden                       |
| Icons         | Left of text                   | Centered                     |
| Tooltip       | None                           | Right side on hover          |
| Toggle button | Icon, named "Collapse sidebar" | Icon, named "Expand sidebar" |

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

### 5.4 Settings

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

- **Access**: Sidebar Theme dropdown. Its list opens beside the sidebar; in the sidebar that lies over the page below 768px it opens below its button, where all of it is on the screen
- **Scope**: App-wide (no board-specific settings)
- **14 themes + System**: Light 7 + Dark 7 + OS preference follow

**Display Settings**:

- **Compact Mode**: Reduce card/column padding for higher information density
- **Show Card Metadata**: Toggle stars, language, update date visibility

**Persistence**: Redux + localStorage (`@laststance/redux-storage-middleware`)

### 5.5 NoteModal (Rich Text Editor)

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
  color text,                  -- #RRGGBB or NULL (CHECK statuslist_color_hex)
  order integer,
  grid_row integer DEFAULT 0,  -- 2D grid row position
  grid_col integer DEFAULT 0,  -- 2D grid column position
  created_at, updated_at
}

-- RepoCard: GitHub Repository Card
repocard {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES board,
  status_id uuid REFERENCES statuslist,  -- must be a column of board_id (trigger check_repocard_status_board; a statuslist cannot change boards)
  repo_name text NOT NULL,
  repo_owner text NOT NULL,
  order integer,
  meta jsonb,  -- GitHub API metadata cache (stars, language, etc.)
  user_id uuid NOT NULL REFERENCES auth.users,  -- always the board owner (trigger set_repocard_user_id)
  created_at, updated_at,
  UNIQUE (board_id, repo_owner, repo_name),                  -- unique_repo_per_board
  UNIQUE (user_id, lower(repo_owner), lower(repo_name))      -- repocard_unique_repo_per_user (#215)
}

-- ProjectInfo: Extended Project Details
projectinfo {
  id uuid PRIMARY KEY,
  repo_card_id uuid NOT NULL REFERENCES repocard (one-to-one),  -- a note, its links and its comment always belong to a card and go with it
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
  moveDestinationByBoard?: Record<string, string> // Source board id → destination of the last move from it (Move to Another Board opens on it)
}

// Board Slice (not persisted: the board on screen; the server sends it with every page and it is replaced when a board opens)
interface BoardState {
  statusLists: StatusListDomain[]
  repoCards: RepoCardForRedux[]
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
  githubId?: number // GitHub repo id reported by the browser; untrusted hint
}
```

---

## 7) Quality Assurance

### 7.1 Accessibility & Visual Tests (Automated)

- Measure **contrast** across 14 themes × representative screens (Board/Modal)
- Standards: small text 4.5:1, UI 3:1
- **Build fails if not met** (aligns with axe rules)
- Reference: [Deque University](https://dequeuniversity.com/rules/axe/4.8/color-contrast)

### 7.2 Performance Requirements

- No delay displaying candidates with 100+ repositories
- D&D/Undo operations work smoothly
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
- Build-time guards prevent test env vars (`APP_ENV=test`, `NEXT_PUBLIC_ENABLE_MSW_MOCK=true`) in Vercel deployments

---

## 8) Acceptance Criteria (Integrated)

### Common

- **Overflow menu** opens with the shortcut (`.`) on the focused card
- The Note modal (notes and links) opens from the Note button of every RepoCard, and with Enter on the focused card

### Accessibility

- All 14 themes meet **4.5:1** for body text, **3:1+** for UI elements (includes automated tests)
- The keyboard focus stays on the board when a dialog opened from a card's menu closes: on the card after Cancel, and after Move to Another Board or Remove from Board on the next card of the column (the card above when it was the last one, the column's "Add Repo" button when it was the only one). The same holds when a move without a confirmation went through all the same and the card is gone by the time its dialog is closed

---

## 9) Implementation Phases

### Phase 1: Basic Features (MVP) ✅

- Board/Kanban basic features
- GitHub OAuth & Repository addition
- Project Info (Notes, Links)

### Phase 2: Full Version ✅

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
- Board D&D reorder on /boards page ✅
- Theme CSS variables validation script ✅
- RLS re-enabled with optimized policies ✅
- Rate limiting on auth and API endpoints ✅
- Security headers (CSP, HSTS, Permissions-Policy) ✅
- Security event logging via Sentry ✅
- ActionResult\<T\> discriminated union for Server Actions ✅
- Per-route loading.tsx and error.tsx boundaries ✅
- CalVer release workflow (GitHub Releases) ✅
- failOnFlakyTests enforcement in Playwright ✅
- Component decomposition (Landing, AddRepositoryCombobox) ✅
- Inline editable board title and subtitle ✅
- Board subtitle edit form and visibility toggle in Board Settings ✅
- Public board sharing (share slug, read-only public view) ✅
- XSS prevention (DOMPurify sanitization, open redirect protection) ✅
- Inline editable boards page header with DB persistence ✅
- user_settings table for per-user page customization ✅
- Move to Another Board feature (dialog with board selector) ✅
- Auth guard unification (withAuth removed, 3 wrappers remain) ✅
- NoteModal decomposition (NoteSection, LinkManager, useNoteModalDraft) ✅
- KanbanBoard God Component decomposition into focused hooks ✅
- Postgres best practices hardening migration ✅
- 404 page, empty states, and hover state UX improvements ✅
- Toast feedback for silent success operations ✅

---

## 10) Platform Requirements

### 10.1 Web Fundamentals (PWA & Meta)

#### Open Graph / Twitter Card

Social media preview images and metadata.

| Item             | File                          | Size     |
| ---------------- | ----------------------------- | -------- |
| OG Image         | `src/app/opengraph-image.tsx` | 1200×630 |
| Twitter Card     | `src/app/twitter-image.tsx`   | 1200×600 |
| Favicon          | `src/app/icon.svg`            | SVG      |
| Apple Touch Icon | `src/app/apple-icon.tsx`      | 180×180  |

#### Metadata Configuration

```typescript
// src/app/layout.tsx
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

`src/app/manifest.ts` enables PWA installation (dynamic manifest generation).

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
| Preview     | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod) |
| Development | `.env` with the local Supabase credentials                         |

### 10.3 Backend (Supabase)

#### Environment Separation

| Environment | Supabase Project                           | Purpose                            |
| ----------- | ------------------------------------------ | ---------------------------------- |
| Local       | `http://127.0.0.1:54321` (Docker)          | Local dev (`localhost:3008`)       |
| Production  | `https://zfcwvzazzzsefbkztsyp.supabase.co` | Production and preview deployments |

#### GitHub OAuth Configuration

The local stack and the production project each use their own GitHub OAuth App, because their callback URLs differ:

| Setting                | Local                                     | Production                                                  |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| GitHub OAuth App       | `GitBox Local Dev`                        | `GitBox Tokyo`                                              |
| Authorization callback | `http://127.0.0.1:54321/auth/v1/callback` | `https://zfcwvzazzzsefbkztsyp.supabase.co/auth/v1/callback` |

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
3. Test locally: `pnpm db:reset` applies every migration to a fresh local database
4. Merge to `main` → Production deploys via GitHub Actions

The workflow (`.github/workflows/supabase-production.yml`) installs a pinned Supabase CLI version. The pin and the local CLI are raised together.

#### RLS (Row Level Security)

All tables have RLS enabled. Users can only access their own data via `user_id` match.

A shared board (`is_public`) is the one exception, and it does not go through the tables: visitors read it with the `get_public_board(p_slug)` function, which returns the name and subtitle of the board with that share slug, its columns and its cards, without any `user_id`. Public boards cannot be listed.

---

## 11) Drag & Drop Specification

### 11.1 Technical Constraints

#### What a Drag Listens For

The board's sensors listen for mouse, touch and key events, not for pointer events (`OwnElementMouseSensor`, `OwnElementTouchSensor` and `OwnElementKeyboardSensor` in `src/lib/utils/own-element-sensors.ts`). @dnd-kit never reads `event.isTrusted`: a drag starts from a mouse press that travels more than 8px, from a finger that rests 200ms without moving more than 6px, and from Space or Enter.

| Event Source                                      | D&D Works                   |
| ------------------------------------------------- | --------------------------- |
| Real user interaction                             | ✅ Works                    |
| Playwright CDP helper (`e2e/helpers/cdp-drag.ts`) | ✅ Works                    |
| Playwright `page.mouse` (down, move in steps, up) | ✅ Works                    |
| A finger through `Input.dispatchTouchEvent`       | ✅ Works                    |
| Mouse events that a script dispatches             | ✅ Lift the card            |
| Pointer events that a script dispatches           | ❌ Ignored: nothing listens |
| Claude Chrome MCP `left_click_drag`               | ❌ Recorded as not dragging |

**E2E Testing**: A drag and drop uses the Playwright CDP helper (`e2e/helpers/cdp-drag.ts`), which moves in steps and pauses before it releases. `page.mouse` sends its events through the same protocol, so a press that it moves in steps is a drag too (`what-starts-a-drag.spec.ts`). A finger that rests is sent with `Input.dispatchTouchEvent`: `tap()` lifts at once. @dnd-kit starts to listen for the keys of a keyboard drag in a timeout of its own, so a test lets one timeout of the page pass between the key that lifts and the next key

#### What Starts a Drag

A card and a column header are picked up by a press or a key on themselves: a mouse that moves more than 8px while it is down, a finger that rests 200ms, or Space or Enter. On the card itself Enter opens the note: of a card's two stops of the Tab key, Enter picks it up from the outer one only. Two things take presses and keys of their own and never pick them up:

- A menu or a dialog of the card or the column. It is drawn elsewhere on the page, and React hands its events up to the element that rendered it all the same.
- A button, a link or a field inside the card or the header, such as "Open note" and "Column options". With @dnd-kit's own sensors a mouse that slipped more than 8px on "Open note", a finger that rested 200ms on it and Enter on it picked the card up, and the note did not open. The open comment editor counts as a whole (`data-no-drag`): its counter and the space around its field are neither a field nor a button.

The three sensors of the board ask `mayStartDrag` (`src/lib/utils/may-start-drag.ts`) before they start. A comment is no button in this sense, although a click opens its editor: it is most of a card's surface, and a card is picked up there as anywhere else.

#### A Cancelled Drag

Escape cancels a drag, and so do a window that is resized or hidden during the drag and a touch that the browser takes over. Nothing is saved, and the board leaves the state of the drag: the drop zones of a column drag (new row, empty places) go away. @dnd-kit reports a cancelled drag to `onDragCancel` and not to `onDragEnd`, so the board handles both (`handleDragCancel` of `useKanbanDnD`).

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

- **Runner**: Vitest 5 + happy-dom
- **Coverage**: @vitest/coverage-v8
- **React Testing**: @testing-library/react + @testing-library/user-event

### 12.2 E2E Tests (Hybrid Architecture)

- **Runner**: Playwright 1.63
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

| Category   | File                                       | Description                           |
| ---------- | ------------------------------------------ | ------------------------------------- |
| Kanban D&D | `kanban-dnd/card-dnd.spec.ts`              | Card drag & drop                      |
| Kanban D&D | `kanban-dnd/column-dnd.spec.ts`            | Column drag & drop                    |
| Kanban D&D | `what-starts-a-drag.spec.ts`               | Menus and buttons do not start a drag |
| Kanban     | `kanban-basic.spec.ts`                     | Basic kanban operations               |
| Kanban     | `kanban-scroll.spec.ts`                    | Scroll behavior                       |
| Kanban     | `kanban-auto-height.spec.ts`               | Column auto-height                    |
| Kanban     | `kanban-column-width.spec.ts`              | Column width constraint               |
| Kanban     | `kanban-column-edit.spec.ts`               | Column edit operations                |
| Board      | `board-dnd.spec.ts`                        | Board card D&D reorder                |
| Board      | `board-settings.spec.ts`                   | Board settings dialog                 |
| Board      | `board-settings-card-display.spec.ts`      | Card display settings                 |
| Board      | `board-settings-subtitle.spec.ts`          | Subtitle edit & visibility            |
| Board      | `board-settings-narrow-viewport.spec.ts`   | Board settings on a 375px phone       |
| Board      | `board-header-inline-edit.spec.ts`         | Inline editable board header          |
| Board      | `boards-page-header-inline-edit.spec.ts`   | Boards page header edit               |
| Board      | `create-board.spec.ts`                     | Board creation                        |
| Board      | `boards.spec.ts`                           | Board list                            |
| Board      | `favorites.spec.ts`                        | Favorites feature                     |
| Account    | `account-deletion.spec.ts`                 | Account deletion flow                 |
| Repo       | `add-repository-combobox.spec.ts`          | Add repository combobox               |
| Repo       | `add-repository-pagination.spec.ts`        | Repository pagination                 |
| Repo       | `repo-card-display.spec.ts`                | Card display                          |
| Repo       | `repo-card-description.spec.ts`            | Card description                      |
| Repo       | `remove-from-board.spec.ts`                | Remove card from board                |
| Repo       | `one-repo-across-boards.spec.ts`           | One repo per user (#215)              |
| Repo       | `move-to-another-board.spec.ts`            | Move card between boards              |
| Comment    | `comment-display.spec.ts`                  | Comment display                       |
| Comment    | `comment-inline-edit.spec.ts`              | Comment inline editing                |
| Comment    | `comment-color-theme-independence.spec.ts` | Color theme independence              |
| Comment    | `comment-actions-menu.spec.ts`             | Comment menu (pointer, keys)          |
| Note       | `note-modal.spec.ts`                       | Note modal (rich text)                |
| Links      | `project-info-links.spec.ts`               | Project info links                    |
| Settings   | `settings.spec.ts`                         | Settings page                         |
| Theme      | `sidebar-theme-toggle.spec.ts`             | Theme toggle                          |
| Theme      | `theme-persistence.spec.ts`                | Theme persistence                     |
| Theme      | `theme-visual-application.spec.ts`         | Theme visual application              |
| Sidebar    | `sidebar-collapse.spec.ts`                 | Sidebar collapse                      |
| Sidebar    | `sidebar-narrow-viewport.spec.ts`          | Sidebar below 768px                   |
| Layout     | `names-that-cannot-break.spec.ts`          | Long names and ordinary words         |
| SSR        | `ssr-hydration-board.spec.ts`              | SSR hydration (board)                 |
| Page       | `page-titles.spec.ts`                      | Page titles                           |
| Unauth     | `landing.spec.ts`                          | Landing page                          |
| Unauth     | `login.spec.ts`                            | Login page                            |
| Unauth     | `page-titles.spec.ts`                      | Unauthenticated page titles           |
| Unauth     | `public-board.spec.ts`                     | Public board (read-only)              |
| Unauth     | `public-board-data-access.spec.ts`         | Public board database access          |
| Unauth     | `ssr-hydration.spec.ts`                    | SSR hydration (unauth)                |
| Security   | `xss-smoke.spec.ts`                        | XSS injection prevention              |

---

## 13) Release & CI/CD

### 13.1 CalVer Release Workflow

- **Format**: `YYYY.M.DD` (no zero-padding, no `v` prefix)
- **Same-day suffix**: `2026.2.16`, `2026.2.16.1`, `2026.2.16.2`
- **Trigger**: Every push to `main` (= every PR merge)
- **Release notes**: Auto-generated from PR titles (`gh release create --generate-notes`)
- **The tag is not the app version**: CalVer is tag-only (web app, not distributed). The app version lives in `VERSION` and `CHANGELOG.md` (four parts, e.g. `0.4.2.0`) and in `package.json` (its first three parts)
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
- [GitHub Docs - Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/)
- [Supabase Docs](https://supabase.com/docs/)
- [Deque University - Color Contrast](https://dequeuniversity.com/rules/axe/4.8/color-contrast)
- [nextjs-toploader](https://github.com/TheSGJ/nextjs-toploader)
- [Plate.js](https://platejs.org/)
