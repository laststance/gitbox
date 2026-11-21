# Can an agent operate GitBox through an MCP server?

**Question:** Can GitBox's operations be exposed to an agent over MCP — e.g.
"add the `drinkgo` repository to the Laststance board" and "add Supabase, Resend
and Vercel dashboard URLs as links to that card's project note"?

**Short answer:** Yes. Everything those commands need already exists as server
actions and well-defined tables. The cleanest path is a thin GitBox-specific MCP
surface that reuses the app's own write logic (recommended), not raw SQL through
the Supabase MCP server (works, but bypasses RLS and every app invariant) and not
browser automation (works with zero code, but brittle).

---

## Part 1 — Codebase grounding

### 1.1 What happens when a repository is added to a board

**UI → action call.** `AddRepositoryCombobox` calls the server action
`addRepositoriesToBoard(boardId, statusId, repositories)`
(`src/components/Board/AddRepositoryCombobox.tsx:398-402`). The `statusId` prop
defaults to the **first column** of the board
(`src/hooks/board/useAddRepositoryCombobox.ts:87-90`:
`resumedStatusId ?? statusLists[0]?.id`), or the column whose "Add Repo" button
opened the picker.

**The action.** `addRepositoriesToBoard`
(`src/lib/actions/repo-cards.ts:223-433`, file has `'use server'` at line 11):

1. Wrapped in `withAuthResultRateLimit('addReposToBoard', …)` — auth + rate
   limit (`repo-cards.ts:234-236`).
2. Zod-validates the payload with `addRepositoriesRequestSchema`
   (`repo-cards.ts:241-253`; schema in `src/lib/validations/repo-card.ts:54-80`,
   max 100 repos per call).
3. Reads the board and verifies ownership (`board.id` + `board.user_id =
claims.sub`, `repo-cards.ts:262-287`).
4. Backfills confirmed GitHub ids and loads every existing card placement
   (`backfillVerifiedRepositoryIds`, `lookupRepoPlacements`,
   `repo-cards.ts:268-278`).
5. **Verifies each repository's identity against the GitHub API**
   (`verifyRepositoryIdentities`, `repo-cards.ts:308-330`). This calls
   `GET /repos/{owner}/{name}` with the GitHub OAuth token from the
   `gh_token_*` cookie (`src/lib/github/verify-repository-identity.ts:81-112`,
   token read at line 85 via `getGitHubToken()` → `readGitHubTokenCookie()` in
   `src/lib/axios-github.ts:47-53` → `src/lib/constants/cookies.ts:184-196`).
   An insert **refuses** a repo GitHub did not confirm.
