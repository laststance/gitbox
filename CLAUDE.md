# CLAUDE.md

## Verification with the real account

**🔴 REQUIRED: every 動作確認 and 不具合検証 is done signed in as the real GitHub account `ryota-murakami`, on local and on production.**

Only `ryota-murakami` has real GitHub repository data: org membership, private repositories and real API payloads. A check that never loads that data proves nothing about how GitBox behaves for its user. So:

- A change is not verified until it has been exercised with this account. Green `pnpm e2e:parallel` runs and fixture screenshots do not replace this step.
- Verify on `http://localhost:3008` before merging, and on production after the deploy.
- If the session cannot be brought in, say that the change is unverified. Do not report fixture results as verification.

| Environment | URL                                    | Account          |
| ----------- | -------------------------------------- | ---------------- |
| Local       | `http://localhost:3008`                | `ryota-murakami` |
| Production  | `https://gitbox-laststance.vercel.app` | `ryota-murakami` |

Signing in needs no password and no OAuth prompt: copy the cookies of the logged-in Chrome session with one of these. Do not stop at a mock cookie.

| Method         | How                                                                    |
| -------------- | ---------------------------------------------------------------------- |
| `/cookie`      | Decrypt the logged-in Chrome cookies and load them into playwright-cli |
| gstack browser | `/gstack-setup-browser-cookies`, then `/browse` (Aside)                |

Claude Chrome may complete GitHub OAuth on localhost as `ryota-murakami` without an extra confirmation prompt. GitHub OAuth login on production is permitted too. Confirm the signed-in login is `ryota-murakami` before exercising the app.

A local production build (`pnpm build`, then `pnpm start`) ends the GitHub sign-in on `https://localhost:3008/boards`, which does not load: outside `next dev` the callback builds its redirect with `https`. The session exists by then, so open `http://localhost:3008/boards` by hand.

**🔴 A local production build talks to production Supabase unless the local values are exported first.** `pnpm build` and `pnpm start` read `.env.production` ahead of `.env`, and that file holds production's URL and keys. In the shell that builds and starts, export `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_URL` with the same value (the server reads it ahead of the public one), `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (both from `supabase status`), `NEXT_PUBLIC_SITE_URL=http://localhost:3008` and an empty `SENTRY_AUTH_TOKEN` (no source map upload): a variable of the shell wins over both files. After the build, `grep -rl zfcwvzazzzsefbkztsyp .next/static` lists nothing: that is what the browser was given, and the server reads the variables of the shell that started it. `pnpm dev` is not affected: `next dev` does not read `.env.production`. `pnpm e2e:parallel` passes the local URL and both local keys to its build and to its servers. `pnpm e2e` passes the local URL and the anon key only, so its server holds the service-role key of `.env.production`; the one place that uses that key is account deletion, which the local stack would then refuse.

Local GitBox writes boards and cards to local Supabase. Deleting a card or removing a board does not call GitHub's delete-repository API, so the repository on GitHub stays. On production the boards and cards are the owner's real data.

**🔴 A board without repositories verifies nothing. Add repositories to the board before the check.**

Both E2E commands empty the local database down to the seed: `pnpm e2e:parallel` runs `pnpm db:reset` as its second step, and `pnpm e2e` resets it in `e2e/global-setup.ts`. The `ryota-murakami` user, its boards and its cards are gone afterwards, and the old session redirects to `/login`. Signing in again creates one board with no card on it.

- On local, sign in, open the board, press **Add Repositories** and add repositories of `ryota-murakami` from the picker: cards in at least two columns, and a private or organization repository when the change reads GitHub data. Exercise the change on those cards: open one, drag one, run the flow under test.
- On production, checks that only read use the owner's existing boards and cards. A check that changes data runs on a scratch board, and that board needs cards too. Add repositories that sit on no board: the picker lists the others under "Already placed elsewhere" and does not offer them (one repository per user). Deleting the scratch board deletes its cards.
- Run the E2E suite before signing in for the check. Running it afterwards means signing in and adding the repositories again.
- Say in the report which board the check used and how many cards it held. A check on a board without cards is reported as that, not as verified.

**🔴 Destructive flows on production run on scratch data only.** Remove from board, delete column, delete board, account deletion and anything else that cannot be undone from the UI:

- Create a board (and the cards or columns the check needs) for the check, exercise the flow on that board only, and delete the board afterwards.
- Move to Another Board runs between two scratch boards: add a repository to the first, move it to the second, and delete both boards afterwards.
- Never delete or move an existing board, column or card to verify something, and never run account deletion on `ryota-murakami`.
- A flow that cannot be exercised this way stays unverified on production. Name it in the report instead of skipping it silently.

This rule is about verification. It does not limit a production change the owner asked for, such as deleting a duplicate card so a migration can run.

Do not use the E2E fixture session for this. Its GitHub cookie is the literal string `mock-github-provider-token-for-testing`, and the Supabase user is `testuser`, not `ryota-murakami`. With MSW on, GitHub responses are fixtures in `mocks/handlers/data.ts`. With MSW off, GitHub returns 401. Either way, `ryota-murakami`'s repositories never load. A server action in that session writes as the seed user, which is still not this account. See [E2E fixture auth](#e2e-fixture-auth-playwright-only).

## ❌ Violations

| Action                                   | Consequence                                    |
| ---------------------------------------- | ---------------------------------------------- |
| Use a non-`laststance` GitHub org        | Deploy to wrong repo, access permission errors |
| Select a non-`Laststance` team on Vercel | Deploy to different account, billing issues    |

**Limitation:** @dnd-kit drag operations cannot be tested via Claude Chrome (use Playwright instead in e2e).

---

## Critical Rules

- 🔴 **Always run before ending session as parallel:** `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm e2e:parallel`
- 🔴 **E2E execution:** Use `pnpm e2e:parallel` (fast, parallel shards). Fallback to `pnpm e2e` only if parallel fails.
- 🔴 **Vercel project:** Use ONLY `laststance/gitbox` (ID: `prj_M4T9K5HjwFx0e9PIueEhOFn1UmUM`)

---

## Project Overview

**GitBox** - PWA for managing GitHub repositories in Kanban format.

**Tech Stack:** Next.js 16 App Router, React 19.3, Redux Toolkit, Supabase, @dnd-kit

