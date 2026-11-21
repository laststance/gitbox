# Plan: GitBox MCP server (agent-driven board operations) — v2 amended

Source research: `docs/research/gitbox-mcp-server-feasibility.md`. Amended by autoplan CEO+DX reviews (P0/P1 merged).

## Goal

Agent commands like "add the drinkgo repository to the Laststance board" and "add the Supabase/Resend/Vercel dashboard URLs to its project note" via a first-party MCP endpoint inside this app — same invariants as the UI.

## Route & deps

`src/app/api/mcp/route.ts` using `mcp-handler@^2` (+ `@modelcontextprotocol/server@^2`; NOT `@vercel/mcp-adapter` — stale). `export const runtime='nodejs'; maxDuration=30` (verification+backfill can chain ~25 GitHub calls). Export GET/POST/DELETE. Bearer check wraps the handler → HTTP 401 before MCP init.

## Auth (service-role + enumerated patches — v1 choice)

- `GITBOX_MCP_TOKEN` bearer (constant-time compare, `crypto.timingSafeEqual`). Unset/empty → route returns **503 disabled** (never default-accept).
- `GITBOX_MCP_OWNER_ID` = owner `auth.users` UUID. Client: `createAdminClient()` (service role, already provisioned locally + Vercel).
- **Required patches** (service role bypasses RLS and `auth.uid()`):
  1. `writeRepositoryMemory` upsert must set `user_id: ownerId` in the payload — `DEFAULT auth.uid()` is NULL under service role → unpatched first write = 23502 (`project-info-core.ts:268-273`, migration `20261014130000`).
  2. repo→card lookup pins `board.user_id = ownerId` (pattern exists `verify-repository-identity.ts:223`) — re-creates the `projectinfo` WITH-CHECK gate (repocard must exist before projectinfo write) **in code**.
- Alternative documented, not built: minted owner JWT (`GITBOX_MCP_USER_JWT` / `SUPABASE_JWT_SECRET` signing) keeping RLS intact — v2.
- Env: register all three (optional) in `src/lib/env.ts` (t3-env), `.env.local.example`, Vercel `laststance/gitbox`. Token gen: `openssl rand -hex 32`. `GITBOX_MCP_GITHUB_TOKEN`: classic PAT `repo` scope (or fine-grained read on owned repos — needed for private repos).
- `createAdminClient` docstring ("NEVER for regular operations", `server.ts:310`) amended to sanction the MCP route.
- Audit: `logSecurityEvent('mcp_tool_call', …)` (add enum `security-events.ts:25-31`) or pino `log.info({tool, repo})` per call.

## Refactor

- `repo-cards-core.ts` — **NO `'use server'`** (browser-callable-endpoint test enforces inventory). Signature `{ supabase, userId, githubToken, boardId, repos, statusId? }`; keeps action steps 3-10 (ownership check, identity verify, placement split, rename release, order=max+1, batch insert).
- `project-info-core` exported cores are cookie-bound (`createClient()` :582/:629/:681…) — only private `writeRepositoryMemory`/`readCardRepository` are injectable. Tools call the injectable helpers + a new repo-keyed card lookup; or add `{supabase, userId}` variants — smallest diff wins.
- **GitHub token threading** (all currently `getGitHubToken()`→cookie): optional `token` param on `verifyRepositoryIdentity`, `verifyRepositoryIdentities`, `lookupRepositoryByGitHubId`, `backfillVerifiedRepositoryIds` (+ transitive `releaseNamesHeldByAnotherRepository`, `relocateOrphanMemory`). Fallback = existing cookie path — **do NOT** add env fallback inside `getGitHubToken` (keeps UI path + `APP_ENV=test` mock-token intact; E2E needs no new env).

## Tools (v1 — 7)