6. Splits addable vs already-placed repos (`splitRequestedRepos`,
   `repo-cards.ts:332-334`; one repo per user across all boards, issue #215).
7. Releases names held by a renamed repo (`releaseNamesHeldByAnotherRepository`,
   `repo-cards.ts:77-137`) — updates `repocard` and `projectinfo`.
8. Computes `order` = current max `order` in the target status column + 1
   (`repo-cards.ts:353-360`) — cards append to the **end** of the column.
9. **Batch insert into `repocard`** (`repo-cards.ts:363-389`) with columns:
   `board_id`, `status_id`, `repo_owner`, `repo_name`, `github_repo_id`,
   `order`, and `meta` = `{ stars, language, topics, visibility, description,
updatedAt, githubId }` (display snapshot; `repocard.ts` validation at
   `src/lib/validations/repo-card.ts:26-30`, enforced again by the
   `repocard_meta_display` CHECK constraint,
   `supabase/migrations/20261016151000_repocard_meta_display_check.sql:121-122`).
10. Returns `CreatedRepoCard[]` for Redux optimistic update
    (`repo-cards.ts:411-430`).

**DB-side mechanics that still apply to any writer:**

- `repocard.user_id` is force-set by the `set_repocard_user_id` trigger from
  `board.user_id` — a client-sent `user_id` is never trusted
  (`supabase/migrations/20261011011500_repocard_unique_repo_per_user.sql:86-112`).
- One repo per user: unique index `repocard_unique_repo_per_user` on
  `(user_id, lower(repo_owner), lower(repo_name))`
  (same migration, lines 116-117) plus partial unique index
  `repocard_unique_github_repo_per_user` on `(user_id, github_repo_id)` where
  not null (`supabase/migrations/20261016080200_repository_identity_by_github_id.sql:45-47`).
- A card's `status_id` must be a column of its own board
  (`repocard_status_board_fkey` guard, migration
  `20261011020000_repocard_status_board_guard.sql`).
- Boards and their columns are created atomically by the
  `create_board_with_status_lists(p_name, p_columns)` RPC, called by
  `createBoard` / `createBoardFromPreset`
  (`src/lib/actions/board.ts:479-520`,
  `src/lib/actions/board-creation.ts`; migration
  `20261012085900_create_board_with_status_lists.sql`).

### 1.2 How project-note links are stored

**Table.** `projectinfo` — one row per (user, repository), not per card
(issue #216; migration `20261014130000_projectinfo_belongs_to_repository.sql`).
Columns (`src/lib/supabase/types.ts:73-113`):
`id`, `user_id` (default `auth.uid()`, FK to `auth.users` ON DELETE CASCADE),
`repo_owner`, `repo_name`, `repo_key` (generated `lower(owner)||'/'||lower(name)`),
`github_repo_id`, `note` (Slate JSON text; DB-level text-length check via
`projectinfo_note_text_length`, migration
`20261016200000_note_text_length_check.sql`),
`comment`, `comment_color`, **`links` jsonb**, `updated_at`.
Unique: `projectinfo_unique_repo_per_user` on `(user_id, repo_key)`
(migration `20261014130000`, lines 179-180) + partial
`projectinfo_unique_github_repo_per_user` (migration `20261016080200:49-51`).

**Link record shape.** `ProjectLink = { url: string; type: string }`
(`src/lib/actions/project-info-core.ts:289-292`). `links` is a **JSONB array**
of these objects. Validation: `type` non-empty, `url` must be http(s) and
parseable (`src/lib/validations/project-info.ts:119-158`). Legacy object format
`{ production: [...], tracking: [...], supabase: [...] }` is normalized on read
(`normalizeLinks`, `project-info-core.ts:451-494`). There is **no DB CHECK on
the `links` jsonb shape** — only app-level Zod validation and defensive
`normalizeLinks` on read.

**Link types.** 55 built-in presets in `src/lib/constants/link-presets.ts:52`
including `vercel` (line 56), `supabase` (line 96), `resend` (line 157).
User-defined custom types live in `user_link_presets` (migration
`20260101100000_add_user_link_presets.sql`), managed by
`src/lib/actions/user-presets.ts` (`getUserPresets`, `createUserPreset`).

**Write path.** Note modal: `useNoteModal.save()` calls
`upsertProjectInfo(cardId, { note, links })`
(`src/hooks/board/useNoteModal.ts:160-175`) →
`upsertProjectInfo` (`src/lib/actions/project-info.ts:72-79`, `'use server'` at
line 16, rate-limited on key `projectInfo`) →
`upsertProjectInfoCore` (`src/lib/actions/project-info-core.ts:625-657`):

1. Validates note (Slate text ≤ 20 000), comment, each URL.
2. `readCardRepository` resolves the **card id → repository + board owner**
   through `repocard` + `board!inner(user_id)` — RLS makes a stranger's card
   read as missing (`project-info-core.ts:529-560`).
3. `writeRepositoryMemory` upserts on conflict target `user_id,repo_key`
   (`project-info-core.ts:42, 214-275`); if a memory already carries the
   confirmed `github_repo_id`, it updates that row in place.

**RLS on `projectinfo`:** `SELECT`/`ALL` scoped to `user_id = auth.uid()`, and
the `WITH CHECK` requires a `repocard` of the same user to exist for that repo
(by confirmed id, else by owner/name) — i.e. **you cannot write links for a
repository you have no card for** (migrations
`20261014130000:193-208` and `20261016080200:59-93`, which also allows writes
for a memory whose `github_repo_id` no card currently holds).

**Important for "add links to that card":** `upsertProjectInfo` is a full
note+links write — the `links` array sent replaces the stored one. An agent
must first `getProjectInfo` (`project-info.ts:48-54`) and merge, or pass the
existing note back. Note that `comment` is optional and preserved when omitted
(`project-info-core.ts:648-652`).

### 1.3 Auth model

- **Cookie-based Supabase Auth.** `createServerClient` from `@supabase/ssr`
  reads `sb-*-auth-token` cookies (`src/lib/supabase/server.ts:72-122`).
  Identity inside actions comes from `getCachedClaims()` →
  `supabase.auth.getClaims()` — a JWKS-verified JWT, no Auth-server round-trip
  (`src/lib/auth/get-cached-claims.ts:52-67`). All actions run inside
  `withAuthResult` / `withAuthResultRateLimit` / `withAuthRateLimit`
  (`src/lib/actions/auth-guard.ts:117-175`), which also apply in-memory rate
  limiting (`checkRateLimit`).
- **RLS:** every table owner-scoped — `board.user_id`; `statuslist` and
  `repocard` through the `board` join; `projectinfo`, `user_link_presets`,
  `user_settings` through `user_id` (migrations `20251115_initial_schema.sql:153-301`,
  `20260208_reenable_rls_optimized_policies.sql`).
- **Service role exists:** `createAdminClient()` uses
  `SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS**
  (`src/lib/supabase/server.ts:326-342`) — currently only for account
  deletion. The key is in local `.env` and in Vercel env for production.
- **GitHub OAuth provider token:** httpOnly cookie
  `gh_token_<first-8-of-supabase-ref>` (`gh_token_zfcwvzaz` prod,
  `gh_token_default` local), 30-day lifetime, `repo` scope
  (`src/lib/constants/cookies.ts:40-63`). Written at OAuth callback. Every
  GitHub API call — catalog, identity verification, card refresh — depends on
  this cookie.
- **Route protection:** `src/proxy.ts` guards page paths only; `/api` is
  excluded from the matcher (`proxy.ts:343-355`) — API routes check the
  session themselves (e.g. `src/app/api/boards/[id]/route.ts`,
  `src/app/api/repo-placements/route.ts`).

---

## Part 2 — MCP options

### Option A — Official Supabase MCP server (direct DB writes)

**What it is.** Hosted server at `https://mcp.supabase.com/mcp`; the Supabase
CLI dev stack exposes a limited local variant at `http://localhost:54321/mcp`
(same URL GitBox's local stack publishes; no OAuth there).
([supabase.com/docs/guides/ai-tools/mcp](https://supabase.com/docs/guides/ai-tools/mcp))

**Auth.** Hosted: OAuth via dynamic client registration (browser login to your
Supabase org) — no PAT needed. For CI/headless: a personal access token passed
as `Authorization: Bearer`; the docs now describe scoped PATs limited to a
project with per-tool permissions. `?project_ref=` scopes to one project,
`?read_only=true` runs all queries as a read-only Postgres user,
`?features=` filters tool groups, `?skip_elicitations=` skips confirmations.
([docs page, same URL])

**Tools.** `execute_sql` (raw SQL), `apply_migration`, `list_tables`,
`list_migrations`, `list_extensions`, `get_advisors`, `query_logs`, edge-function
tools, `search_docs`, etc. ([docs page, same URL])

**Critical implication — `execute_sql` runs as the `postgres` superuser**, i.e.
it **bypasses RLS entirely** (demonstrated: `current_user = postgres`; Supabase
itself calls this role "a real superuser risk", and its own docs describe the
read-only alternative as "a read-only Postgres user").
([github.com/supabase/mcp](https://github.com/supabase/mcp),
[independent verification](https://deep-dive.avetavos.com/supabase/en/reading-supabase/verification-tools/),
[Supabase defense-in-depth post](https://supabase.com/blog/defense-in-depth-mcp))

**Can it insert the card/link rows?** Technically yes — and triggers still
fire, so `set_repocard_user_id` would copy `board.user_id`, `repo_key` is a
generated column, the unique indexes and the `repocard_meta_display` /
note-length CHECKs still apply. **But** it skips everything the app layer does:
the Zod payload checks, the GitHub identity verification (`github_repo_id` must
be supplied correctly by hand or left NULL), the skipped-placement logic, the
`order` computation, and — most importantly — the `projectinfo` `WITH CHECK`
that forbids memories for repos you have no card for (RLS is off for
`postgres`). It also writes as whoever it wants: `projectinfo.user_id` defaults
to `auth.uid()` which is `NULL` under `postgres`, so the agent must set
`user_id` explicitly and correctly. One wrong `INSERT`/`UPDATE` can damage any
row in the DB, and Supabase's own docs warn about prompt-injection for exactly
this tool. Verdict: **fine for local dev / throwaway use, not something to point
at `gitbox-prod-tokyo` as the primary interface.**

### Option B — Custom GitBox MCP server (wraps app logic)

**SDK conventions.** Official TS SDK (`@modelcontextprotocol/server` v2 —
successor of `@modelcontextprotocol/sdk` 1.x): `new McpServer(...)`,
`server.registerTool(name, {description, inputSchema: zod}, handler)`, then
`StdioServerTransport` for a local spawned process or Streamable HTTP for
remote. ([modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk),
[ts.sdk.modelcontextprotocol.io](https://ts.sdk.modelcontextprotocol.io/server))

**Can GitBox's server actions be imported and called outside Next.js?**
**No**, as-is:

- `'use server'` files (`repo-cards.ts`, `project-info.ts`, `board.ts`,
  `board-data.ts`, `github.ts`, …) compile each export into an RPC reference —
  callable only through Next's server-action endpoint, not by `import`.
- The callable "core" modules deliberately avoid `'use server'`
  (`project-info-core.ts`, `repo-card-duplicates.ts`, `board-creation.ts`,
  `saved-repository-memories.ts`, `auth-guard.ts`) — but they still call
  `createClient()` (`src/lib/supabase/server.ts:72`), which calls
  `cookies()` from `next/headers` — a request-scoped API. Outside a Next
  request context there is no cookie store, so they throw.
- The write logic also depends on the GitHub token cookie
  (`gh_token_*`) for `verifyRepositoryIdentities` — an agent process has no
  such cookie.

**Feasible shapes (lowest-effort first):**

1. **`/api/mcp` route inside GitBox via `mcp-handler`** (Vercel Labs). v2
   mounts an MCP server into a Next.js route handler:
   `createMcpHandler(server => server.registerTool(...))` exported as GET+POST.
   ([npmjs.com/package/mcp-handler](https://www.npmjs.com/package/mcp-handler),
   [vercel.com/docs/mcp/deploy-mcp-servers-to-vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel))
   GitBox already satisfies requirements (Next ≥13, zod ^4.6.7, Node 20+;
   `package.json` has no MCP deps yet). Because the handler runs inside Next,
   it can reuse `project-info-core`'s functions **if** it can give them a
   Supabase client. Required refactor (small): extract the guard-closure of
   `addRepositoriesToBoard` into a `repo-cards-core.ts`-style function taking
   `{ supabase, userId, githubToken }`, mirroring how `project-info-core`
   already accepts a client (`writeRepositoryMemory(supabase, ownerId, …)`,
   `project-info-core.ts:214`). Auth for the route: a bearer token → either a
   **user JWT** placed in the client's `Authorization` header (RLS keeps
   working: build `createSupabaseClient(url, anon, { global: { headers: {
Authorization: `Bearer ${jwt}` } } })`) or, more practical for a
   single-user app, a **dedicated agent token** (`GITBOX_AGENT_TOKEN` env) that
   authorizes the handler to use `createAdminClient()` and pin
   `user_id = <owner uuid>` everywhere the app's code uses `claims.sub`.
   The `/api` path is already outside `proxy.ts`'s matcher, so token auth can
   live entirely inside the handler.
2. **Standalone stdio MCP process** (e.g. `scripts/gitbox-mcp/` or a sibling
   package, spawned by the agent's client config). It can't import the app's
   server code productively; it re-implements the ~150 lines of add/upsert
   logic against PostgREST via `@supabase/supabase-js`. Same credential
   question (user JWT vs service role) plus its own GitHub token.
3. **Thin internal REST API + any MCP** — same refactor as (1) but exposes
   `POST /api/agent/{add-repository,set-links}` instead of MCP tools; any MCP
   server or plain fetch then wraps it. Simplest to test, and doubles as a
   public API later.

**What auth does the custom server need?**

- _Best:_ a Supabase user JWT → PostgREST + RLS do the scoping; the app's own
  invariants (board ownership, card-exists-for-note) enforce themselves.
  Downside: access tokens expire in ~1 h and there's no password grant —
  GitHub OAuth only — so an agent-friendly long-lived JWT is awkward (would
  need a stored refresh token).
- _Practical for this single-owner app:_ dedicated agent bearer token on the
  route, service-role client inside it, `user_id` pinned to the owner's UUID.
  RLS is bypassed but the wrapped code re-applies the same filters
  (`board.user_id`, `projectinfo.user_id`, card→board join) the actions apply.
- _GitHub side:_ needs its own credential — a GitHub PAT or a copied OAuth
  token in env (`GITHUB_TOKEN`) for `verifyRepositoryIdentity` and, if exposed,
  the repo catalog.

**Effort:** option 1 ≈ 1–2 days: add `mcp-handler` + `@modelcontextprotocol/server`,
extract `addRepositoriesToBoard`'s inner body to a client-injectable core,
register ~6 tools, plus the agent-token check. Options 2–3 are similar size but
duplicate logic that then drifts from the app.

### Option C — Browser MCP (drive the real UI)

`chrome-devtools-mcp` (already configured in this session) drives the user's
actual Chrome via Puppeteer — `autoConnect` on Chrome ≥144 attaches to the
signed-in browser after a person approves, keeping the GitBox session +
`gh_token` cookie. `playwright-mcp` is the alternative (accessibility-snapshot
driven, persistent profiles).
([github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp),
[playwright.dev/mcp/introduction](https://playwright.dev/mcp/introduction))

The two example commands map to real UI flows: "Add Repositories" → search →
select `drinkgo` → Add (lands in the first column); card "⋯" menu → "Open note"
→ LinkManager "Add URL" per link → pick type (`supabase`/`resend`/`vercel` are
all built-in presets) → Save. **Zero new code**, exercises the true app end to
end — but brittle: async catalog loads, toast timing, virtualized list rows,
React state — no idempotency or atomicity, and it's per-UI-change fragile.
Right answer for occasional use or verification; wrong answer for a dependable
agent interface.

### Option D — Official GitHub MCP server

Covers the **GitHub API** only — repos, issues, PRs, actions, code security,
users — via toolsets (`repos`, `issues`, `pull_requests`, …).
([github.com/github/github-mcp-server](https://github.com/github/github-mcp-server))
It has **no knowledge of GitBox's Supabase tables** — it cannot create cards or
links. It _is_ a useful complement: it can resolve `owner/name` → repo id,
description, stars, topics — exactly the `github_repo_id` + `meta` payload a
GitBox `add_repository_to_board` tool wants.

---

## Part 3 — Verdict

### Ranked recommendation

1. **Custom thin GitBox MCP server** — `mcp-handler` route inside the app
   (`/api/mcp`) wrapping client-injectable cores of the existing actions.
   Reuses RLS semantics, validation, GitHub identity verification, order
   computation, and idempotent upserts. ~1–2 days. **Recommended.**
2. **Supabase MCP `execute_sql`** — zero code, works today, especially against
   local Supabase (`http://127.0.0.1:54321/mcp`). Acceptable for
   experiments/local; risky against production (postgres superuser, no RLS, no
   app invariants, prompt-injection surface).
3. **Browser MCP (chrome-devtools)** — zero code, keeps the real session, but
   slow and brittle; use as fallback or for verification.
4. **GitHub MCP** — not a GitBox interface at all; complementary for repo
   metadata lookup only.

### Tool list a GitBox MCP should expose

| MCP tool                     | Wraps                                                                                                              | Where                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `list_boards`                | `board` select / `getUserBoardsWithStatusLists`                                                                    | `src/app/boards/page.tsx:30-34`, `src/lib/actions/repo-cards.ts:483-532`                                  |
| `get_board`                  | `getBoardBundle(boardId)`                                                                                          | `src/lib/actions/board-data.ts:177-316`                                                                   |
| `create_board`               | `createBoard(name, presetId)` → `create_board_with_status_lists` RPC                                               | `src/lib/actions/board.ts:479-520`, `src/lib/actions/board-creation.ts`                                   |
| `list_repo_placements`       | `getUserRepoPlacements()`                                                                                          | `src/lib/actions/board-data.ts:97-118`                                                                    |
| `add_repository_to_board`    | `addRepositoriesToBoard(boardId, statusId?, repos)` — default `statusId` = first column like the picker            | `src/lib/actions/repo-cards.ts:223-433`; default col: `src/hooks/board/useAddRepositoryCombobox.ts:87-90` |
| `remove_repository`          | `deleteRepoCard(cardId)`                                                                                           | `src/lib/actions/repo-cards.ts:441-459`                                                                   |
| `move_repository`            | `moveCardToBoard(cardId, boardId, statusId)` → `move_card_to_board` RPC                                            | `src/lib/actions/repo-cards.ts:566-659`                                                                   |
| `get_project_note`           | `getProjectInfo` / `getProjectInfoCore(cardId)`                                                                    | `src/lib/actions/project-info.ts:48-54`, `project-info-core.ts:579-607`                                   |
| `upsert_project_note`        | `upsertProjectInfo` / `upsertProjectInfoCore(cardId, {note, links})`                                               | `project-info.ts:72-79`, `project-info-core.ts:625-657`                                                   |
| `add_project_links`          | read-modify-write over `getProjectInfoCore` + `upsertProjectInfoCore` (merge `[{type,url},…]` into existing links) | same files                                                                                                |
| `set_card_comment`           | `updateComment` / `updateCommentCore`                                                                              | `project-info.ts:94-102`, `project-info-core.ts:676-699`                                                  |
| `list_link_presets`          | `LINK_TYPE_PRESETS` + `getUserPresets()`                                                                           | `src/lib/constants/link-presets.ts:52`, `src/lib/actions/user-presets.ts:53-75`                           |
| `search_github_repositories` | `getAuthenticatedRepositoryCatalog()` (needs a GitHub token — cookie in-app, env token for MCP)                    | `src/lib/actions/github.ts:172-203`                                                                       |

For the two example commands: `list_boards` (resolve "Laststance" board) →
`add_repository_to_board` with `{owner, name}` (the tool resolves GitHub id via
`verifyRepositoryIdentity`-equivalent and lets `statusId` default to the first
column) → `add_project_links` with
`[{type:'supabase',url:…},{type:'resend',url:…},{type:'vercel',url:…}]` —
all three types are built-in presets (`link-presets.ts:56,96,157`).

### Security notes

- **Never put `SUPABASE_SERVICE_ROLE_KEY` in an MCP client config or prompt.**
  It bypasses RLS (`server.ts:308-342` documents the intent: admin only). Keep
  it server-side; the MCP boundary should see only a dedicated
  `GITBOX_AGENT_TOKEN` or a user JWT.
- **Direct-SQL (`execute_sql`) bypass risk:** it runs as `postgres` — the
  `projectinfo` card-existence `WITH CHECK`, the board-ownership `USING`
  clauses, and `user_id` defaults (`auth.uid()` → NULL under postgres) are all
  gone. Any SQL path must re-implement them.
- **Service-role path invariants to re-apply:** filter every query by
  `user_id = <owner>`; explicitly set `projectinfo.user_id` (no `auth.uid()`
  default under service role); enforce `links` array shape (`{type,url}[]`) —
  there is no DB CHECK on it; supply `github_repo_id` yourself (the
  GitHub-cookie verification can't run); respect `MAX_REPOSITORIES_PER_ADD`
  and the note/comment length limits (the note length CHECK does exist
  DB-side; comment length is app-only).
- **In-memory rate limiting** (`checkRateLimit`, `auth-guard.ts`) is
  per-process and per-key (`addReposToBoard`, `projectInfo`, `boardCrud`) — a
  custom MCP path bypasses it unless re-applied.
- GitHub metadata lands in `repocard.meta` and is rendered as text — the
  `repocard_meta_display` CHECK caps field sizes DB-side, but the Zod caps in
  `validations/repo-card.ts` are the first line; keep them in the tool.