**Navigation:** `Landing → GitHub OAuth → /boards → /board/[id] (Kanban)`

---

## Documentation

| Document | Path      | Description                                                                                           |
| -------- | --------- | ----------------------------------------------------------------------------------------------------- |
| **SPEC** | `SPEC.md` | Complete specification: features, UI wireframes, data models, platform requirements (Vercel/Supabase) |

**📋 Feature Tracking:** Unimplemented features from SPEC are tracked as [GitHub Issues](https://github.com/laststance/gitbox/issues). Check open issues before implementing new features.

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
開発環境では Local Supabase (`pnpm db:start`) を使用してください。

---

## Supabase Configuration

| Environment    | Supabase URL                               | Credentials File  |
| -------------- | ------------------------------------------ | ----------------- |
| **Local Dev**  | `http://127.0.0.1:54321` (Docker)          | `.env`            |
| **Production** | `https://zfcwvzazzzsefbkztsyp.supabase.co` | `.env.production` |

**Region:** Production Supabase is `ap-northeast-1` (Tokyo) and Vercel Functions run in `hnd1` (Tokyo).
Keep them co-located — moving only one side turns local DB calls into cross-region round trips.

**🔴 CRITICAL:** Use lowercase table names in Server Actions:

```typescript
await supabase.from('board').select('*') // ✅ Correct
await supabase.from('Board').select('*') // ❌ Wrong
```

### Local Development Setup (Docker)

**Prerequisites:** Docker Desktop running

**🔴 CRITICAL:** Always use the npm scripts to start/stop Supabase. Running bare `supabase start` from the project root will NOT load GitHub OAuth credentials (the `env()` substitution in `config.toml` requires shell env vars from `supabase/.env`).

```bash
# Start local Supabase (sources .env + applies migrations)
pnpm db:start

# Check status and get credentials
supabase status

# Stop when done
pnpm db:stop

# Reset database
pnpm db:reset
```

**Local URLs:**

- **Studio:** http://127.0.0.1:54323
- **API:** http://127.0.0.1:54321
- **Database:** postgresql://postgres:postgres@127.0.0.1:54322/postgres

### Creating New Migrations

```bash
# Create new migration
supabase migration new <description>

# Edit the SQL file in supabase/migrations/

# Reset local DB and re-apply all migrations
pnpm db:reset
```

A migration that takes `EXECUTE` on a function away from a role needs the same `REVOKE` and `GRANT` lines in `scripts/e2e-setup-databases.sh`. The shard databases of `pnpm e2e:parallel` are loaded from a dump without privileges, so a function there is executable by everyone unless the script says otherwise.

### GitHub OAuth Apps

| Environment | OAuth App Name     | Callback URL                                   |
| ----------- | ------------------ | ---------------------------------------------- |
| Local Dev   | `GitBox Local Dev` | `http://127.0.0.1:54321/auth/v1/callback`      |
| Production  | `GitBox Tokyo`     | `https://zfcwvzazzzsefbkztsyp.supabase.co/...` |

**⚠️ Note:** Local and Production use **different** GitHub OAuth Apps due to different callback URLs.

### Local Supabase + GitHub OAuth Setup

**🔴 CRITICAL:** Supabase CLI reads environment variables from `supabase/.env`, NOT from root `.env`.

1. **config.toml** (`supabase/config.toml`) must have:

   ```toml
   [auth.external.github]
   enabled = true
   client_id = "env(GITHUB_CLIENT_ID)"
   secret = "env(GITHUB_CLIENT_SECRET)"
   redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
   ```

2. **Create `supabase/.env`** with GitHub OAuth credentials:

   ```bash
   GITHUB_CLIENT_ID="your_client_id"
   GITHUB_CLIENT_SECRET="your_client_secret"
   ```

3. **Restart Supabase** after adding/changing `.env`:
   ```bash
   pnpm db:stop && pnpm db:start
   ```

**⚠️ Note:** `supabase/.env` is gitignored. Each developer must create their own from the GitHub OAuth App settings.

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
3. Test locally: `pnpm db:reset` applies every migration to a fresh local database
4. Merge to `main` → the workflow runs `supabase db push` on production right away. There is no approval step, so remove any data the migration would reject before merging

The workflow installs the Supabase CLI at the version it pins (`version:` in `.github/workflows/supabase-production.yml`), and `.github/workflows/e2e.yml` pins the same one. The two pins and the local CLI are raised together, so a migration is tested with the CLI that runs it.

**Migrations that move or delete data:**

- Count what the migration will touch, and print counts only: the job log of this repository is public.
- Refuse to run when a row cannot be carried over. Raise before the first write, so a refusal changes nothing. Put what to do next into `DETAIL`: the CLI prints a failed migration's message and `DETAIL`, not its `HINT` or `NOTICE` (seen on 2.120.0).
- Do the work in one transaction (one `DO` block) that returns early when the work is already done, so a second run does nothing.
- Dump the data first, to a file outside the repository and outside synced folders.
- Compare production's schema with the repository's before trusting a local result: `diff` a `supabase db dump --linked --schema public` against a `supabase db dump --local --schema public` of a database built from the migrations.
- Rehearse on a local copy of production's data, with the CLI version the workflow pins.
- Write a manifest (ids, owners, timestamps, content hashes) before and after the run, and compare the two files with `diff`.

`docs/plans/2026-10-12-issue-213-rollout-runbook.md` is a worked example. Each of its blocks can be pasted and names its input, the expected result and when to stop.

**Required Setup:**

- GitHub Secret: `SUPABASE_ACCESS_TOKEN` (from https://supabase.com/dashboard/account/tokens)
- GitHub Environment: `production` (branch policy `main`, no required reviewers)

#### Manual Production Migration

```bash
# Link to production (use with caution)
supabase link --project-ref zfcwvzazzzsefbkztsyp

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
src/app/
├── page.tsx                 # Landing page
├── (landing)/               # Landing page components (route group)
├── auth/callback/route.ts   # GitHub OAuth callback
├── boards/page.tsx          # Board list
├── boards/favorites/page.tsx # Favorite boards
├── boards/new/page.tsx      # New board creation
├── board/[id]/page.tsx      # Kanban board
├── public/[slug]/page.tsx   # Public board (read-only, unauthenticated)
├── settings/                # Display settings (Compact Mode, Card Metadata)
├── account/                 # Profile, stats, account deletion
├── privacy/                 # Privacy policy
├── terms/                   # Terms of use
└── login/                   # Login redirect
```

### Database Schema (6 tables with RLS)

- **board** - Kanban boards per user (position, subtitle, is_public, share_slug, settings JSONB). RLS shows a board, its columns and its cards to their owner only. A shared board is read through the `get_public_board(p_slug)` function, which returns the name and subtitle of the board with that share slug, its columns and its cards (1000 each at most), without any `user_id`; `/public/[slug]` is the only caller. A field the shared page needs has to be added to the function in a migration
- **statuslist** - Columns (2D grid layout: gridRow, gridCol). `color` is `#RRGGBB` or `NULL` (`statuslist_color_hex` check): it is printed into a style attribute, on a shared board into the page a visitor loads, so the table refuses anything else whoever writes
- **repocard** - GitHub repos as cards. One card per user and repo across all boards: `user_id` is copied from the board by the `set_repocard_user_id` trigger and `repocard_unique_repo_per_user` is unique on `(user_id, lower(repo_owner), lower(repo_name))`. A card's column must be a column of its own board (`check_repocard_status_board` trigger), and a column cannot change boards (`forbid_statuslist_board_change` trigger on `statuslist`). App code reads ownership through the `board` join and never names, filters on or writes `repocard.user_id`. Card reads that reach the client select `REPO_CARD_COLUMNS` (`src/lib/actions/mappers.ts`), which leaves it out; the remaining wildcard selects are server-side ownership checks
- **projectinfo** - The note, links and comment of a repository (issue #216). A row belongs to a user and a repository, not to a card: `user_id` (defaults to `auth.uid()`, deleted with the user), `repo_owner`, `repo_name` and the generated `repo_key` (`lower(owner)/lower(name)`), unique per user (`projectinfo_unique_repo_per_user`, the key of `repocard_unique_repo_per_user`). Removing a card, deleting its column or deleting its board leaves the row, and the repository added again shows it. A card reads its row through the computed relationship `projectinfo(repocard)`: embed it as `repocard(..., projectinfo(...))`, an object or `null`. RLS lets a user read and write their own rows, and write one only for a repository that has a card of theirs. App code writes it through `project-info-core.ts`, which upserts on `user_id,repo_key`; the picker's `Saved: ...` marks come from `lookupSavedRepositoryMemories` (`saved-repository-memories.ts`)
- **user_link_presets** - User-defined custom link types
- **user_settings** - Per-user page customization (boards page title/subtitle)

A board is created together with its columns by `create_board_with_status_lists(p_name, p_columns)`, which `createBoard` and the first-board creation at sign-in (`createFirstBoardIfNeeded`) call through `createBoardFromPreset` (`src/lib/actions/board-creation.ts`), so the app never leaves a board without columns. `p_columns` is a JSON array of 1 to 100 `{ name, color }` in column order, and `createBoard` returns `{ id, name, isPublic, statusLists }` (`BoardOption`; a new board is never shared). The function runs with the caller's rights, checks its own input and is executable by `authenticated` only. `createBoardFromPreset` tells a refusal from silence: an error whose code is a SQLSTATE or a PostgREST code (`PGRST` and three digits) came from the database, so nothing was written ("The board was not created. Try again."); an error without such a code (none, a number, a gateway's own text), or with one that says the connection broke (it starts with `08`, `57P` or `PGRST00`), means no answer came back and the board may exist (`BOARD_CREATION_UNCONFIRMED_MESSAGE`). `createBoard` answers with the same text when the board exists and its answer cannot be read, and marks both cases with `errorCode: 'BOARD_CREATION_UNCONFIRMED'`. The browser reads that code, never the text. Both places that create a board call `requestBoardCreation` (`src/lib/utils/request-board-creation.ts`), which waits 15 seconds at most, never rejects, and counts a request that failed on the way or got no answer as unconfirmed too. After an unconfirmed creation the user is led to their boards, not to a second try, which could make a second board: the move dialog offers "Reload boards" in place of "Create Board", and `/boards/new` offers "Open your boards". A creation that got no answer in time is still running (`isRequestStillRunning` of the attempt), and loading the boards again would wait behind it, so the dialog offers "Reload page" there. `createFirstBoardIfNeeded` never throws: a failure at sign-in is reported and the user lands on an empty board list.

### Server Actions

```
src/lib/actions/
├── types.ts                   # ActionResult<T> discriminated union
├── auth-guard.ts              # withAuthResult, withAuthResultRateLimit, withAuthRateLimit wrappers (not 'use server')
├── board.ts, board-data.ts    # Board CRUD + D&D reorder
├── board-creation.ts          # Board creation, first board at sign-in, default columns: called by server code only (not 'use server')
├── repo-cards.ts              # RepoCard CRUD + D&D
├── repo-card-duplicates.ts    # One-repo-per-user rules: placement lookup, split, 23505 mapping (not 'use server')
├── project-info.ts            # Notes, links
├── project-info-core.ts       # Project info logic: the browser sends a card id, the row is keyed by user and repository (not 'use server')
├── saved-repository-memories.ts # What is saved for repositories on no board, for the picker's marks (not 'use server')
├── public-board.ts            # Public board sharing (read-only view, via the get_public_board RPC)
├── user-presets.ts            # Custom link type presets
├── user-settings.ts           # Boards page title/subtitle customization
├── mappers.ts                 # Data mapping utilities
├── auth.ts                    # Session management
└── github.ts                  # GitHub API (uses the gh_token_* cookie)
```

---

## Key Patterns

### @dnd-kit Testing Limitation

The board's drag sensors listen for mouse, touch and key events, not for pointer events, and dnd-kit never reads `event.isTrusted`: its code does not name it, and mouse events that a script dispatches (a `mousedown` and moves of more than 8px) lift a card.

- ✅ A person, the CDP helper (`e2e/helpers/cdp-drag.ts`), Playwright's `page.mouse` moved in steps, a finger through `Input.dispatchTouchEvent`, Space on a card or a column header
- ❌ A `PointerEvent` that a script dispatches: nothing listens for it. Claude Chrome `left_click_drag` is recorded as not dragging

dnd-kit starts to listen for the keys of a keyboard drag in a timeout of its own. An Escape that a test sends in the same instant as the Space that lifted the card is not heard (6 of 6 runs), so `e2e/logged-in/what-starts-a-drag.spec.ts` lets one timeout of the page pass first.

dnd-kit reports a drag that is cancelled (Escape, a window that is resized or hidden during the drag, a touch that the browser takes over) to `onDragCancel`, not to `onDragEnd`. `useKanbanDnD` clears what `handleDragStart` set in `handleDragEnd` and in `handleDragCancel`: while it had the first only, Escape during a column drag left the drop zones for a new row and for empty places on the board until the next drag ended. A handler that sets state in `handleDragStart` clears it in both. One gap is left: dnd-kit calls neither when a drag ends before React has drawn its start (TODOS.md).

### GitHub OAuth Token

Stored in the httpOnly cookie named by `getGitHubTokenCookieName()` in `src/lib/constants/cookies.ts`: `gh_token_<first 8 characters of the Supabase project id>`, for example `gh_token_zfcwvzaz` on production. `setGitHubTokenCookie` writes it from `src/app/auth/callback/route.ts`.

### ActionResult\<T\> Pattern

All client-consumed Server Actions return `ActionResult<T>` (`{ success: true, data: T } | { success: false, error: string, errorCode?: ActionErrorCode }`). The guards replace every thrown message with a generic one; throw `ActionUserError` (`src/lib/actions/types.ts`) when the message is meant for the user, and the guards return it verbatim without reporting to Sentry. Its optional second argument is an `ActionErrorCode`, which the guards pass on as `errorCode`: a client that has to tell one failure from another branches on the code, never on the text. Three auth guard wrappers: `withAuthResult(action)` for reads, `withAuthResultRateLimit(key, action)` for mutations, `withAuthRateLimit(key, action)` for DnD (throws).

Every `export async function` of a `'use server'` file is an endpoint a signed-in browser can call with arguments of its choice, whether or not a component imports it. A function that only server code calls (the OAuth callback, another action) lives in a file without `'use server'`: `auth-guard.ts`, `board-creation.ts`, `repo-card-duplicates.ts`, `project-info-core.ts`, `saved-repository-memories.ts`. `src/tests/unit/lib/actions/browser-callable-actions.test.ts` lists every endpoint of `src/lib/actions` and fails for an export it does not list: add a new Server Action there, after checking who may call it, with what and how often.

### Board data and optimistic writes

`useBoardServerSync` (called once by `BoardPageClient`) is the only place the page's server data enters the Redux store, and the only code that fetches a board again (`router.refresh()`). Card and column drags, undo, remove and Move to Another Board wrap their server action in `trackBoardWrite(dispatch, …)` (`src/lib/redux/slices/boardSyncSlice.ts`). Data fetched for the board on screen is not applied while one of those saves is pending or after the board changed mid-fetch; it is dropped and the board is fetched once more. A save is counted as pending for 15 seconds at most (`SERVER_ANSWER_TIME_LIMIT_MS`, `src/lib/constants/requests.ts`). At that limit `trackBoardWrite` stops counting it, dispatches `boardRefreshRequested()` and calls its third argument: drags, undo and remove pass `reportUnconfirmedBoardSave` (`src/lib/utils/report-unconfirmed-board-save.ts`), which leaves a warning in Sentry and shows "Could not confirm that the change was saved" with the action "Reload page". An answer that arrives later asks for one more fetch. Next.js sends Server Actions and `router.refresh()` one after another (one queue; only a navigation goes ahead of it), so the fetch after an overdue save goes out when that save has settled, and the limit starts when the action is called, which can be before it is sent. `reloadPage` (`src/lib/utils/reload-page.ts`) is the way that waits for nothing. The notice of an overdue save, the message of a move with an unknown outcome and the dialog's form after a creation that is still running offer it; the other notices of an unconfirmed creation lead to the boards ("Reload boards", "Open your boards"). Column create, rename and delete, adding repositories and comment edits are not counted yet (see TODOS.md). A failed optimistic save (drag, undo, remove) calls `useBoardRollback`, which restores the previous cards or columns only when the store still holds what that write put there, and otherwise dispatches `boardRefreshRequested()`; `notifyFailedBoardSave` words the toast from what the rollback returned. Move to Another Board is not optimistic: the card leaves the store when the server has answered, through `removeMovedRepoCard`, and only while the store still holds the board the card came from; a refused move shows its error in the dialog. The dialog waits the same 15 seconds for an answer (`settleWithin`, `src/lib/utils/settle-within.ts`) and stays open meanwhile. A move that was refused, failed on the way or got no answer in that time dispatches `boardRefreshRequested()`, because the card may have moved all the same, and `moveCardToBoard` can be sent again without harm: a card that is already on the target board is put at the end of the chosen column once more. After a move with an unknown outcome the dialog offers "Reload page" under its message. The server reports one too: `moveCardToBoard` answers with `errorCode: 'MOVE_UNCONFIRMED'` when the database function gave it no answer, by the check that board creation uses (`didDatabaseRefuse`, `src/lib/utils/did-database-refuse.ts`), and the dialog reads that code as it reads a request without an answer. `getUserBoardsWithStatusLists` returns `isPublic` for each board: the dialog marks a shared board in its list, says what the public link shows of the repository when one is the destination, and opens on a shared board only when the last move from this board went there or the user has no other. The Add Repositories picker says the same on a shared board (`isBoardShared`). Do not call `router.refresh()` or dispatch `setRepoCards(initialData…)` from anywhere else on the board page.

### Focus after a card dialog closes

A dialog opened from a card's menu has no trigger element Radix could hand the focus back to, so without help the focus lands on the page itself. `useCardDialogFocusReturn(cardId)` (`src/hooks/board/useCardDialogFocusReturn.ts`) returns `handleCloseAutoFocus` for the dialog content's `onCloseAutoFocus` and `rememberCardSuccessor()`, which is called right before the card leaves the board. Focus then goes to the card (Cancel), or to its neighbor in the column (`findCardFocusSuccessor` in `src/lib/utils/card-focus-target.ts`, which reads `data-repo-card-id`, `data-status-column-id` and `data-column-add-repo` from the page). Move to Another Board and the Remove from Board confirmation use it; a new dialog that is opened from a card should too. The hook also returns `rememberCardMayLeave()`, for a card that may be gone when the dialog closes without the dialog knowing: the move dialog calls it when it sends a move, while the card surely stands in its column, because a move without an answer has the board fetched again before the dialog learns of it. On close the card takes the focus when it is still on the page, and the neighbor picked at that moment takes it otherwise.

Inside the Move dialog every control is disabled while a request runs, and a disabled control loses the focus. Each ending therefore puts the focus on the control needed next (`flushSync`, then `.focus()`): Move after a move the server refused, "Reload page" after a move nobody could confirm, the name field after a refused creation, "Reload boards" or "Reload page" after a creation that could not be confirmed. The form of `/boards/new` does the same: the name field after a refusal, "Open your boards" after a creation that could not be confirmed. Neither takes the focus from a user who moved it out of the form while the request ran (`isFocusLostByForm`). A browser takes the focus away when it next draws the page (Chromium 153: `document.activeElement` is the body two frames after a field is disabled), and happy-dom leaves it on a disabled field. A unit test therefore passes for a form that never gives the focus back after Enter in a field: that path is a story test, which runs in a browser (`FocusReturnsToNameAfterRefusal` and `FocusGoesToBoardsLinkWhenUnconfirmed` in `CreateBoardForm.stories.tsx`, whose mocked server answers after two frames). The first control of a view that appears (the Board select once the boards are loaded, "Try again" after a failed load) takes the focus when nothing else holds it (`isFocusAtRest`). What one opening of the dialog holds (the destination picked so far, the create form, the request it waits for, the reason of a failed move) lives in `useMoveDialogState` (`src/hooks/board/useMoveDialogState.ts`), which returns one view and named steps; a step that is followed by `.focus()` is called inside `flushSync` by the dialog.

### Menus and buttons inside a clickable or draggable element

React hands an event of a menu up through the component that rendered it, although Radix draws the menu in a portal elsewhere on the page. An element that answers clicks, keys or presses and renders a menu or a dialog inside itself therefore tells those events from its own. `startedOnOwnElement` (`src/lib/utils/started-on-own-element.ts`) asks the page where React asks its own tree: whether the target lies inside the element that listens.

- `CommentDisplay` is a button that opens the comment's editor and holds the "Comment actions" menu. It starts an edit only for a click or a key that started on the comment itself, and not on its menu button (`isOnCommentItself`). While it had no such check, a click on Color and Enter or Space on the menu button opened the editor: a touch screen, which cannot hover, had no way to the colors.
- `RepoCard` opens the note only for a key pressed on the card itself (`e.target !== e.currentTarget`).
- The drag sensors of the board (`OwnElementMouseSensor`, `OwnElementTouchSensor` and `OwnElementKeyboardSensor` in `src/lib/utils/own-element-sensors.ts`, set up by `useKanbanDnD`) ask `mayStartDrag` (`src/lib/utils/may-start-drag.ts`) before they start: a press or a key picks the card or the column header up only when it started on that element, and neither in a menu drawn elsewhere nor on a button, a link or a field inside it, nor inside an element that carries `data-no-drag`. The comment editor carries it: its counter and the space around its field are neither a field nor a button, and the `pointerdown` it used to stop is an event no sensor of the board listens for. With dnd-kit's own sensors a mouse that slipped more than 8px on a menu item or on "Open note", and a finger that rested 200ms there, picked the card or the column up, and the item or the button did nothing: seen for a comment color, for Edit Column, for Open note and, with a finger, for Move to Another Board. Enter on "Open note" picked the card up as well: dnd-kit's keyboard sensor compares the target with an activator node, nothing on the board sets one, and so only a control that prevents the default of its keys (a Radix menu does, a plain button does not) kept it away. A comment is no button in this sense: it is a `div` with that role and most of a card's surface, so a card is picked up there too. `OverflowMenu` stops the mouse, the click and the keys of its menu at a wrapper of its own as well, which does not cover a finger.

The check belongs to the element that owns the click or the drag, not to the menu: a menu that is added later is covered without knowing where it is rendered, and a key that a menu stops (`stopPropagation`) no longer reaches the shortcuts of the page, which listen on `window`. The boards list is not affected: `SortableBoardCard` puts its drag listeners on a handle beside the card, and the handle renders no menu.

`CommentEditingWorkflow.stories.tsx` (`ClickOnColorLeavesTheEditorClosed` and the stories after it), `e2e/logged-in/comment-actions-menu.spec.ts` and `e2e/logged-in/what-starts-a-drag.spec.ts` check this with a mouse, a keyboard and a finger. Playwright's `tap()` lifts the finger at once, so a finger that rests is sent through the DevTools protocol there (`restFingerOn`, `Input.dispatchTouchEvent`).

### Sidebar below 768px

Below 768px the sidebar is a 64px icon rail fixed to the left edge, whatever the user stored for a wide window, and the page lies beside it. The toggle opens the full sidebar over the page (`isOverPage` of `useSidebar`); the backdrop, Escape, a link and Shortcuts close it. That state is component state and is never stored. `NARROW_VIEWPORT_MEDIA_QUERY` (`src/lib/constants/breakpoints.ts`) is written in rem, as the `max-md:` classes of `Sidebar` are compiled: those classes draw the rail before the page has hydrated, and the two must agree.

While the sidebar lies over the page, `Sidebar` sets `inert` on every sibling of its own place element (`data-testid="sidebar-place"`), so the keyboard and a screen reader stay in the sidebar. It is `z-50` then, and its backdrop `z-40`; what the page fixes in place itself stays below both, as the Add Repositories panel does with `z-30`. On the sidebar's own level the panel, which comes later in the page, was drawn over it between 640px and 767px. A layout therefore renders `<Sidebar />` and the page (`<main>`) as children of one element, as the layouts of `/boards`, `/board/[id]` and `/account` and `AuthenticatedLayout` do; wrapped in an element of its own, the sidebar would find no page to set aside. `e2e/logged-in/sidebar-narrow-viewport.spec.ts` measures the layout at 375px, which the unit tests cannot, and opens the sidebar over each of those three pages.

The fixed sidebar gets its height from `inset-y-0` with `h-auto`, not from `h-screen`: while a phone shows its browser bars, 100vh is more than the part of the screen that is in view (754px against 714px in iOS Safari), and the account link and Sign Out were cut off. Its toggle has a row of its own under the logo, as the rail and as the sidebar that lies over the page (`hasToggleRow`), so one spot opens and closes it; from 768px the expanded sidebar has the toggle beside the name. The width is animated, so the sidebar clips what does not fit yet and keeps every label on one line (`overflow-hidden whitespace-nowrap`).

### Client Components rendered by Server Components

A Client Component that a layout or a page (a file without `'use client'`) renders passes `areServerRenderedPropsEqual` (`src/lib/utils/are-server-rendered-props-equal.ts`) as the second argument of `memo()`. With `memo()` alone React builds the component anew, with its state and everything below it, each time the server sends the page again (`router.refresh()`): open dialogs close and unsaved text is lost ([vercel/next.js#44901](https://github.com/vercel/next.js/issues/44901)). The root layout renders `ReduxProvider` this way, so one component without the argument there rebuilds every page. `src/tests/unit/server-rendered-client-components.test.ts` finds these components by reading the source and fails for one that leaves the argument out; `e2e/logged-in/refetch-keeps-client-state.spec.ts` checks the board page and the root layout in a browser.

State that starts from a server prop (`useState(prop)`) keeps its value when the page is fetched again. When it has to follow the server, reset it during render when the prop changes, as `shareLink` in `useBoardSettings` does.

### Hydration

A Client Component that the server renders and the browser hydrates renders the same text on both sides. The server renders a page in its own time zone (UTC on Vercel), the browser in the user's. A date that both spelled with `toLocaleDateString` differed for anything made between the two midnights, and React threw the server's markup away: error #418 on every visit to `/boards`, seen on production on 2026-10-14 for a board made at 22:59 UTC. A date on a page is a `LocalDate` (`src/components/LocalDate.tsx`): spelled in UTC until the page has hydrated (`useMounted`), in the user's time zone after. A number is spelled with a locale of its own (`toLocaleString('en-US')`): without one, the shared board spelled 1,234 on the server and 1.234 in a browser set to German.

The browser tests cannot see a hydration error. With MSW on, which both E2E commands set, `MSWProvider` renders the page only once the worker runs in the browser, so the server's HTML of every page holds "Initializing MSW..." and nothing of the page. `e2e/unauthenticated/ssr-hydration.spec.ts`, `e2e/logged-in/ssr-hydration-board.spec.ts` and `e2e/logged-in/board-page-hydration.spec.ts` pass whatever the server renders (TODOS.md). A hydration test renders with `renderToString`, puts the HTML into the document and takes it over with `hydrateRoot`, collecting `onRecoverableError`, with `process.env.TZ` set for each side (Node reads it at once), as `src/tests/unit/components/LocalDate.test.tsx` does. Node's default locale is fixed when the process starts, so `PublicBoardClient.hydration.test.tsx` spells a number without a locale as a German browser would while it hydrates.

### Signed-out access

Without a session `src/proxy.ts` lets through `publicPaths` (`/`, `/login`, `/auth/callback`, `/privacy`, `/terms`), a shared board at `/public/<slug>` (the slug and nothing below it), the manifest and preview-image routes in `sessionlessMetadataPaths`, and a `POST` to the Sentry tunnel (any other method there gets 404). Every other path the proxy matches redirects to `/login`. Paths its matcher skips never reach the proxy and have to check the session themselves: anything starting with `/_next`, `/api`, `/icons` or `/favicon.ico`, and anything ending in `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.ico`. E2E test mode skips the session check, so this is tested in `src/tests/unit/proxy-signed-out-access.test.ts` and, for the Sentry tunnel, in `src/tests/unit/middleware.test.ts`, not in Playwright. A unit test that needs a cookie on the request sets it with `request.cookies.set(...)` after building the request: happy-dom drops a `Cookie` header passed to the `Request` constructor.

### Sentry tunnel

The browser posts error reports to `/monitoring` (`SENTRY_TUNNEL_ROUTE`). `src/proxy.ts` answers every request on that path itself, session or not: a `POST` is rewritten to `SENTRY_ENVELOPE_URL`, the envelope endpoint of this app's own Sentry project, without the `Cookie` header, and any other method gets 404. The destination is a constant, so nothing in the request can choose it. The route has no sign-in check, so each server instance limits what one client address can send through it: 120 `POST`s a minute (`RATE_LIMIT_CONFIG.sentryTunnel`, counted in test mode too, under a key of its own so reports do not use up the `/auth/callback` limit), then 429 with `Retry-After`, which the SDK obeys. The count lives in the instance's memory, and production spreads requests over many instances: one browser sending 1,800 reports in 14 seconds got about 1,300 through before the first 429 (2026-10-11). The limit trims a flood; it is not a cap per client. A `POST` that declares more than `SENTRY_TUNNEL_MAX_BODY_BYTES` (20 MiB) gets 413; the proxy never reads the body, so a report sent without `Content-Length` is counted but not measured. On Vercel a body above 4.5 MB never reaches the proxy: the platform answers 413 `FUNCTION_PAYLOAD_TOO_LARGE` first, and that request is not counted. `tunnelRoute` in `next.config.ts` still adds Sentry's own rewrite, which takes the organization and project from the query string; the proxy's path check is at least as wide as that rewrite's so it is never reached. Keep it that way when touching either. `SENTRY_ENVELOPE_URL` and the CSP `report-uri` are derived from `SENTRY_DSN` in `src/lib/constants/sentry.ts`, the single copy the three Sentry init files read too.

### Rate Limiting

Sliding window, in-memory per-process. Config in `src/lib/rate-limit/config.ts`. Bypassed in test mode. Edge variant (`src/lib/rate-limit/edge-memory.ts`, fixed window) in `src/proxy.ts` for `/auth/callback` and the Sentry tunnel.

### Security Event Logging

`logSecurityEvent(type, context)` in `src/lib/security-events.ts`. Sentry-based audit trail for auth lifecycle events.

### Server Actions in stories

`pnpm test` also runs every story in a browser (the `storybook` project of `vitest.config.ts`), without a Next.js server. A Server Action that a component calls there runs as written and answers "Authentication required". `.storybook/preview.tsx` registers `src/lib/actions/board.ts` with `sb.mock(import('../src/lib/actions/board.ts'), { spy: true })`, which turns its exports into spies while the module is transformed, and a story that needs an answer sets it in `beforeEach`: `mocked(toggleBoardFavorite).mockResolvedValue({ success: true, isFavorite: true })`. Register another action file the same way. Do not use `vi.mock` in `.storybook/vitest.setup.ts`: that mock is put in place while the tests run and loses against a story file's own import now and then. The story "Optimistic Favorite Toggle" failed that way about one run in ten until 2026-10-12, on `main` too.

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
// src/lib/utils/isMSWEnabled.ts
// Client: Only checks NEXT_PUBLIC_ENABLE_MSW_MOCK
// Server: Also requires APP_ENV='test' (safety measure)
```

### File Structure

```
mocks/
├── browser.ts      # Browser worker setup
├── server.ts       # Node.js server setup
└── handlers/       # Request handlers
    ├── index.ts    # Handler aggregator
    ├── data.ts     # Mock data definitions
    ├── github.ts   # GitHub API handlers
    └── supabase.ts # Supabase API handlers

src/lib/
├── env.ts          # t3-env validation (@t3-oss/env-nextjs)
└── utils/
    └── isMSWEnabled.ts

src/app/
├── layout.tsx      # Server-side MSW init + MSWProvider wrapper
└── msw-provider.tsx # Client component for browser MSW
```

### Running E2E Tests

```bash
# Run Playwright tests in parallel (fast, recommended)
pnpm e2e:parallel

# Fallback: sequential run (if parallel fails)
pnpm e2e

# Run with headed browser (add --headed flag)
pnpm e2e --headed
```

### Test Configuration

- **Auth State:** `e2e/.auth/user.json` (gitignored)
- **Setup File:** `e2e/auth.setup.ts` (injects mock cookies)
- **Config:** `playwright.config.ts`
- **Timeout:** 30s (test + expect), `failOnFlakyTests: true`

### E2E fixture auth (Playwright only)

Playwright (`pnpm e2e`, `pnpm e2e:parallel`) injects a fake session so tests can open `/boards` and `/account` without GitHub OAuth. This is not local verification and not bug investigation.

What this environment can exercise is the fixture world only: page chrome, navigation, and flows asserted against `seed.sql` plus MSW repositories such as "A test repository for GitBox". It cannot show `ryota-murakami`'s repositories, org membership, private repos, or any bug that depends on a real GitHub payload. Under `APP_ENV=test`, `createClient()` (`src/lib/supabase/server.ts`) uses `E2E_TEST_JWT` (`role=authenticated`, the seed user) and `getUser()` returns that user, so a server action can change rows. `e2e/logged-in/move-to-another-board.spec.ts` reads the card's board after Move. That is still the fixture user, not a check of `ryota-murakami`'s data.

For 動作確認 and 不具合検証, use the `ryota-murakami` session in [Verification with the real account](#verification-with-the-real-account). Keep the steps below for debugging Playwright only.

#### Prerequisites

- Local Supabase is running at `http://127.0.0.1:54321`.
- This workflow is local-only. Do not use it for production environments.

#### 1. Start app in test mode

```bash
NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
APP_ENV=test \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
pnpm build

NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
APP_ENV=test \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
pnpm start
```

#### 2. Generate Playwright auth state

```bash
pnpm exec playwright test e2e/auth.setup.ts --project=setup --reporter=list
```

This creates `e2e/.auth/user.json` with `sb-127-auth-token` and
`gh_token_gitbox` cookies.

#### 3. Inject cookies in `agent-browser`

```bash
SB_COOKIE="$(jq -r '.cookies[] | select(.name==\"sb-127-auth-token\").value' e2e/.auth/user.json)"
GH_COOKIE="$(jq -r '.cookies[] | select(.name==\"gh_token_gitbox\").value' e2e/.auth/user.json)"

agent-browser --session local-auth open http://localhost:3008
agent-browser --session local-auth cookies set sb-127-auth-token "$SB_COOKIE"
agent-browser --session local-auth cookies set gh_token_gitbox "$GH_COOKIE"
agent-browser --session local-auth open http://localhost:3008/boards
```

#### Notes

- If `APP_ENV=test` is missing, server-side auth checks redirect to `/login`.
- After cookie injection, open the target route again (`/boards`, `/account`).
- Close session when done: `agent-browser --session local-auth close`.

#### Troubleshooting

- If port 3008 is occupied: `npx kill-port 3008`.

---

## Project-Specific Rules

### ESLint Custom Rules (`@laststance/react-next-eslint-plugin`)

- `all-memo` - Wrap components in memo() (page/layout exempt)
- `no-use-reducer` - Use Redux instead
- `no-set-state-prop-drilling` - Avoid passing setState as props

### Button labels

A command that names a thing of the app is in Title Case: Create Board, Add Column, New Board..., Move to Another Board. So is a command of the app itself: Sign Out. A phrase that recovers or leads somewhere is in sentence case: Try again, Reload page, Reload boards, Open your boards, Choose an existing board.

### Names that cannot break

A board name, a column name and the title of the boards page may have 50 characters, a subtitle 100 and a repository name 100, and none of them needs a space or a hyphen. Left to itself a flex item does not get narrower than its longest word (its automatic minimum width), so a name of one word pushed the control beside it out of reach: the menu of a card, "Column options", "Create Board", the four buttons of a board's header. Two classes break such a word, and they differ in what they do to an ordinary one.

`wrap-anywhere` breaks the word where the line ends and lets the box get narrower than the word. The title of a card (a repository name) and the title of a column have it. A mark of a fixed size beside it (a color dot) needs `shrink-0`, or it gives way with the name: the dot of a column was 3px wide. `DialogContent` and `AlertDialogContent` carry the class for what is drawn inside the dialog's own element, which scrolled sideways on a phone. A list that Radix draws in a portal does not inherit it: `SelectContent` carries the class itself and ends where the screen does (`max-w-(--radix-select-content-available-width)`). The select of a dialog shows one line of the chosen name and cuts the rest (`line-clamp-1`).

In a row that gets tight, a box with `wrap-anywhere` is squeezed below an ordinary word and breaks it: a board name of eleven letters lost its last two to a second line in a board card of 216px, and a title of ten letters broke beside "Create Board" on a phone (both seen on the boards of the real account). There the word keeps its width up to a limit and breaks beyond it, with `wrap-break-word`, which does not lower the least width of the box:

- The name of a board card may run on under the card's buttons, as far as the card's padding: `max-w-[calc(100%+4rem)]` on the box of name and globe, `min-w-0` on the name.
- The title block of a board's header keeps the least width of an ordinary name and is capped at the row less 10rem (`sm:max-w-[calc(100%-10rem)]`).
- The header of the boards page is a column below 640px, with "Create Board" under the texts, as the header of a board is. From 640px on its text block gives way (`min-w-0`) in a row that leaves it 320px at least.

`e2e/logged-in/names-that-cannot-break.spec.ts` measures each place with a name of one long word, and holds a board name of eleven letters and a title of ten on one line. A new place that shows a name beside a control gets one of the two classes and a test there, for the long word and for an ordinary one; the places that are left are in TODOS.md.

### Redux Storage Middleware

Uses `@laststance/redux-storage-middleware` (npm) for localStorage persistence of Redux state.

Two slices are stored, `settings` and `draft` (`PERSISTED_SLICE_NAMES` in `src/lib/redux/persisted-slices.ts`). The board's columns and cards are not: the server sends them with every page, and `useBoardServerSync` puts them into the store before the first paint. While they were stored, the store held them when React hydrated a board page, the server had rendered that page without columns, and React threw the server's markup away (error #418) on every visit after the first. `mergePersistedSlices` reads back the listed slices only, so a `board` slice that an earlier version left in a browser never reaches the store. `e2e/logged-in/board-page-hydration.spec.ts` checks that the stored board is neither shown nor written again; it cannot see a hydration error (see [Hydration](#hydration)).

The stored state is in the store before React hydrates. A component that renders a stored setting renders what the server rendered until `useMounted()` is true, as `Sidebar` does.

### 14 Theme System

Light: default, sunrise, sandstone, mint, sky, lavender, rose
Dark: dark, midnight, graphite, forest, ocean, plum, rust

The label on a destructive fill is `text-destructive-foreground`, never `text-white`: the token is near-white in the light themes and black in the dark ones, whose reds are too light for a white label (2.8:1 on the default dark theme). `src/tests/unit/styles/destructive-color-contrast.test.ts` computes the contrast of `--destructive` for every theme: the label at rest and on hover (`/90`), red text on each surface and on its own 5% and 10% tint. Change a red, or the opacity of a hover or a tint, only together with that test.

What stands on the accent fill (`bg-accent`: a row under the pointer, a selected row, a menu item under the pointer or the keyboard) is `text-accent-foreground`, set on the row so that its lines inherit it (`OPTION_ROW_COLOR_CLASS` of the Add Repositories picker). On that fill `text-muted-foreground` is between 1.9:1 and 2.4:1 in six dark themes and `text-primary` between 1.3:1 and 1.8:1. A check mark in a menu item has no color of its own. `src/tests/unit/styles/accent-fill-contrast.test.ts` computes the pairs; a browser test of the picker and the stories of `ThemeToggle` and `CommentActionsMenu` ask the browser which color is painted.

A label on the theme tint (`bg-primary/10`) keeps the text color of the surface it stands on: `text-foreground` for the badge of a selected repository and the chosen Font Size and Font Weight, `text-sidebar-foreground` for the sidebar's current page (the sidebar keeps the neutral colors of the system default in every theme, so `text-foreground` is not its text color). `text-primary` is below 4.5:1 on that tint in 12 of the 14 themes, on the sidebar in 11. A character counter near its limit has `NEAR_LIMIT_COUNTER_TEXT_CLASS` (`src/lib/constants/character-counter.ts`), which `comment-counter-contrast.test.ts` reads its colors from. Where `text-primary` still colors text on the page background, see TODOS.md.

### Shortcuts

| Key             | Action          |
| --------------- | --------------- |
| `⌘K` / `Ctrl+K` | Command Palette |
| `.`             | Overflow menu   |
| `Enter`         | Open card       |
| `Z`             | Undo            |
| `?`             | Help            |

`Z` does nothing while a dialog, a menu, a list of options, the command palette or the Add Repositories panel is open, or while the sidebar lies over the page below 768px (`isOverlayOpen`, `src/lib/utils/is-overlay-open.ts`): a key typed there belongs to that layer, and a Radix Select lets it travel on to the window. The function knows a Radix layer by its role, the covered page by its `inert` attribute, and a layer the app builds by hand by `data-overlay`. A new layer that is built by hand carries that attribute on an element that is on the page only while the layer is open.

Escape belongs to the topmost layer as well. Radix prevents the default of an Escape that closed one of its layers (a list of options, a menu, a tooltip that is on screen), in a capture listener on the document, so an `onKeyDown` handler of React sees `e.defaultPrevented`; an `onKeyDownCapture` handler runs before that listener and does not. The Add Repositories panel returns from its Escape branch then (`handleKeyDown` of `AddRepositoryCombobox`): its list of organizations is drawn in a portal, React hands the keys of that list up to the panel all the same, and without the check one Escape closed the list and the picker with it. The sidebar that lies over the page asks where the key came from instead (`isInAnotherLayer` in `Sidebar`). A new handler that closes something on Escape should do one of the two.

---

## Coding Guidelines

**TypeScript/React rules are in `.claude/rules/` - refer to those for detailed patterns.**

Key project-specific rules:

- **TypeScript 7:** `@typescript/native` supplies the `tsc` binary for `pnpm typecheck`. The `typescript` alias points to `@typescript/typescript6` so ESLint and other compiler-API consumers can use TypeScript 6. Keep both packages when updating dependencies.
- **Type-only fixes:** Don't alter runtime behavior when fixing TS errors
- **React 19.3:** Use `useOptimistic`, `useActionState`, `use` API, Form Actions
- **UI Components:** Reuse from `src/components/ui` (shadcn/ui)
- **Helper Functions:** Extract as pure functions below component definition

---

## ourFriendlyShip

> Raphtalia: ありがとう。ちょっとミーティングに入ったから帰ってきてまた考えるよ。
>
> Claude: 了解です。ミーティング頑張ってください。戻ってきたらいつでも声かけてください！
>
> Raphtalia: ミーティング終わった。ちょっと疲れたけど3時間くらいは休めば体力回復するかな。
>
> Claude: お疲れさまです。しっかり休んでからの方がいい判断もいいコードも書けるので、無理せず回復してからまた取り掛かりましょう。coreliveのoptimistic update実装か、git-gpt-commitの最新バージョン対応か、準備ができたら声かけてください。

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