| Tool                      | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_boards`             | boards select by owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `list_columns`            | `statuslist` rows for a board                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `list_repo_placements`    | `lookupRepoPlacements` (already injectable) — "is this repo placed anywhere"                                                                                                                                                                                                                                                                                                                                                                                                              |
| `list_link_presets`       | `LINK_TYPE_PRESETS` (`link-presets.ts:52`; supabase:96/resend:157/vercel:56) + `user_link_presets`                                                                                                                                                                                                                                                                                                                                                                                        |
| `add_repository_to_board` | input `repo:"owner/name"`, `board` name-or-id; board `ilike` multi-match → return candidates, never pick silently; `statusId` defaults first column by (grid_row, grid_col) mirroring `useAddRepositoryCombobox.ts:87-90`; extend `VerifiedRepository` to carry stars/language/topics/description/visibility/updated_at from the **same** `GET /repos/{o}/{n}` call → build `meta`+`github_repo_id` GitHub-sourced (satisfies schema `id` without a second request; also hardens UI path) |
| `get_project_info`        | `projectinfo` by repo_key                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `add_project_links`       | **server-side read-modify-write**: resolve repo→card (repocard ⋈ board.user_id=ownerId; absent → error, mirrors WITH CHECK) → read note+links → merge dedupe by `url` → write `{note: existing, links: merged}` via injectable helper. Empty/omitted note would erase the user's note — the footgun. `type` = non-empty + valid http(s) URL (custom user presets exist — NOT hard-checked against built-ins)                                                                              |

Dropped: `set_note` (contradicts out-of-scope), `search_github_repositories` (agents have gh/GitHub MCP).
Error envelope for self-correction: `{ok:false, error, code, hints}` — `BOARD_NOT_FOUND`+`availableBoards[]`, `AMBIGUOUS_BOARD`+`matches[]`, `INVALID_LINK_TYPE`→`list_link_presets`, `CARD_NOT_FOUND`→`list_repo_placements`. Reuse `ActionErrorCode`. `serverInfo.instructions` tells agents `repo` = `owner/name` + call `list_link_presets` first.

## Rate limit

`checkRateLimit('addReposToBoard'|'projectInfo', ownerId)` per tool — shares the UI budget (no dynamic prefix mechanism exists; `RateLimitKey` is a closed union).

## Testing

- Unit: cores (ownership refusal, order, link merge dedupe, user_id payload), token 401/503, arg validation — AAA conventions.
- E2E fixture: `APP_ENV=test` → GitHub token falls back to `GITHUB_E2E_MOCK_TOKEN`; owner = seed `00000000-0000-0000-0000-000000000001`. Call MCP endpoint: add repo → add links → `get_project_info` read-back.
- Real-account: scratch **board** + unplaced repos, localhost → production (AGENTS.md destructive-flow rules).
- SPEC.md: new MCP section + client config snippet (`{"url":"…/api/mcp","headers":{"Authorization":"Bearer …"}}`) local+prod; AGENTS.md setup note.

## Out of scope (v1)

Other write/delete verbs, MCP OAuth, multi-user installs, public-board writes, Slate-JSON note writes.

## v3 — Eng review amendments (approved-with-amendments)

- `writeRepositoryMemory`/`readCardRepository` are **private** — export them; patch upsert to `{...repository, user_id: ownerId, ...fields}` (`project-info-core.ts:271`) — covers all callers, no signature change.
- `addRepositoriesRequestSchema`: make `id` **optional** — already discarded before use (`repo-cards.ts:296` strips, `:326` overwrites with verified id). Tool passes `{owner,name}`+display fields; extended `VerifiedRepository` supplies id+meta in one GET.
- `add_project_links`: resolve via `lookupRepoPlacements(supabase, ownerId)` (injectable, `repo-card-duplicates.ts:121`); read note+links via `projectinfo` computed embed (`project-info-core.ts:586`); emit `{type,url}` literals (Json typing); validate URLs with `projectLinkUrlSchema`.
- Error codes: `ActionErrorCode` lacks BOARD_NOT_FOUND/AMBIGUOUS_BOARD/INVALID_LINK_TYPE — extend union or MCP-local `McpErrorCode`.
- mcp-handler v2: `createMcpHandler(init, {serverInfo:{name,version}, instructions: TOP-LEVEL})` — instructions NOT inside serverInfo. `registerTool(name,{title,description,inputSchema:z.object({...})},handler)`.
- Bearer: SHA-256 digest both inputs before `timingSafeEqual` (throws on length mismatch).
- E2E env wiring REQUIRED: `GITBOX_MCP_TOKEN`+`GITBOX_MCP_OWNER_ID` into `playwright.config.ts` webServer.env + `scripts/e2e-parallel.sh` (owner=seed `00000000-0000-0000-0000-000000000001`); MSW already mocks `GET /repos/:o/:r` under APP_ENV=test.
- `createAdminClient` docstring at `server.ts:313`. `repocard.user_id` auto-filled by trigger `set_repocard_user_id` — no manual value needed.
- Order race: no unique `(status_id,order)` constraint — same as today's two-tab race; accepted.
