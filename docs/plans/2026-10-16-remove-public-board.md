<!-- /autoplan restore point: "/Users/ryotamurakami/.cursor/worktrees/gitbox/w4ji/.gstack/tmp/autoplan/chore-remove-public-board-autoplan-restore-20261016-191649.md" -->

## URGENT, outside this plan

None.

## Implementation plan

# Remove public board sharing

Owner's direction (2026-10-16, message to the agent): remove the Public page feature completely. The owner is asleep for the whole run; every decision takes the recommended option, and every problem found on the way is filed as a GitHub issue in `laststance/gitbox`.

## Problem

A board can be made public from its settings. It then has a share slug and opens for anyone, signed in or not, at `/public/<slug>`. The feature costs a route, a database function that bypasses row level security (`get_public_board`, `SECURITY DEFINER`), two columns, an anonymous rate limit, a proxy exception for signed-out visitors, a settings tab, warnings in three dialogs, a board badge and a dozen deferred TODOs about what a shared page leaks (private repository names and descriptions, an irrevocable slug, the subtitle the owner hid). Removing it breaks no working link: on production 0 of 6 boards are public and 0 have a share slug (count-only query, 2026-10-16). With 2 users that says nothing about demand. The reason for the removal is the cost above, paid for a feature the owner no longer wants to carry; what a later version would need is kept in #257.

## Goal

GitBox has no public board. A board opens for its owner only, at `/board/[id]`. Nothing in the app, the database, the tests or the docs offers, reads or describes sharing a board by link.

Success:

- `git grep -n -i -E 'is_public|share_slug|get_public_board|public[ _-]?board|publicBoard|isPublic|shareSlug|share link|shared board|public link|isBoardShared|publicShareSlug|PUBLIC_BOARD|/public/\[slug\]|/public/<slug>|tab-sharing|panel-sharing|public sharing|name and globe|whose globe|board that is not shared|share slug|shareLink|the public page|its public page|even when public|four tabs|4-tab' -- src e2e mocks scripts supabase/seed.sql .storybook README.md CLAUDE.md SPEC.md TODOS.md` returns no lines. (A bare `not shared` would also match `src/lib/rate-limit/memory.ts:5`, which is about server instances, so the pattern names the board. A comment that wraps between two words of a phrase escapes the grep; section 4 names the ones found.)
- Production after rollout: `board.is_public`, `board.share_slug`, `idx_board_share_slug` and `get_public_board(text)` do not exist; no function in schema `public` mentions either column; the board count is unchanged.
- A signed-out visit to `/public/<anything>` is redirected to `/login`, as every other path the proxy matches.
- Board Settings has three tabs (General, Cards, Danger Zone). Copy Link copies the board's own address. Move to Another Board and Add Repositories show no sharing notice.
- The tenant-isolation cases still run, from `e2e/unauthenticated/board-data-access.spec.ts`: a visitor without an account lists nothing from `board`, `statuslist` or `repocard`; a signed-in user can neither read, change nor delete another user's board, columns or cards; the owner reads their own.
- After PR B no `SECURITY DEFINER` function in schema `public` that is not a trigger can be executed by `anon` (the verification query's `anon_definer_functions` is 0; on 2026-10-16 it is 1, `get_public_board`).

## Current state

Audit on production, counts only (2026-10-16): 6 boards of 2 users; 0 with `is_public = true`; 0 with `share_slug IS NOT NULL`; `get_public_board` is the only function in schema `public` whose body names `is_public` or `share_slug`; no view depends on the two columns; no policy on any table reads `is_public` (dropped by `20261011030000`); `idx_board_share_slug` exists, `idx_board_is_public` does not; the last applied migration is `20261016181500`, the newest file in the repository.

Where sharing lives today:

- DB: `board.is_public` (`boolean NOT NULL DEFAULT false`), `board.share_slug` (`text`, unique partial index `idx_board_share_slug`), function `get_public_board(p_slug text)` (`SECURITY DEFINER`, executable by `anon`, `authenticated`, `service_role`).
- Server: `src/lib/actions/public-board.ts` (`getPublicBoardBySlug`), `src/lib/validations/public-board.ts`, `toggleBoardPublic` and `generateSlug` in `src/lib/actions/board.ts`, `is_public` in the select and `isPublic` in the result of `getUserBoardsWithStatusLists` (`repo-cards.ts`), `BoardOption.isPublic` (`types.ts`), `isPublic: false` in `board-creation.ts`, `publicBoardView` rate limit (`rate-limit/config.ts`), `PUBLIC_BOARD_ROUTE_PREFIX` (`constants/routes.ts`), `isPublicBoardPath` in `src/proxy.ts`, `PublicBoardSlug`/`toPublicBoardSlug` (`types/brands.ts`), `ShareSlug` (`types/domain-primitives.ts`), the two columns and the function in `src/lib/supabase/types.ts`, comments in `constants/board-bundle.ts`, `board-data.ts`, `request-board-creation.ts`.
- Client: route `src/app/public/[slug]/**` (page, client, not-found, stories), `src/lib/utils/to-public-board-url.ts`, the Sharing tab of `BoardSettingsDialog` (switch, share URL field, copy button, what-is-visible line) and its props `isPublic`/`shareSlug`/`onPublicChange`, `isPublic`/`shareSlug`/`publicShareSlug`/`handlePublicChange` of `useBoardSettings`, the public branch of Copy Link in `BoardPageClient`, `isBoardShared` of `AddRepositoryCombobox` → `HeldRepositoryList` → `MoveHereDialog` (notice and `aria-describedby`), the globe badge of `BoardCard`, the globe mark, destination notice and `aria-describedby` part of `MoveToAnotherBoardDialog`, the "not shared first" preference of `useMoveDialogState`, the "ask them for its public link" line of `src/app/board/[id]/not-found.tsx`.
- Tests and fixtures: `e2e/unauthenticated/public-board.spec.ts`, `public-board-happy-path.spec.ts`, `public-board-data-access.spec.ts`; sharing cases in `move-to-another-board.spec.ts`, `board-not-found.spec.ts`, `one-repo-across-boards.spec.ts`, `board-settings-narrow-viewport.spec.ts`, comments in `add-repository-combobox.spec.ts`, `column-color-data-access.spec.ts`, `names-that-cannot-break.spec.ts` (lines 344 and 348: a shared board and its globe) and `src/tests/unit/lib/validations/board.test.ts` (line 251: the shared page); `PUBLIC_BOARD_SLUG` and `resetBoardPublicState` in `e2e/helpers/db-query.ts`; unit tests `public-board.test.ts`, `to-public-board-url.test.ts`, `app/public/*.test.tsx`, sharing cases in about 15 other unit test files; `is_public`/`share_slug` in `supabase/seed.sql` (two public boards, one named "Other User Public Board"), `mocks/handlers/data.ts` and three story files.
- Docs: `SPEC.md`, `README.md`, `CLAUDE.md`, `TODOS.md` (five entries about sharing only, about seven that mention it).

The lists name the known places. The definition of done is the `git grep` of Success.

## Plan

### 1. Migration `supabase/migrations/<version>_remove_public_board.sql`

The version is chosen when PR B's branch is created, not now. The repository names migrations by Japan time (`20261016181500` was committed at 18:18 JST), so the version is `TZ=Asia/Tokyo date +%Y%m%d%H%M%S` at that moment; `supabase migration new` names by UTC and would sort before the versions already applied. Right before PR B's merge the version must sort after the newest version applied on production (`SELECT max(version) FROM supabase_migrations.schema_migrations`: `20261016181500` on 2026-10-16), the newest file on `origin/main` and the newest migration file of every open PR (`20261016191000` of #260 on 2026-10-16); otherwise the file is renamed first, because `supabase db push` refuses a version older than the last one applied. It ships alone in PR B, after PR A's production deployment is Ready and the skew window of section 6 has passed. One `DO` block; `lock_timeout` 5s through `PERFORM set_config('lock_timeout', '5s', true)`, as `20261011030000` does. The header comment states the fix-forward rule of section 6.

1. Early return when `board.is_public`, `board.share_slug` and `get_public_board(text)` are all gone, so a second run does nothing.
2. Count the boards that are public and the boards that have a slug, each only while its column exists (`IF EXISTS` on `information_schema.columns`, the count through `EXECUTE`), so a run on a partial state does not fail on the missing column. `RAISE NOTICE` with the two counts (counts only; the CLI may not print it and no step depends on it). The migration does not refuse when a board is shared: removing the share is the change.
3. `DROP FUNCTION IF EXISTS public.get_public_board(text)`. No `REVOKE` before it: `REVOKE` has no `IF EXISTS`, so it would fail when the function is gone and a column is not, and dropping the function removes its grants.
4. `ALTER TABLE public.board DROP COLUMN IF EXISTS share_slug, DROP COLUMN IF EXISTS is_public` without `CASCADE`: a policy, view or index that still depends on a column makes the statement fail and the migration roll back, instead of being dropped unseen. `idx_board_share_slug` goes with its column.
5. Check, and raise (rolling everything back) when one fails: neither column exists; the function does not exist; no function in schema `public` has `is_public` or `share_slug` in its body (matched with `strpos(p.prosrc, ...) > 0`, not `ILIKE`: `_` is a one-character wildcard in a pattern, so `ILIKE '%is_public%'` also matches "is public" in a comment). Each check raises its own message, which starts with `remove_public_board:` and names the object, and puts the next step in `DETAIL` (the CLI prints a failed migration's message and `DETAIL`, not its `HINT`): "Nothing was changed (one transaction), and this migration is not recorded as applied. Change this migration file in a new commit on main so it handles what still uses it, run pnpm db:reset, and push again; a later migration cannot run before this one." A dependency at item 4 fails with Postgres's own error, which names the dependent object. The header says so, gives the fix-forward rule, and gives the emergency step for a rollback to a build before PR A after this migration ran: `ALTER TABLE public.board ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS share_slug text;` (old builds load again; the function stays gone, so nothing can be shared).

No reverse migration: there is no data to bring back (0 public boards), and the code that read the columns is gone since PR A, which ships first.

Type file: edit `src/lib/supabase/types.ts` by hand (it carries hand-written aliases): remove `is_public` and `share_slug` from `board` Row/Insert/Update and the `get_public_board` function entry. The edit ships in PR A: the columns that stay in the database until PR B do the code no harm.

`scripts/e2e-setup-databases.sh` has no `REVOKE`/`GRANT` for `get_public_board`, so it needs no change.

Rehearsal: `pnpm db:reset` applies every migration to a fresh local database; then the verification query below reads the result. The E2E job of CI applies the migrations with the CLI version that production pins (2.120.0), so a green CI is the run on the production CLI. A local `pnpm db:reset` uses the local CLI (2.121.0 on 2026-10-16), so it is a rehearsal of the SQL, not of the pinned CLI.

Verification query (local after `pnpm db:reset`, production after the migration run):

```sql
SELECT
  NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'board'
      AND column_name IN ('is_public', 'share_slug')) AS columns_gone,
  to_regprocedure('public.get_public_board(text)') IS NULL AS function_gone,
  NOT EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_board_share_slug') AS index_gone,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (strpos(p.prosrc, 'is_public') > 0 OR strpos(p.prosrc, 'share_slug') > 0)) AS functions_naming_columns,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
      AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_definer_functions,
  (SELECT count(*) FROM board) AS boards;
```

Expected: `true`, `true`, `true`, `0`, `0`, and on production the board count of the audit right before PR B's merge.

### 2. Server

- Delete `src/lib/actions/public-board.ts` and `src/lib/validations/public-board.ts`.
- `board.ts`: delete `toggleBoardPublic`, `generateSlug` and the "Public Board Sharing" section; the `@returns` of `createBoard` loses `isPublic`.
- `repo-cards.ts`, `getUserBoardsWithStatusLists`: select `id, name`; the result loses `isPublic`; the docstring says the dialog opens on the newest board when no move was made from this board yet.
- `types.ts`: `BoardOption` loses `isPublic` and its doc. `board-creation.ts` and `request-board-creation.ts`: drop `isPublic: false` from the result and the examples.
- `rate-limit/config.ts`: drop `publicBoardView`. The "Public: Unauthenticated endpoints" heading stays: `sentryTunnel` is under it.
- `constants/routes.ts`: drop `PUBLIC_BOARD_ROUTE_PREFIX`. `src/proxy.ts`: drop `isPublicBoardPath` and its branch; signed-out access is `publicPaths`, the metadata routes and the Sentry tunnel.
- `types/brands.ts`: drop `PublicBoardSlug`, `toPublicBoardSlug`. `types/domain-primitives.ts`: drop `ShareSlug`.
- Comments: `constants/board-bundle.ts` (the second reader of the card columns), `board-data.ts` (line 164, "even when public", and line 205: why a foreign board is not found), `validations/repo-card.ts` (lines 23 and 41: the fields are rendered on the card; "the public page" goes).

### 3. Client

- Delete `src/app/public/[slug]/**` and `src/lib/utils/to-public-board-url.ts`.
- `BoardSettingsDialog`: remove the Sharing tab button and panel, `SettingsTab` member `'sharing'`, the props `isPublic`, `shareSlug`, `onPublicChange`, the sharing state and its sync-from-props block, `handleTogglePublic`, `handleCopyShareLink`, the `copied` state and the icons and imports only they use. Three tabs remain: General, Cards, Danger Zone. The tab row keeps `flex-wrap`, and its comment (line 486), which gives four tabs as the reason, speaks of the tabs without a count.
- `useBoardSettings`: remove `isPublic`, `shareSlug`, `publicShareSlug`, `handlePublicChange`, the `shareLink` state and the render-time reset; the module doc loses the share slug line.
- `BoardPageClient`: Copy Link copies `${window.location.origin}/board/${boardId}`, the board's own address without a query (`?card=<id>` of `linked-card.ts` stays in the address bar after a card is revealed, and `window.location.href` would copy it), and its toast reads "Link copied!" with "Only the account that owns this board can open it." (one wording for the rule across the toast, the board 404 page, the README and the CHANGELOG: "A board opens only for the account that owns it."). The button keeps its place, label, icon and `title`. The board header keeps the button: it existed before sharing (#35, 2026-01-15; sharing came with #130, 2026-02-19) and copies the board's address for the owner's own use. Stop passing `isPublic`, `shareSlug`, `onPublicChange` and `isBoardShared`.
- `AddRepositoryCombobox`, `HeldRepositoryList`, `MoveHereDialog`: remove `isBoardShared`, the shared-board notice and its id in `aria-describedby`.
- `MoveToAnotherBoardDialog`: remove the globe mark in the board list, the shared-destination notice, `PUBLIC_DESTINATION_TEXT_ID` and the `isDestinationShared` parameter of `toMoveButtonDescription`.
- `useMoveDialogState`, `toMoveDialogView`: the destination is the board picked by hand, else the remembered one, else the first (the newest). The docstring says so.
- `BoardCard`: remove the globe badge and the comment about the box of name and globe. Delete only the `Globe` element: the wrapper `span` with `flex max-w-[calc(100%+4rem)] items-center gap-2` stays even with one child, because the measured width rule applies to that box (`CLAUDE.md` "Names that cannot break", re-measured by `names-that-cannot-break.spec.ts`).
- `src/app/board/[id]/not-found.tsx`: the line "To see someone else's board, ask them for its public link." becomes "A board opens only for the account that owns it." It is the same on every not-found, so it says nothing about the board that was asked for, and it tells the person who opened someone else's copied link why. The `/public/[slug]` note in the docstring goes.
- A visitor with an old `/public/<slug>` link: signed out, the proxy sends them to `/login`; signed in, the root 404. No redirect: production has no shared board, so no working link exists.

### 4. Tests and fixtures

- Delete: `e2e/unauthenticated/public-board.spec.ts`, `public-board-happy-path.spec.ts`, `public-board-data-access.spec.ts` (after its four tenant-isolation cases moved, below); `src/tests/unit/lib/actions/public-board.test.ts`, `src/tests/unit/lib/utils/to-public-board-url.test.ts`, `src/tests/unit/app/public/not-found.test.tsx`, `src/tests/unit/app/public/PublicBoardClient.hydration.test.tsx`, `src/app/public/[slug]/PublicBoardClient.stories.tsx`.
- Move: the four cases of `public-board-data-access.spec.ts` that test who can reach a board (lines 45, 66, 93 and 133: a visitor without an account lists nothing from the three tables; a signed-in user cannot read another user's board, columns or cards, nor change or delete them; the owner still reads their own) go to `e2e/unauthenticated/board-data-access.spec.ts`. The visitor's query reads the whole `board` table without the `.eq('is_public', true)` filter, which checks more than before; names and comments say "board" for "public board"; a board name read back is "Other User Board". The share-link cases (line 148 to the end) go with the feature. These four are the only database-level checks of row level security on those tables, and `anon` may `SELECT` every table (`20260625140000_restore_postgrest_role_grants.sql:18`), so row level security is all that stands between a visitor and the rows. The moved cases are extended to prove the Success line they back: the write case also tries to delete the other user's board and to rename and delete one of its columns, and checks with the service-role client that the board, the column and the card are still there and that every field it tried to change (the card's `order` too, not only `repo_name`) kept its value; the owner case reads the owner's columns and cards as well as the board; one new case: a visitor without an account cannot insert a row into `board`.
- Change, keeping every case that tests behavior that stays:
  - `move-to-another-board.spec.ts`: delete the shared-destination case (line 516). Its other cases pick Work Projects by hand, and the return dialog at line 367 expects Test Board, the only other board, so the new default changes none of them. `MoveToAnotherBoardDialog.test.tsx`, `repo-cards.move-destinations.test.ts`: drop `isPublic` from fixtures and delete the shared-board cases; the "opens on the first board" case covers the default.
  - `board-not-found.spec.ts`: the other user's board is opened by its id and shows "Board not found"; the assertion on the public-link sentence asks for "A board opens only for the account that owns it." instead. Its check that the board's name is not shown (line 70) asks for "Other User Board", the seed's new name, so it still checks something.
  - `one-repo-across-boards.spec.ts`: "another user's public board" becomes "another user's board"; the insert refusal and the picker case keep their assertions; the `is_public` field of its row type goes.
  - `board-settings-narrow-viewport.spec.ts`: tabs General, Cards, Danger Zone; its header (line 4) and the test names and values (lines 25 and 26) say three tabs. `BoardSettingsDialog.test.tsx:100` ("should display all four tabs") checks the three.
  - `names-that-cannot-break.spec.ts`: the comments at lines 344 and 348 stop naming a shared board and its globe; the measurements stay. `src/tests/unit/lib/validations/board.test.ts`: the comment at line 251 stops naming the shared page; the case stays.
  - Comments that wrap across lines, which the grep cannot see: the header of `column-color-data-access.spec.ts` (lines 8 and 9, "on a shared board the server prints it into the page a visitor loads") says the color is printed into a style attribute of the owner's own page; `one-repo-across-boards.spec.ts:602-603` ("even when it is public") loses that clause; `add-repository-combobox.spec.ts:943` and `src/components/Board/AddRepositoryCombobox.tsx:509` stop listing the notice of a shared board among what the panel holds. The 26rem least height of the panel and the 416px measurement stay; the next bullet says why the 26rem, measured with the notice, stays.
  - `add-repository-combobox.spec.ts:938` ("scrolls the whole panel on a window too short for a row of the list"): the seed's Test Board was public, so the notice was on screen in every E2E run and counted into the overflow this case needs. Without it the content may fit the 276px panel of a 300px window. The case keeps its claim: its window is lowered until the panel without the notice still cannot hold the search box, the filters, one row of the list and the buttons, but not below 256px (the height WCAG 1.4.10 Reflow uses for content that scrolls sideways, as the board does). Its comment carries the measured numbers, and it runs in step 1 of section 6. If the panel no longer overflows at 256px, the case asserts instead that the whole panel fits with Add reachable, and a GitHub issue records that the overflow path has no test. The comment at `AddRepositoryCombobox.tsx:504-510` says that 26rem was measured with the notice, which is gone, and stays so the 416px measurement and the panel's position do not change.
  - `add-repository-combobox.spec.ts:1085` ("keeps the search box and the Cancel / Add row in view on a short window with repositories placed elsewhere"): its numbers (a 560px window leaves the panel 473px, about 80px short) were taken with the notice on screen. It is re-measured the same way as `:938`: the window is lowered until the held list must give up height again, its assertion that the list stays under 184px holds there, and the comment gives the new numbers. The comments at `:1042` ("416px … on a shared board") and `names-that-cannot-break.spec.ts:570` ("the four tabs") change with the wording rule.
  - `BoardPageClient.test.tsx` (cases at lines 604 and 627): Copy Link copies `<origin>/board/<id>` and its toast says only the owner can open it, also when the page was opened at `/board/<id>?card=<cardId>`; the public-link cases go.
  - `useBoardSettings.test.ts`, `BoardSettingsDialog.test.tsx`: drop the sharing cases.
  - `proxy-signed-out-access.test.ts`: the case that let `/public/a1b2c3d4e5f6` through (line 50) now expects a redirect to `/login`; it is the only automated proof of the third line of Success, because E2E test mode skips the session check (`CLAUDE.md`, "Signed-out access"). The three look-alike cases (`/public/`, `/publicity`, `/public/<slug>/edit`, lines 105 to 147) go: they guarded the edges of a pass-through that no longer exists. The file header stops describing shared links.
  - `browser-callable-actions.test.ts`: drop `toggleBoardPublic` and `getPublicBoardBySlug` from the endpoint list.
  - `mappers.test.ts`, `LocalDate.test.tsx`, `board.create.test.ts`, `request-board-creation.test.ts`, `CreateBoardForm.test.tsx`, `BoardCard.test.tsx`, `BoardGrid.test.tsx`, `AddRepositoryCombobox.placements.test.tsx`: drop the removed fields from fixtures and expectations.
- `supabase/seed.sql`: drop `is_public` and `share_slug` from both board inserts and the header comment; "Other User Public Board" becomes "Other User Board", and the comment above it stops saying public. `e2e/helpers/db-query.ts`: drop `PUBLIC_BOARD_SLUG` and `resetBoardPublicState`; the other-user comment loses "PUBLIC". `mocks/handlers/data.ts` and the story files `BoardCard.stories.tsx`, `BoardGrid.stories.tsx`, `BoardPageClient.stories.tsx`: drop the two fields.
- Wording of comments that explain what was removed: "the removed sharing notice" or "link sharing (removed)", so the Success grep stays a hard gate; neither phrase matches its pattern.
- New tests: the extensions of the moved isolation cases and the signed-out insert case (above), the Copy Link case that starts from a `?card=<id>` address, and nothing else. No test asserts that a removed route or column is absent: the grep of Success runs once before PR A is marked ready. The kind of hole this route was (a `SECURITY DEFINER` function `anon` may call) is checked by the verification query's `anon_definer_functions`; a CI check of it goes to TODOS.md.

### 5. Docs

- `SPEC.md`: remove the sharing lines (combobox notice, Sharing tab, Public Board Sharing, the public part of Copy Link and of the move dialog, `publicBoardView`, the two columns, the done-list item, the RLS paragraph exception, the two spec table rows); Board Settings is a 3-tab dialog.
- `README.md`: the feature line "Public board sharing with unique share links" becomes "Private boards: a board opens only for the account that owns it".
- `CLAUDE.md`: route tree, "Names that cannot break" (line 567: `max-w-[calc(100%+4rem)]` on "the box of name and globe" becomes the box of the name), "Client Components rendered by Server Components" (its example of a render-time reset, `shareLink` in `useBoardSettings`, becomes `adoptedComments` in `useCommentState`, `src/hooks/board/useCommentState.ts:77`), `board` schema line, `statuslist` color line (the check stays: the color is printed into a style attribute of the owner's page), `createBoard` returns `{ id, name, statusLists }`, Server Actions tree (`public-board.ts`), the `isPublic` sentence of "Board data and optimistic writes", the shared-board examples in "Hydration", the `/public/<slug>` part of "Signed-out access". Two additions in files this plan edits: under "Production Migration Procedure", a compatibility note (after PR B, PR A's merge commit is the oldest build that runs on production's schema; an Instant Rollback goes to it or later; the emergency step of the migration header; the verification query lives in this plan); under "Local Development Setup", a worktree note (a git worktree has no ignored files: copy `.env` and `supabase/.env` from the main checkout before `pnpm db:reset`, never `.env.production`; the local stack is shared by every checkout, so one E2E run at a time; #261 for the rest).
- `TODOS.md`: delete the entries that exist only for sharing ("Decide what a shared board shows of a private repository", "Tell a failed lookup apart from a missing shared board", "Trim what a shared board link gives away", "Keep the Copy Link target in step with the board's sharing state", "Show a hidden subtitle on the shared page only when the owner wants it"); in the others drop the sharing parts and keep the rest. "Show the fetched board name, subtitle and card display settings after a refetch" (lines 256 and 260) takes `shareLink` of `useBoardSettings` as its pattern; it takes `adoptedComments` of `useCommentState` instead. One entry is added: "Check in CI that no `SECURITY DEFINER` function is executable by `anon`" (the verification query's `anon_definer_functions`, run in the E2E job against the `postgres` database after `supabase db reset`, not against a shard: shards are cloned with `pg_dump --no-privileges`, so every function there looks executable by `PUBLIC`; trigger and event-trigger functions are excluded; today every new function has its `REVOKE` written by hand).
- `CHANGELOG.md` and `VERSION` through `/ship`. The entry says that public board links are gone and that "A board opens only for the account that owns it." PR B's entry names PR A's merge commit as the oldest build that runs on the new schema. History stays in `CHANGELOG.md`, `docs/plans/`, `docs/designs/` and old migrations, which are not edited.

### 6. Rollout

0. Preflight, before any change and before any reset; a failed item stops the run or is reported as "not checked", as named: `gh auth status` shows `ryota-murakami` active (stop otherwise); Docker runs and `pnpm db:start` has the local stack up (stop otherwise); `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp "select 1"` answers (stop before step 5 otherwise); no other checkout uses the shared local stack: `docker ps` shows no shard container and `pgrep -fl 'playwright test|e2e-parallel|e2e-setup-databases|supabase db reset'` shows no process of another checkout (a plain Playwright run resets the database in `e2e/global-setup.ts` without any shard container, and `e2e-parallel.sh` resets before it creates them). This check runs again right before every reset, E2E run and screenshot run, not once; while another checkout is busy the run waits, reading every 60 seconds for at most 60 minutes, then stops and reports. A lock that both entry points respect stays in #261; Vercel Skew Protection is read from the project API (`skewProtectionMaxAge`: 43200 seconds, 12 hours, on 2026-10-16) for step 9; this worktree has `.env` and `supabase/.env`, copied from the main checkout, and no `.env.production`; the local and production browser sessions as `ryota-murakami` and Sentry access are checked when steps 3, 8 and 10 need them, and reported "not checked" when missing. The local database is reset by the E2E commands; the owner's local boards are not kept (`CLAUDE.md`, "Verification with the real account").
1. Checks in this order, which overrides the "run in parallel" line of `CLAUDE.md` "Critical Rules" for this change: `pnpm test run`, `pnpm lint` and `pnpm typecheck` together (`pnpm test` alone is `vitest` in watch mode); then `pnpm build`; then `pnpm e2e:parallel` alone (it builds into the same `.next` with its own environment and resets the local database).
2. Gates. PR A: the Success grep (exit 1 means no match: pass, printed as "grep gate: pass"; exit 0 means a match: fail; anything else means the grep itself failed) and `pnpm knip` against `main`, plus one pass that does not gate: `git grep -n -i -w -E 'sharing|globe|shared'` over the same paths, each line triaged in PR A's body as kept (not about board sharing) or changed. PR A's database keeps the two columns and the function, so the verification query is not run for PR A. PR B: on PR B's branch, `pnpm db:reset`, then the verification query. The SQL of this plan runs from files under `.gstack/tmp/` (untracked, so the grep never sees them): locally `supabase db query --local -f <file> --output-format json`, on production `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp -f <file> --output-format json`; `jq -e` checks the expected values, after a `select 1` has shown the JSON shape.
3. Local check as `ryota-murakami` on `http://localhost:3008`, on a board with repositories in two columns: Board Settings shows three tabs; Copy Link copies the board address and its toast reads as section 3 says; Add Repositories and Move to Another Board show no sharing notice; a signed-out `/public/a1b2c3d4e5f6` redirects to `/login`; another account's board id shows "A board opens only for the account that owns it.". Screenshots before (on `main`) and after, at 375px and 1280px wide: the `/boards` grid with a board whose name is one long word; each Board Settings tab at 375px (the observed row layout of the three tabs goes into the header of `board-settings-narrow-viewport.spec.ts` and the comment at `BoardSettingsDialog.tsx:486`; Danger Zone alone on a second row is acceptable, it sets the destructive tab apart); the Add Repositories panel at 1280x720 and at the short window of `add-repository-combobox.spec.ts:938`; the Move dialog with its board list open. They go into PR A's body. The header comment of `BoardPageClient.tsx:225-233` ("all four buttons") stays true: the header keeps four buttons. Order: the before screenshots are taken first, in this worktree at the commit PR A starts from (`origin/main`, step 5) before any change, after `pnpm db:reset` (the seed's Test Board is public there, so the notices show); the after screenshots on PR A's branch after its own `pnpm db:reset`. One Playwright script under `.gstack/tmp/` lists every view, width and file name and creates the board whose name is one long word, so the set can be taken again after a rebase.
4. Two PRs. PR A (`chore/remove-public-board`) holds everything but the migration file: client, server, `types.ts`, tests, stories, fixtures, `supabase/seed.sql` and docs. Its merge touches no path that starts `supabase-production.yml` (`supabase/migrations/**`, `supabase/config.toml`, the workflow file), so it runs no migration, and the two columns and the function stay in the database, read by nothing. PR B (`chore/drop-public-board-columns`, from `main` after PR A merged) holds the migration file only. Commits of PR A: (a) removal from client and server with tests, stories, fixtures, the `types.ts` edit (the fixtures are typed `Tables<'board'>`, whose `Row` lists the two columns, so the type and the fixtures change together) and the seed (the moved isolation spec reads "Other User Board" back, so the seed rename lands with it and the commit is green on E2E too); (b) docs. Each passes `pnpm typecheck`. `/review` and `/ship` for each PR (CI on the PR). Before PR A is marked ready, the `git grep` of Success runs and its output (expected: no lines) goes into the PR body, with a link to #254 and #257 (found during the review; the body must not put close, fix or resolve in front of a number). PR B's CI applies every migration with the pinned CLI, which is the rehearsal on the production CLI.
5. PR A starts from `origin/main` as fetched when the implementation starts (`aad85ac` on 2026-10-16, two merges past `fae230d`): other runs merge to `main` meanwhile, and nothing requires a branch to be up to date before it merges. Right before each merge: fetch, rebase on `origin/main`, run the `git grep` of Success and `pnpm typecheck`, let CI run again, and put the new grep output into the PR body. After PR A merges, the diff of every open PR is searched for the removed names (`gh pr diff <n> | rg -i 'isPublic|is_public|toggleBoardPublic|isBoardShared|share_slug|publicShareSlug'`), and a PR with a hit gets a comment naming the lines (PR #260 edits `types.ts`, `board-data.ts` and `TODOS.md` too). The Test workflow run of PR A's merge commit (`push` to `main`) must be green before PR B is opened. Before PR B's merge, also the production audit, with `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp "<sql>"` (works from any directory; `--project-ref` alone is refused): `SELECT count(*) FILTER (WHERE is_public) AS public_boards, count(*) FILTER (WHERE share_slug IS NOT NULL) AS boards_with_slug, count(*) AS boards FROM board` and `SELECT count(*) AS functions_naming_columns FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (strpos(p.prosrc, 'is_public') > 0 OR strpos(p.prosrc, 'share_slug') > 0)`. Expected: 0, 0, the board count (6 on 2026-10-16), and 1 (`get_public_board`). A public board found here is reported in PR B and the final report (its count and whether it is the owner's board or the other account's, never its slug), and the merge goes on: the owner asked for the removal, and the share ends with it. When it is the other account's, a GitHub issue records the count and the owner kind, so the owner can tell that user; its visitors meet the sign-in page afterwards.
6. Merge PR A. No migration runs. Confirmed once step 7 has reached `success`, by sha and not by position: `gh run list --workflow supabase-production.yml -L10 --json headSha | jq -e --arg s "$SHA" 'map(select(.headSha == $s)) | length == 0'`.
7. Wait for the Vercel production deployment of PR A's merge commit to be Ready. Poll `gh api "repos/laststance/gitbox/deployments?sha=<full 40-character merge sha>&environment=production" --jq '[.[] | select(.creator.login == "vercel[bot]")][0].id'` until it prints an id (the filter ignores case, and the migration workflow's job writes `production` records of its own as `ryota-murakami`; Vercel's are `Production` by `vercel[bot]`), then poll `gh api repos/laststance/gitbox/deployments/<id>/statuses --jq '.[0].state'` until it prints a final state. Every poll of this plan waits 15 seconds between reads and has a deadline: 10 minutes for a record to appear, 30 minutes for the deployment to finish. `success` goes on; `failure`, `error` or `inactive`, or a deadline, stops the run before PR B: a GitHub issue records the sha, the deployment URL and the last state, and the final report names the step to resume from. The new build runs on the old schema: it names neither column nor the function.
8. Production check of PR A as `ryota-murakami`: Board Settings has three tabs; Copy Link copies the board address; Move to Another Board between two scratch boards (deleted afterwards); signed-out `/public/a1b2c3d4e5f6` redirects to `/login`. Sentry: the issues of the first hour after the deployment, if the session can reach Sentry; otherwise reported as not checked.
9. Open PR B from `main` and get CI green. PR B merges only after PR A's production deployment has been Ready for `skewProtectionMaxAge` seconds (43200, 12 hours, on 2026-10-16; read again from the project API at this step): Vercel Skew Protection serves a tab opened before PR A from the old build's server actions and server components for that long, and the old build selects `is_public`. When the session cannot wait so long, PR B stays open and green with the earliest merge time (JST) in its body, a GitHub issue records steps 9 to 11 as the remaining work, and the final report says the database step is pending. At merge time: the production audit of step 5, the version check of section 1, then merge PR B. The `push` run of `supabase-production.yml` applies the migration: poll `gh run list --workflow supabase-production.yml --event push -L10 --json databaseId,headSha,createdAt,status` until an entry has PR B's full merge sha (10 minutes at most), keep its `databaseId`, and read `gh run view <databaseId> --json status,conclusion,url` every 15 seconds for at most 20 minutes (`gh run watch` has no deadline). `completed` with `success` goes on; any other conclusion follows "When the migration run fails" below; at the deadline the outcome is unknown: the run stops, nothing is retried, and a GitHub issue records the run URL and its last state. Run the verification query on production (`supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp`, as in step 5).
10. Production check of PR B as `ryota-murakami`: Move to Another Board loads its boards (the reader that named `is_public` is gone since PR A; this shows the live build reads neither column) and the Board Settings dialog opens.
11. The final report lists both PRs, the migration run, the verification result and the checks of steps 8 and 10, with the board each check used and how many cards it held. Each PR body and the final report hold a table from every line of Success to its proof (command or test, and its output or artifact). The signed-out redirect on production is proved without a browser: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://gitbox-laststance.vercel.app/public/a1b2c3d4e5f6` prints a redirect to `/login`.

No mixed window: PR B merges only after PR A's production deployment is Ready and the skew window of step 9 has passed (steps 6 to 9), and PR A's build works on both schemas. The build before PR A never meets the new schema; in one PR it would, for the minutes of the Vercel build, and Move to Another Board could not load its boards then (its select names `is_public`). No workflow is disabled at any point. If the run stops between the two PRs, production is consistent: the code is gone, the two columns and the function stay, and nothing reads them. Until PR B, `get_public_board` stays callable, and an owner could still set `is_public` and `share_slug` on their own board through the API, as today; the function answers for nothing else. If PR A's deployment fails, PR B waits for a fixed deployment of `main`. A tab opened before the deployment keeps the old client until it is reloaded, and Skew Protection sends its server actions to the old build for up to 12 hours; there its Sharing switch still writes the columns, which still exist, and a link made then opens nothing, because every page load goes to the new build (the audit of step 5 counts such a share before PR B). After the window its Sharing switch calls a server action the new build no longer has: Next.js answers with an unrecognized-action error, `handleTogglePublic` (`BoardSettingsDialog.tsx:323-340`) has `try`/`finally` and no `catch`, so the switch stays where it was without a message and the error may reach Sentry. A reload brings the new build. The old client cannot be changed any more, so this needs no code.

Rollback. Before PR B, PR A can be rolled back like any change (Vercel Instant Rollback or a revert), because the old build still finds its columns. Fix forward only after PR B: once the migration has run, a rollback to a build before PR A brings back a move dialog that selects `is_public` and fails to load its boards. A rollback to PR A's build stays safe. A defect is fixed by a new commit on `main`. The header of the migration says the same, as `20261011030000` does for its own change.

When the migration run fails: the database is unchanged (one transaction) and the new build works on the old schema. On `lock_timeout` or a deadlock, once its conclusion is `failure`, run the same run again once with `gh run rerun <databaseId>` (it keeps the event and the sha, so the poll of step 9 still finds it) and read it as step 9 does; a second failure stops the run, and a GitHub issue records it. When the CLI refuses the file as older than the last applied version, nothing ran: rename the file to a version that sorts after the remote maximum (section 1) in a new commit on `main`, and its push run applies it. On any other error, first confirm that the version is not in production's `supabase_migrations.schema_migrations`, then change the same migration file in a new commit on `main` (a later migration cannot run before it), rehearse with `pnpm db:reset`, and its push run applies it.

## Out of scope

- A redirect from `/public/<slug>`: no working link exists.
- Another way to show a board to someone else (an export, a read-only invite). A feature of its own, not asked for.
- Editing old migrations, `CHANGELOG.md` entries, `docs/plans/2026-*.md` or `docs/designs/*.md` (history: `docs/designs/issue-216-repository-memory.md` names shared boards and `get_public_board` as they were when it was written; the Success grep leaves `docs/` out for that reason).
- The `statuslist_color_hex` check: it stays; the color is still printed into a style attribute.
- The privacy policy's wording about which repositories are stored (`src/app/privacy/page.tsx:62`): found during the review, filed as #254, not part of this change.
- Returning to the requested board after sign-in (a copied board link opened signed out ends on `/boards`): existed before, filed as #258.
- Arrow-key navigation and touch targets of the Board Settings tabs: existed before, filed as #259.
- Sharing in another form (a snapshot the owner generates, an export, a demo board on the landing page): what a later version needs is kept in #257.

## Requirements added in review

Accepted during the review, by phase. Sections 1 to 6 govern; this list is an index of what the review added. Where two items differ, the later phase wins: Design over CEO, DX over both (the README and CHANGELOG wording, for example, is the Design item's).

<!-- autoplan-accepted:ceo -->

- Two PRs. PR A holds everything but the migration file (client, server, `types.ts`, tests, stories, fixtures, `supabase/seed.sql`, docs) and touches no path that starts `supabase-production.yml`. PR B holds the migration file only and merges after PR A's Vercel production deployment is Ready and PR A's production check passed. No workflow is disabled. Verified in the final report by the run list of `supabase-production.yml` (no run for PR A's merge sha, one `push` run for PR B's) and the two production checks.
- The Vercel deployment is found with the full 40-character merge sha and `select(.creator.login == "vercel[bot]")`, polled until an id appears, and is Ready when its latest status is `success`; PR B's migration run is polled until its `headSha` is PR B's full merge sha and awaited with `gh run watch --exit-status`.
- Before PR B, PR A can be rolled back like any change; after PR B the change is fixed forward only, and a rollback to PR A's build stays safe. Section 6 and the migration's header say so.
- The four tenant-isolation cases of `public-board-data-access.spec.ts` (lines 45, 66, 93, 133) move to `e2e/unauthenticated/board-data-access.spec.ts`; the visitor's query reads the whole `board` table without the `is_public` filter; they are a line of Success.
- The verification query has `anon_definer_functions` (no non-trigger `SECURITY DEFINER` function in `public` executable by `anon`), expected 0 after PR B; a CI check of it is a new TODOS.md entry.
- The Problem section says the counts show that no working link breaks, not that nobody wants sharing; the requirements of a later sharing feature are kept in issue #257.
- The CHANGELOG entry of PR A says that public board links are gone and that a board opens for its owner only. README's feature line becomes "Boards are private to you".
- Copy Link stays; its origin is #35 (2026-01-15), before sharing (#130).
- The `git grep` of Success (with `tab-sharing|panel-sharing|public sharing|name and globe|whose globe|board that is not shared|share slug|shareLink|the public page|its public page|even when public|four tabs|4-tab`) runs before PR A is marked ready and after any rebase; its output (expected: no lines) goes into the PR body, which links #254 and #257 without a closing keyword in front of a number.
- Production SQL runs as `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp`; the audit before PR B is the two count queries of step 5, and a public board found then is reported (count and owner kind, no slug) while the merge goes on.
- The migration drops `get_public_board(text)` with `DROP FUNCTION IF EXISTS` and no `REVOKE`, sets `lock_timeout` through `set_config`, and counts each column only while it exists.
- `proxy-signed-out-access.test.ts` expects a signed-out `/public/a1b2c3d4e5f6` to be redirected to `/login`, and its three look-alike `/public` cases are deleted.
- The `types.ts` edit is in PR A's first commit, with the fixtures typed by it.
- Wording the grep cannot see changes too: the header of `column-color-data-access.spec.ts`, `one-repo-across-boards.spec.ts:602-603`, `add-repository-combobox.spec.ts:943`, `AddRepositoryCombobox.tsx:509`; `validations/repo-card.ts:23/41`, `board-data.ts:164`, the settings dialog's tab comment (line 486), `board-settings-narrow-viewport.spec.ts:4/25/26`, `BoardSettingsDialog.test.tsx:100`, the `TODOS.md` entry that takes `shareLink` as its pattern. The panel's 26rem least height stays.
- `add-repository-combobox.spec.ts:938` keeps its claim (a window too short for one row of the list) with a window lowered until the panel without the notice still overflows; its comment carries the measured numbers.
- `board-not-found.spec.ts:70` asks for "Other User Board".
- `docs/designs/` is history and is not edited, like `docs/plans/` and `CHANGELOG.md`.
- `CLAUDE.md`'s example of a render-time reset becomes `adoptedComments` in `useCommentState`; the "Public: Unauthenticated endpoints" heading of the rate-limit config stays.
- An old tab's Sharing switch after PR A's deployment stays where it was without a message (unrecognized action, no `catch`); a reload fixes it; no code.
- The production check of PR A looks at the Sentry issues of the first hour after the deployment when the session can reach Sentry, and says "not checked" otherwise.
- `pnpm knip` runs before PR A is marked ready and shows no unused file or export that `main` does not show.

<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->

- One wording for the rule, "A board opens only for the account that owns it." (it replaces the README line "Boards are private to you" and the CHANGELOG wording "a board opens for its owner only" of the CEO block): the board 404 page shows it in place of the public-link line, Copy Link's toast says "Only the account that owns this board can open it.", README's feature line is "Private boards: a board opens only for the account that owns it", and the CHANGELOG uses it; `board-not-found.spec.ts` asserts the sentence on the page.
- `BoardCard` loses only the `Globe` element; its wrapper span with `flex max-w-[calc(100%+4rem)]` stays.
- `add-repository-combobox.spec.ts:938` lowers its window no further than 256px; if the panel no longer overflows there, the case asserts that it fits with Add reachable, and an issue records the untested overflow path. The comment at `AddRepositoryCombobox.tsx:504-510` says 26rem was measured with the notice and stays unchanged.
- The local check takes screenshots before and after at 375px and 1280px of the `/boards` grid (a one-word board name), each Board Settings tab at 375px, the Add Repositories panel (1280x720 and the short window) and the Move dialog's open board list; they go into PR A's body; the observed three-tab layout at 375px goes into the narrow-viewport spec's header and the tab row comment.
- An other account's public board found before PR B is merged anyway and recorded in a GitHub issue (count and owner kind, no slug).
- The stale tab's silent Sharing switch is a recorded release exception; no code.
- The header comment "all four buttons" of `BoardPageClient.tsx` stays.

<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->

- Sections 1 to 6 govern; "Requirements added in review" is an index, and where two items differ the later phase wins (Design over CEO, DX over both).
- A step-0 preflight runs before any change or reset: `ryota-murakami` active in `gh`; Docker and the local stack up; the linked production query answers; no other checkout runs E2E on the shared stack; `.env` and `supabase/.env` present and no `.env.production`; sessions and Sentry checked when needed, else "not checked".
- Checks run in this order: `pnpm test run`, `pnpm lint`, `pnpm typecheck` together; then `pnpm build`; then `pnpm e2e:parallel` alone.
- PR A's gate is the Success grep (exit 1 = pass, printed "grep gate: pass"; exit 0 = fail; else the grep failed) and `pnpm knip`; the verification query runs on PR B's branch after `pnpm db:reset`. SQL runs from untracked files under `.gstack/tmp/` with `-f` and `--output-format json`, checked with `jq -e`.
- Every poll waits 15 s between reads, has a deadline (10 min for a record to appear, 30 min for a deployment), and ends on a final state; anything but `success` stops the run before PR B and files an issue with the sha, URL and last state. Runs are found by full sha across `-L10`. A failed migration run is retried once with `gh run rerun <databaseId>`, then the run stops and an issue records it. The check that PR A started no migration runs after its deployment reached `success`.
- Each check of the migration raises a message that starts with `remove_public_board:`, names the object and puts the next step in `DETAIL`; the header gives the fix-forward rule and the emergency restore of the two columns for a rollback to a build before PR A.
- `CLAUDE.md` gains a compatibility note under "Production Migration Procedure" (after PR B, PR A's merge commit is the oldest compatible build; Instant Rollback to it or later; the emergency restore) and a worktree note under "Local Development Setup" (copy `.env` and `supabase/.env`, never `.env.production`; one E2E run at a time; #261).
- PR B's CHANGELOG entry names PR A's merge commit as the oldest build that runs on the new schema.
- Comments that explain what was removed say "the removed sharing notice" or "link sharing (removed)".
- The before screenshots are taken at `fae230d` before any change, after `pnpm db:reset`; the after screenshots on PR A's branch; one untracked Playwright script lists every view, width and file.
- PR A's first commit holds the seed rename with the code, tests, fixtures and `types.ts`; the second holds the docs.
- Each PR body and the final report map every line of Success to its proof; the signed-out redirect on production is proved with `curl`.
- PR A's body says that open branches using `isPublic` or `toggleBoardPublic` stop compiling after a rebase.

<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->

- PR B's migration version is the JST time (`TZ=Asia/Tokyo date +%Y%m%d%H%M%S`) when its branch is created, never `supabase migration new` (UTC); right before the merge it must sort after production's `max(version)` of `supabase_migrations.schema_migrations`, the newest file on `origin/main` and the newest migration file of every open PR (#260 has `20261016191000`), else it is renamed first. A refusal as older than the last applied version is fixed by a rename in a new commit on `main`.
- The migration's self-check `DETAIL` says the migration is not recorded as applied and tells the operator to change this same file in a new commit, run `pnpm db:reset` and push again; any non-transient failure first confirms the version is absent from production's `schema_migrations`.
- Function-body matches use `strpos(p.prosrc, '…') > 0`, not `ILIKE`, in the migration, the verification query and the step 5 audit; `anon_definer_functions` excludes `trigger` and `event_trigger` return types.
- PR A starts from `origin/main` as fetched at implementation start (`aad85ac` on 2026-10-16); right before each merge: fetch, rebase on `origin/main`, the Success grep, `pnpm typecheck`, CI again, new grep output in the body. After PR A merges, every open PR's diff is searched for the removed names and a hit gets a comment; the Test workflow of PR A's merge commit is green before PR B is opened.
- PR B merges only after PR A's production deployment has been Ready for `skewProtectionMaxAge` (43200 s, 12 h on 2026-10-16, read again at step 9); when the session cannot wait, PR B stays open and green with the earliest merge time (JST) in its body, a GitHub issue records steps 9 to 11, and the final report says the database step is pending.
- The migration run is read with `gh run view <databaseId> --json status,conclusion,url` every 15 s for at most 20 min (no `gh run watch`); at the deadline the outcome is unknown, nothing is retried, and an issue records the run.
- The preflight's shared-stack check adds `pgrep -fl 'playwright test|e2e-parallel|e2e-setup-databases|supabase db reset'` to `docker ps`, runs again right before every reset, E2E run and screenshot run, and waits (60 s reads, 60 min deadline) while another checkout is busy, then stops and reports.
- The moved isolation cases are extended: the other user's board delete and a column rename and delete are refused, with service-role read-back of every field tried (the card's `order` too); the owner reads columns and cards; a new case: a visitor cannot insert into `board`.
- Copy Link copies `${window.location.origin}/board/${boardId}`; `BoardPageClient.test.tsx` adds a case that starts from `/board/<id>?card=<cardId>`.
- `add-repository-combobox.spec.ts:1085` is re-measured like `:938`; the comments at `:1042` and `names-that-cannot-break.spec.ts:570` follow the wording rule.
- PR A's gate adds a non-gating `git grep -n -i -w -E 'sharing|globe|shared'` pass, each line triaged in the PR body.
- The TODOS.md CI-check entry says it runs against the `postgres` database after `supabase db reset`, not a shard (`pg_dump --no-privileges`), and excludes trigger and event-trigger functions.
- Before screenshots are taken at the commit PR A starts from, not `fae230d`.

<!-- /autoplan-accepted:eng -->

## Review record

### Phase 0: intake

- Input: the owner's message of 2026-10-16 ("Publicページ機能を完全に削除お願いします。私は寝ますので、全てreccomendの選択肢で進行をお願いします。何か問題があればgithub Issueへ追加お願いします。"). No issue and no plan file existed; this file was written from the message, a read of the code and a count-only query on production, then handed to `/autoplan`.
- Owner is asleep for the whole run. Every gate is decided by the 6 principles and the recommended option. `/office-hours` offer: skipped for the same reason. The design doc that `gstack-design-doc-find` returned (`docs/designs/issue-216-repository-memory.md`) belongs to issue #216 and is unrelated.
- Base branch `main`, platform GitHub, repo mode solo. Open PRs: #253 (picker wording; rewords the shared-board notices this plan deletes), #224 (CI ports).
- Outside reviewer preflight: `CODEX_MODE: ready`.
- Scope (init, input sha `2a9977c2…`): UI scope yes (`uiRequired: true`; files such as `BoardSettingsDialog`, `MoveToAnotherBoardDialog`, the board header, and the terms dialog ×4, button ×3, component ×2). DX scope yes by the term count (`endpoint`, `REST`, `CLI` ×3, `agent`; `dxRequiredByTerms: true`). The matches are the Server Action endpoint list, PostgREST and the Supabase CLI of the rollout, not a developer-facing surface, but the rule allows no override of a positive result, so Phase 2.5 runs.
- Restore point: `.gstack/tmp/autoplan/chore-remove-public-board-autoplan-restore-20261016-191649.md`. Run id `chore-remove-public-board-20261016-191649`. Branch renamed from the worktree's `cursor/8df5de15` to `chore/remove-public-board` before the restore point.

### Phase 1: CEO review (mode: SELECTIVE EXPANSION, /autoplan override)

Methodology: `.gstack/tmp/autoplan/autoplan-ceo-methodology-7jvPNo/methodology.md`, sha `104c3d62…`, 2453 lines, read in five ranges (1–600, 601–1200, 1201–1800, 1801–2400, 2401–2453) through EOF.

#### Pre-review system audit

- `main` = `origin/main` = `eb36776` (merge of #252). This branch has no commits yet; `git diff main --stat` is empty. Three `lint-staged automatic backup` stashes are unrelated.
- Most touched files in the last 30 days: `TODOS.md` (52), `AddRepositoryCombobox.tsx` (26), `CLAUDE.md` (24), `SPEC.md` (18), `repo-cards.ts` (15), `MoveToAnotherBoardDialog.tsx` (15). Every one of them is edited by this plan, so rebase conflicts with in-flight work are likely; PR #253 touches `AddRepositoryCombobox.tsx`, `MoveToAnotherBoardDialog.tsx`, `move-to-another-board.spec.ts`, `MoveToAnotherBoardDialog.test.tsx` and `TODOS.md`, and rewords exactly the shared-board sentences this plan deletes.
- Retrospective: the sharing feature was hardened three times in October (`1e5030e` read by slug only, `a72c85a` Copy Link follows the sharing state, the move-dialog and picker notices of #213), and five TODOs about it are still open. Each fix added code to keep an unused feature safe. That is the recurring problem; removal ends it.
- Taste calibration. Good references: `supabase/migrations/20261011030000_public_board_by_slug_only.sql` (one `DO` block, checks its own result, says how to go back) and `docs/plans/2026-10-12-issue-213-remove-maintenance-mode.md` (a removal with a grep as the definition of done). Patterns to avoid: a word-ban test (rejected in #213, C1) and a redirect shim for a route nothing links to (#213, C5).
- Landscape (WebSearch; Aside: `NEEDS_ASIDE`). Layer 1: kanban tools that share boards use a revocable read-only token ([KanbanThing](https://www.kanbanthing.com/guides/read-only-board-links)). Layer 2: share links are a frequent leak path, for private repository names on boards ([workspace-hub 2db8d95](https://github.com/vamseeachanta/workspace-hub/commit/2db8d95a0bbbf9134204ed4b82e1bff56a5406c5)) and for authorization gaps behind the token ([vikunja GHSA-rj9j-8772-4h6c](https://github.com/go-vikunja/vikunja/security/advisories/GHSA-rj9j-8772-4h6c), [pydio/cells#981](https://github.com/pydio/cells/issues/981)). Layer 3: GitBox boards hold the owner's private and organization repositories; a share link without a `visibility` filter, without revocation and with no user has only the risk side. Removal is the first-principles answer, not a step back.
- Prior learnings applied: `prod-migration-no-approval-gate` (confidence 10, 2026-10-10): the production workflow runs on every push to `main` that touches `supabase/migrations/**`, with no approval; it can be held for one merge with `gh workflow disable`/`enable`. `supabase-db-push-hides-notice` (confidence 10, 2026-10-14): the CLI prints no `NOTICE`, so counts come from queries. Brain context: no digests.

#### 0A. Premise challenge

The real problem: an unused feature keeps the only path by which a visitor without an account reads data (`get_public_board`, `SECURITY DEFINER`, executable by `anon`), and every board change has to be weighed against it (a field the shared page needs goes into the function by migration, `CLAUDE.md` board schema line). Do nothing: the anonymous path stays, five sharing TODOs stay open, and the next board feature pays the same tax. The plan removes the cause, not a proxy.

| Premise | Claim                                                               | Receipt                                                                                                                                   | Verdict                                                                                            |
| ------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| P1      | Nobody uses sharing                                                 | production count query 2026-10-16: 6 boards, 0 `is_public`, 0 `share_slug`                                                                | verified                                                                                           |
| P2      | Dropping the columns loses no data                                  | same query; `get_public_board` is the only function naming them; no view depends on them                                                  | verified                                                                                           |
| P3      | Copy Link stays: it predates sharing                                | `60a8c9c` (#40, 2026-01-28) added `src/app/board/[id]/BoardPageClient.tsx` with Copy Link; sharing came with `583f61d` (#130, 2026-02-19) | verified                                                                                           |
| P4      | The owner wants the database part removed too                       | owner message: "完全に削除"                                                                                                               | verified                                                                                           |
| P5      | No redirect is needed                                               | P1: no slug exists, so no working link exists                                                                                             | verified                                                                                           |
| P6      | The window where the old build runs on the new schema is acceptable | `src/lib/actions/repo-cards.ts:486` selects `is_public`; the plan's Known window                                                          | challenged: the learning `prod-migration-no-approval-gate` removes the window at cost S (C1 below) |
| P7      | Nothing outside `src/app/public` reads `getPublicBoardBySlug`       | `rg` over `src`, `e2e`, `mocks`: only the page and its tests                                                                              | verified                                                                                           |

`unverified=0`.

#### 0B. Existing code leverage

| Sub-problem                             | Existing code                                                                                                      | Reuse                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Re-runnable migration with a self-check | `20261011030000_public_board_by_slug_only.sql:50-152` (`DO` block, `lock_timeout`, `RAISE EXCEPTION` checks)       | same shape                            |
| Verification query, count only          | `docs/plans/2026-10-12-issue-213-remove-maintenance-mode.md` section 1                                             | same shape                            |
| Definition of done by grep              | #213 C1                                                                                                            | same rule                             |
| Hold a migration across a merge         | learning `prod-migration-no-approval-gate`; `.github/workflows/supabase-production.yml:10` has `workflow_dispatch` | used by C1                            |
| Signed-out redirect for unknown paths   | `src/proxy.ts:149-156`                                                                                             | stays; `/public/<slug>` falls into it |

Reality rows:

REALITY: premise-table pass 7 premises, 7 with receipts, unverified=0 src/lib/actions/repo-cards.ts:486
REALITY: already-done pass git log origin/main --since=2026-10-16 on src/app/public, public-board.ts, BoardSettingsDialog.tsx and supabase/migrations returns nothing eb36776
REALITY: surface-check pass pnpm test, lint, build, typecheck, e2e:parallel, db:reset exist; supabase db query --linked exists (--help); the workflow has workflow_dispatch package.json:20-38
REALITY: binding-decisions pass gstack-decision-search --scope branch --recent 50 returns nothing for this branch; the plan has no Binding decisions section; recent project decisions are version bumps only CLAUDE.md:1
REALITY: numbers pass 6 boards, 0 public, 0 slugs, 2 users [measured: `supabase db query --linked` count query 2026-10-16, docs/plans/2026-10-16-remove-public-board.md:23]; newest migration file 20261016181500 [measured: `ls supabase/migrations`, supabase/migrations/20261016181500_qualify_repocard_owner_trigger.sql:1]; CLI pin 2.120.0 [measured: .github/workflows/supabase-production.yml:33]; about 60 changed files [estimated]
REALITY: deferred-asks pass no linked issue; the owner's message asks for three things (complete removal, recommended options at every decision, GitHub issues for problems) and the plan leaves none out: removal is the Goal, decisions follow the 6 principles, problems became #254 and #257 docs/plans/2026-10-16-remove-public-board.md:5
REALITY: pr-count pass no .gstack/ship-policy.json, default one PR per wave; the plan ships one PR docs/plans/2026-10-16-remove-public-board.md:127

#### 0C. Dream state

```
  CURRENT STATE                      THIS PLAN                          12-MONTH IDEAL
  a board is private, or public  --> no public board; one anonymous --> every read of user data goes
  through a SECURITY DEFINER         data path gone; 5 TODOs gone;      through RLS as its owner; a new
  function anon may call; 5 open     Copy Link copies the owner's       board feature never asks "and the
  sharing TODOs; 3 dialogs warn      address                            shared page?"; if sharing comes
  about a public link                                                   back, it is a designed feature
                                                                        (revocable token, visibility filter)
```

The plan moves straight toward the ideal; it closes no door: the columns can be added again by a new migration if sharing returns as a designed feature.

#### 0D. Approaches

No approach choice was required. Full removal is the owner's stated direction; a code-only removal that keeps the columns would contradict "完全に削除" and was not offered. The rollout order is decided in 0G (C1) and Section 9.

#### 0E. Mode

`Mode: SELECTIVE EXPANSION; approved decisions: none.` Provenance: /autoplan override ("Mode selection: SELECTIVE EXPANSION"); no question asked, no question log.

#### 0F/0G. Hold-scope checks and cherry-picks

Hold-scope checks:

1. Complexity: about 60 files are touched, more than 8, with no new class or service. A removal touches every reader of what it removes; fewer files would leave dead code or tests of deleted code. No cut proposed.
2. Minimum changes: every section is needed for the Success grep, except the TODOS.md rewording of mixed entries, which the grep also covers. Nothing is deferrable without failing the definition of done.
3. Invariants kept: Copy Link, the move dialog's remembered destination, the `statuslist_color_hex` check, the signed-out redirect.

10x check: the 10x version of this change is not more code; it is GitBox having one trust boundary (the signed-in owner, enforced by RLS) and no exception to it. This plan gets there in one PR.

Delight scan (adjacent improvements, about 30 minutes each or less):

| #   | Candidate                                                                                                                                                                                                                                                                                                                                  | Effort | Risk                                                                                           | Decision                                                                                                                          | Principle                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| C1  | Zero-window rollout: `gh workflow disable supabase-production.yml` before the merge, wait for the Vercel production deployment of the merge commit, `gh workflow enable` and `gh workflow run supabase-production.yml --ref main`, then verify. The old build never runs on the new schema; a failed deploy leaves the old schema in place | S      | low (the one risk, a workflow left disabled, is closed by a check of `gh workflow view` state) | ACCEPTED                                                                                                                          | P1, P2 (rollout is in the blast radius, zero code) |
| C2  | The CHANGELOG entry says that public board links are gone and that a board opens for its owner only                                                                                                                                                                                                                                        | S      | low                                                                                            | ACCEPTED                                                                                                                          | P1                                                 |
| C3  | The `git grep` of Success runs once before the PR is marked ready; its output (expected: no lines) goes into the PR body                                                                                                                                                                                                                   | S      | low                                                                                            | ACCEPTED                                                                                                                          | P1, #213 C1                                        |
| C4  | Privacy policy (`src/app/privacy/page.tsx:62`) says "Public repository names" are stored; private and organization repositories are stored too                                                                                                                                                                                             | S      | low                                                                                            | FILED AS GITHUB ISSUE (outside the blast radius; the owner's direction sends problems to issues, not TODOS.md)                    | P3                                                 |
| C5  | A page or redirect for old `/public/<slug>` links                                                                                                                                                                                                                                                                                          | S      | low                                                                                            | SKIPPED: no working link exists (P1)                                                                                              | P5, #213 C5                                        |
| C6  | Rename "Copy Link" to say whose link it is                                                                                                                                                                                                                                                                                                 | S      | low                                                                                            | SKIPPED: the toast already says "Only you can open this link."; a new label changes a control the owner knows for no new behavior | P5                                                 |

6 proposed, 3 accepted (C1, C2, C3), 1 filed as an issue (C4), 2 skipped (C5, C6), 0 deferred to TODOS.md.

CEO plan archive: `~/.gstack/projects/laststance-gitbox/ceo-plans/2026-10-16-remove-public-board.md`.

Amendment checkpoint (`<CEO_STEP0_CHECKPOINT>`): `.gstack/tmp/autoplan/autoplan-ceo-rnQVMV/ceo-implementation.md`, sha `2a9977c2…`.

#### 0H. Spec review loop

Three launches, each given the CEO summary and the current export, each export read through EOF before dispatch:

| Launch | Input export                           | Score | Result            | Issues                                                  | Disposition                                                                                           |
| ------ | -------------------------------------- | ----- | ----------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1      | `autoplan-ceo-SFV2A4`, sha `5c266b55…` | 7/10  | FAIL (Scope PASS) | S1 to S10                                               | all applied (P1, P5)                                                                                  |
| 2      | `autoplan-ceo-nFCdgD`, sha `f6f9f5bc…` | 8/10  | FAIL (Scope PASS) | T1 to T9; S1 to S6, S8 to S10 confirmed                 | all applied; PR #253 had merged, so the branch was fast-forwarded to `fae230d` before any commit (T8) |
| 3      | `autoplan-ceo-53sR14`, sha `946f3be1…` | 8/10  | FAIL (Scope PASS) | U1 to U8; S1 to S10, T1 to T8 confirmed, T9 found wrong | all applied, not re-reviewed (cap)                                                                    |

Issues verified after launch 3: 8 of 8 (applied edits, not a verdict), checked by phrase in the export `autoplan-ceo-kuauoX` (sha `fff464fe…`). Metrics recorded in `~/.gstack/analytics/spec-review.jsonl`: 3 iterations, 27 found, 18 reviewer-confirmed fixed, 8 remaining (applied after the last launch), score 8. Decision `spec not re-verified` is listed for the gate. The CEO summary and its Reviewer Concerns hold every issue with its fix.

Document approval (0H menu): A) Approve these documents and continue to 0I, auto-decided (P6; both documents carry the same decisions: C1 to C6, S1 to S10, T1 to T9, U1 to U8). It approves these document versions only.

#### 0I. Temporal interrogation

```
  HOUR 1 (foundations):  the worktree has no .env, .env.production or supabase/.env; copy them from
                         ~/laststance/gitbox (never commit them). Local Supabase is the one Docker
                         project "gitbox" both checkouts share: pnpm db:reset here resets it for both.
  HOUR 2-3 (core logic): edit types.ts first, then let pnpm typecheck list every reader of the two
                         fields; delete the route and the actions; the move dialog default and the
                         settings tabs are the two behavior changes.
  HOUR 4-5 (integration): seed rename, db-query helpers, the 300px picker case re-measured, the
                         proxy redirect case; pnpm e2e:parallel resets the local database.
  HOUR 6+ (polish/tests): SPEC/README/CLAUDE/TODOS wording, the grep of Success, the real-account
                         check on localhost:3008 (needs the Chrome session; if it cannot be brought
                         in, the check is reported as not verified, CLAUDE.md "Verification").
```

Effort: human team about 1.5 days; CC + gstack about 3 hours. Feasibility blockers: none that stop the build. Two can stop a verification step and are reported, not worked around: the Chrome session for the real-account check, and the Vercel deployment of step 8.

#### 0.5. Dual voices

Voice input: `autoplan-ceo-1CDQv1/ceo-implementation.md`, sha `fff464fe…` (created after the spec loop). Native voice ([Independent CEO voice review](4ea13c95-6b9a-45b8-b02b-edce65982b97), in-host subagent): completed, `INPUT: ceo fff464fe…` matches. Codex voice: completed (`OUTSIDE_STATUS: completed provider=codex host=cursor`, model `gpt-6-astra`, about 103 s, `VERDICT: findings`, `FINDINGS: P1`).

Native findings: N1 Critical: the plan deleted `public-board-data-access.spec.ts`, whose lines 45, 66, 93 and 133 are the only database-level tenant-isolation tests (checked). N2 High: two PRs make the workflow hold unnecessary; a dead agent between disable and enable would leave every later migration unapplied. N3 Medium: "nobody uses it" is weak evidence; keep the deleted TODOs as requirements. N4 Medium: check "no anonymous definer function" (on production today: `get_public_board` only, checked). N5 Medium: Copy Link came from #35, not #40 (checked: `e4d2fcb`, 2026-01-15). N6 Medium: README says "Boards are private to you".

Codex findings: X1 High: "nobody uses it" overclaims. X2 High: the public page's footer was an acquisition path; no acquisition plan replaces it. X3 High: staged retirement (code first, columns later). X4 High: fix the privacy wording in this release. X5 Medium: success criteria measure erasure, not outcome. X6 Medium: a public board found by the last audit gets no transition.

```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                            in-host                     Codex                        Consensus
  1. Premises valid?                   partly (N5, N3)             partly (X1)                  CONFIRMED: premise wording corrected
  2. Right problem to solve?           yes                         yes, framed as owner's choice CONFIRMED
  3. Scope calibration correct?        no: tests deleted, split    no: stage the retirement      CONFIRMED: two PRs, tests moved
  4. Alternatives sufficiently explored? no: two PRs missing       no: staged, snapshot, demo    CONFIRMED
  5. Competitive/market risks covered? low (GitHub owns lists)     high (acquisition path, X2)   DISAGREE -> taste at gate
  6. 6-month trajectory sound?         risk: tests, workflow       risk: 2 users, no outcome     DISAGREE (different risks) -> taste at gate
CONFIRMED = completed subagent + outside. 4 of 6 confirmed, 2 disagreements.
Single-voice critical: N1 (native only); verified in the code and applied.
```

Dispositions (P1 and P5 unless named): N1 applied (move, not delete; a line of Success). N2 and X3 applied together: C1 (workflow hold) is reopened on new evidence (a disabled workflow left by a stopped run skips every later migration; a split has a safe state between the PRs) and replaced by two PRs. N3 and X1 applied: the Problem section says the counts show that no working link breaks; issue #257 keeps the requirements of the deleted TODOs and the snapshot, export and demo-board alternatives. N4 applied: `anon_definer_functions` in the verification query, expected 0 after PR B; a CI check goes to TODOS.md (outside the blast radius, P3). N5 applied. N6 applied. X2: TASTE (gate): the removal stays (owner's direction); acquisition alternatives are recorded in #257. X4: TASTE (gate): the privacy wording stays in #254 (outside the blast radius, P3; the native voice also put it in the next PR). X5: partly applied: the production check of PR A reads Sentry for the first hour when the session can; an outcome statement about freed capacity is not added (P5). X6: partly applied: a public board found before PR B is reported (count and owner kind) and the merge goes on (owner's direction); no notification flow (no user of a link exists, P1 evidence). User Challenges: none; neither voice proposes to keep sharing.

#### Section 1: Architecture

Current scope: SELECTIVE EXPANSION. Accepted: C2, C3, the two-PR rollout (replaces C1), S1 to S10, T1 to T9, U1 to U8, N1, N3 to N6, X1, X5 (Sentry check), X6 (report). Filed: C4 as #254, the sharing requirements as #257. Skipped: C5, C6. Pending for the gate: X2, X4, Copy Link (keep), spec not re-verified.

```
BEFORE                                           AFTER (PR A, then PR B)
visitor --/public/<slug>--> proxy (exception)    visitor --any path--> proxy --> /login
   --> page --> getPublicBoardBySlug              (no exception, no route)
   --> rate limit publicBoardView
   --> rpc get_public_board (DEFINER, anon) --+   signed-in owner --> /board/[id] --> RLS
owner --> /board/[id] --> RLS -----------------+--> board, statuslist, repocard
owner --> Board Settings > Sharing --> toggleBoardPublic --> board.is_public/share_slug
owner --> move dialog / picker --> notice <-- getUserBoardsWithStatusLists(is_public)
```

No new component and no new coupling: every edge on the right existed before. The only data path for a visitor without an account (`get_public_board`) goes; row level security becomes the one boundary, and the moved isolation tests are its proof. Scaling: nothing changes under 10x or 100x load (one fewer column per move-dialog read). Single points of failure: none added. Production failure scenarios: PR A's deployment fails (PR B waits); PR B's migration hits `lock_timeout` (run the workflow again) or a dependency (`2BP01`, no `CASCADE`: the run rolls back, the migration is fixed in a new commit). Rollback: PR A revertible in minutes; after PR B fix forward. Value test for the artifacts about the work: the verification query decides whether PR B is done; the grep output decides whether PR A is ready; #257 is read when sharing is designed again; none of them is a report nothing consumes. Findings: N1 and N2 (applied above). Decision gate: done.

#### Section 2: Error & Rescue Map

```
  METHOD/CODEPATH                    | WHAT CAN GO WRONG                         | EXCEPTION CLASS
  -----------------------------------|-------------------------------------------|----------------------------
  migration DO block (PR B)          | another session holds a lock              | 55P03 lock_not_available
                                     | deadlock                                  | 40P01
                                     | a policy/view/index still uses a column   | 2BP01 dependent_objects_still_exist
                                     | end state wrong (self-check)              | P0001 raise_exception
  handleCopyBoardLink                | clipboard refused (permission, focus)     | DOMException
  proxy, signed-out /public/<slug>   | none: falls into the login redirect       | -
  old tab: Sharing switch after A    | server action no longer exists            | UnrecognizedActionError

  EXCEPTION CLASS                    | RESCUED? | RESCUE ACTION                        | USER SEES
  -----------------------------------|----------|--------------------------------------|---------------------------
  55P03, 40P01                       | Y        | run the workflow again               | nothing (rolled back)
  2BP01                              | Y        | rolled back; fix the migration       | nothing (rolled back)
  P0001                              | Y        | rolled back; fix the migration       | nothing (rolled back)
  DOMException                       | Y        | toast "Failed to copy link" + Sentry | the toast (unchanged code)
  UnrecognizedActionError            | N <- GAP | none possible (old client)           | switch does not move
```

The one gap is in a client this change cannot touch any more; it lasts until the tab reloads and may reach Sentry. Accepted (P6), named in section 6.

#### Section 3: Security & Threat Model

Attack surface shrinks: the anonymous RPC, the proxy exception and the anonymous rate limit go; no endpoint, parameter or input is added. Between PR A and PR B, `get_public_board` still answers `anon`, and an owner can still set `is_public` and `share_slug` on their own board through the REST API: threat = self-exposure of one's own board, likelihood Low, impact Low (the owner's own data, by their own request), mitigated by PR B the same night. Authorization after PR B: row level security only; the moved isolation tests and `anon_definer_functions` = 0 check it. No secrets, no new dependency, no injection vector. Data classification unchanged (repository names and metadata, private ones included: #254 is the policy text). No issues beyond N1 and N4, both applied.

#### Section 4: Data Flow & Interaction Edge Cases

No new data flow. Interaction edge cases of what changes:

```
  INTERACTION          | EDGE CASE                                   | HANDLED? | HOW
  ---------------------|---------------------------------------------|----------|------------------------------------
  Copy Link            | pressed twice                               | Y        | two clipboard writes, two toasts
  Copy Link            | clipboard refused                           | Y        | existing error toast
  Move dialog default  | remembered board deleted                    | Y        | falls to the first (newest) board
  Move dialog default  | no other board                              | Y        | create form (unchanged)
  Board Settings       | opened from a tab that had "Sharing" active | Y        | active tab is component state, starts at General
  Old /public link     | signed out                                  | Y        | /login
  Old /public link     | signed in                                   | Y        | root 404
  Old tab after PR A   | Sharing switch pressed                      | partly   | switch stays; reload fixes (section 2 gap)
```

No async ordering changes: the move dialog's requests and their order are untouched. No issues found.

#### Section 5: Code Quality

The change deletes code and adds none beyond the moved spec and the migration. Risks are leftovers: exports nothing imports any more (`toRepoCardDomain` stays: `mappers.ts:164` uses it) and comments that still describe sharing (the grep and the named wrapped comments). Finding: `knip` exists (`package.json:38`) but is not part of the CI checks the plan names; a leftover export would pass every listed check. Decision: run `pnpm knip` before PR A is marked ready and compare with `main`: no new unused file or export (P1, mechanical). `toMoveButtonDescription` loses a parameter and keeps its two other returns; no function gains a branch.

#### Section 6: Test Review

```
  BEHAVIOR AFTER THE CHANGE                        | TEST                                         | TYPE
  -------------------------------------------------|----------------------------------------------|--------------
  signed-out /public/<slug> -> /login              | proxy-signed-out-access.test.ts (changed)    | unit
  visitor/other user cannot reach board rows       | board-data-access.spec.ts (moved, 4 cases)   | E2E (database)
  Copy Link copies the page address + toast text   | BoardPageClient.test.tsx (changed)           | unit
  Board Settings has three tabs, none scrolls      | board-settings-narrow-viewport.spec.ts, BoardSettingsDialog.test.tsx | E2E + unit
  move dialog opens on remembered, else first      | MoveToAnotherBoardDialog.test.tsx (existing) | unit
  picker panel scrolls on a short window           | add-repository-combobox.spec.ts:938 (re-measured) | E2E
  other user's board id -> Board not found         | board-not-found.spec.ts (changed)            | E2E
  migration applies, self-checks, re-runnable      | the migration's own RAISE checks; CI E2E applies every migration; verification query | CI + manual
  no anon-executable definer function              | verification query (manual); CI check -> TODOS.md | manual
```

Assertion check for the two that carry the most weight: the proxy case asserts a 307 to `/login` and rejects a 200 pass-through (`no_claim`: production's session check is mocked as "no session"); the isolation cases assert `[]`/refusal against a real local database and reject a policy that lets rows through (`no_claim`: production's policies, which the verification query does not read; their source is the same migrations). Test ambition, 2am Friday: the isolation spec plus `anon_definer_functions` = 0. Hostile QA: write `is_public` through REST between the PRs (section 3, accepted). Chaos: PR B's migration with a held lock (`lock_timeout`, rolled back). Flakiness: the re-measured picker case depends on layout; it measures, it does not wait on time. No eval suites (no prompt change). Gaps: none open after N1.

#### Section 7: Performance

`getUserBoardsWithStatusLists` reads one column fewer; the shared page's three reads go. The migration takes `ACCESS EXCLUSIVE` on `board` (6 rows) for the column drop, under `lock_timeout` 5s. No N+1, no new index needed, no memory growth. No issues found.

#### Section 8: Observability

The Sentry contexts of the shared page go with it. The migration's `NOTICE` is not printed by the CLI (learning `supabase-db-push-hides-notice`); the verification query is the record. Expected noise: unrecognized-action errors from tabs opened before PR A's deployment, until they reload; the check of step 8 names them as expected if they appear. Runbook: section 6's failure paragraph. No gaps beyond X5's Sentry check, applied.

#### Section 9: Deployment & Rollout

Two PRs, decided above. Migration safety: drop of two empty-of-meaning columns and one function, backward-compatible for PR A's build; table lock bounded by `lock_timeout`. No feature flag: there is no new behavior to switch. Rollout order: code first (PR A), schema second (PR B). Old and new code side by side: PR A's build on the old schema works; the pre-A build never meets the new schema. Post-deploy: steps 8 and 10, the verification query. Environment parity: CI's E2E applies the migrations with the production CLI pin. No issues beyond N2/X3, applied.

#### Section 10: Long-Term Trajectory

Debt removed: one `SECURITY DEFINER` function, two columns, one route, five TODOs. Debt added: one TODO (CI check of anonymous definer functions). Reversibility 3/5: the columns can be added again by a migration and hold no data now; the code is in history; #257 holds the requirements. Path dependency: none; a later sharing feature starts from #257, not from this code. Ecosystem fit: follows #213's removal pattern. A new engineer in 12 months reads "a board opens for its owner only" in `CLAUDE.md` and finds no exception. Retrospective on cherry-picks: C1 was right in intent and wrong in shape; the voices replaced it.

#### Section 11: Design & UX

```
  Board header: [Add Repositories] [Add Column] [Board Settings] [Copy Link]
     Board Settings: General | Cards | Danger Zone        (Sharing tab gone)
     Copy Link -> toast "Link copied!" / "Only you can open this link."
  Card menu -> Move to Another Board -> board list (no globe) -> Move (no notice)
  Add Repositories -> list -> Add (no shared-board notice)
  /public/<slug> -> signed out: /login ; signed in: 404
```

Information hierarchy gets simpler: one tab fewer, three notices fewer. States: Copy Link success and failure exist; the move dialog's states are unchanged. Responsive: three tabs need less room than four on a phone; the narrow-viewport spec measures it. Accessibility: the removed notices were referenced by `aria-describedby`; the attribute must not keep an id that no element has (the plan removes the id with the notice; `toMoveButtonDescription` returns the failure id or `undefined`). No AI-slop risk: nothing is added. Recommend `/plan-design-review` (Phase 2 runs next). Decision gate: done.

#### Required outputs

REALITY: pr-count finding the plan now ships two PRs (A: code, B: migration); queue cost of the extra PR: one more CI run of about 15 minutes and one more /ship; user-facing references across them: PR A's CHANGELOG says links are gone, PR B's says the columns are dropped docs/plans/2026-10-16-remove-public-board.md:127

NOT in scope: a redirect or page for old links (C5, skipped); renaming Copy Link (C6, skipped; gate); the privacy wording (#254, filed; gate X4); sharing in another form and acquisition alternatives (#257, filed; gate X2); a CI check of anonymous definer functions (TODOS.md, P3); editing history (`docs/plans`, `docs/designs`, `CHANGELOG.md`, old migrations); the `statuslist_color_hex` check (stays).

What already exists: section 0B's table; plus the isolation cases (moved, not rewritten), `toMoveButtonDescription` (kept, one parameter fewer), the proxy's login redirect (now the only answer for `/public`).

Dream state delta: after this plan GitBox has one trust boundary and no anonymous data path. Left to the 12-month ideal: the CI check of anonymous definer functions (TODOS.md) and a privacy policy that matches what is stored (#254).

Failure Modes Registry:

```
  CODEPATH                     | FAILURE MODE                    | RESCUED? | TEST?            | USER SEES?          | LOGGED?
  -----------------------------|---------------------------------|----------|------------------|---------------------|--------
  PR B migration               | lock timeout / deadlock         | Y        | CI applies       | nothing             | job log
  PR B migration               | dependency on a column          | Y        | CI applies       | nothing             | job log
  PR B migration               | wrong end state                 | Y        | self-check RAISE | nothing             | job log
  PR A deployment              | build fails                     | Y        | CI build         | old build stays     | Vercel
  old tab Sharing switch       | unrecognized action             | N        | N                | switch does not move| Sentry (maybe)
  Copy Link                    | clipboard refused               | Y        | unit             | error toast         | Sentry
  RLS on board tables          | policy loosened later           | Y        | E2E (moved)      | -                   | CI
```

The old-tab row has RESCUED=N and TEST=N, and the user sees the switch not move: not silent, so not a CRITICAL GAP; it cannot be fixed in a client already shipped. 0 critical gaps.

Diagrams: system architecture (Section 1), error flow (Section 2), interaction/state (Section 4), user flow (Section 11), deployment sequence and rollback below.

```
  DEPLOYMENT SEQUENCE                         ROLLBACK
  PR A merge --> no migration run             before PR B: revert/Instant Rollback PR A: safe
     --> Vercel Ready (vercel[bot], sha)       after PR B:  rollback to PR A's build: safe
     --> check A (step 8)                                   rollback before PR A: move dialog breaks
  PR B merge --> push run --> migration                     -> fix forward on main
     --> verification query --> check B
```

Stale diagram audit: `CLAUDE.md`'s App Router tree lists `public/[slug]/page.tsx` (stale; section 5 updates it); `SPEC.md`'s Board Settings line says 4-tab (stale; updated). No other ASCII diagram in the touched files names sharing.

Implementation Tasks (CEO):

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — e2e — Move the four tenant-isolation cases to `e2e/unauthenticated/board-data-access.spec.ts`
  - Surfaced by: 0.5 Dual voices — N1
  - Files: e2e/unauthenticated/public-board-data-access.spec.ts, e2e/unauthenticated/board-data-access.spec.ts
  - Verify: `pnpm e2e:parallel` runs the four cases green
- [ ] **T2 (P1, human: ~1h / CC: ~5min)** — rollout — Split into PR A (no migration) and PR B (migration only)
  - Surfaced by: 0.5 Dual voices — N2, X3
  - Files: supabase/migrations/20261016190000_remove_public_board.sql
  - Verify: no `supabase-production.yml` run for PR A's merge sha; one push run for PR B's
- [ ] **T3 (P2, human: ~15min / CC: ~2min)** — db — Add `anon_definer_functions` to the verification query and a TODOS.md entry for a CI check
  - Surfaced by: 0.5 Dual voices — N4
  - Files: TODOS.md
  - Verify: the query prints 0 locally after `pnpm db:reset` and on production after PR B
- [ ] **T4 (P2, human: ~15min / CC: ~2min)** — quality — Run `pnpm knip` before PR A is marked ready; no new unused file or export
  - Surfaced by: Section 5 — leftover exports pass the listed checks
  - Files: to be determined
  - Verify: `pnpm knip` output compared with `main`
- [ ] **T5 (P2, human: ~10min / CC: ~1min)** — docs — README line "Boards are private to you"; Copy Link origin #35 in the plan and docs
  - Surfaced by: 0.5 Dual voices — N5, N6
  - Files: README.md
  - Verify: the Success grep and a read of README

Completion Summary:

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | 6 hot files all touched; #253 merged (rebased)|
  | Step 0               | removal confirmed; C1-C6; 3 spec launches    |
  | Section 1  (Arch)    | 2 issues found (N1, N2), applied             |
  | Section 2  (Errors)  | 8 error paths mapped, 1 GAP (old tab)        |
  | Section 3  (Security)| 1 issue (interim RPC), 0 High severity       |
  | Section 4  (Data/UX) | 8 edge cases mapped, 0 unhandled             |
  | Section 5  (Quality) | 1 issue found (knip)                         |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                     |
  | Section 7  (Perf)    | 0 issues found                               |
  | Section 8  (Observ)  | 0 gaps found (Sentry check added)            |
  | Section 9  (Deploy)  | 1 risk flagged (split, applied)              |
  | Section 10 (Future)  | Reversibility: 3/5, debt items: 1 added      |
  | Section 11 (Design)  | 1 issue (aria-describedby ids)               |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (7 items)                            |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 8 rows, 0 CRITICAL GAPS                      |
  | Failure modes        | 7 total, 0 CRITICAL GAPS                     |
  | TODOS.md updates     | 1 item proposed (CI anon definer check)      |
  | Scope proposals      | 6 proposed, 3 accepted (C1 later replaced)   |
  | CEO plan             | written                                     |
  | Outside voice        | codex: completed                            |
  | Lake Score           | N/A (no coverage-scored question)            |
  | Diagrams produced    | 6 (arch, error, edge, user flow, deploy, rollback) |
  | Stale diagrams found | 2                                           |
  | Unresolved decisions | 0 (4 taste items go to the gate)             |
  | Reality rows         | 7/7 rows, 0 unverified                       |
  +====================================================================+
```

Unresolved decisions: none open in this phase. Taste items for the final gate: X2 (acquisition), X4 (privacy wording now or in #254), Copy Link (keep), spec not re-verified after launch 3.

Phase 1 report published: Outside review completed (6 concerns), native subagent completed (6 issues), consensus 4/6, 2 disagreements to the gate.

### Phase 2: Design review

Methodology: `.gstack/tmp/autoplan/autoplan-design-methodology-YR4o4p/methodology.md`, sha `33f51bf0…`, 1948 lines, read in four ranges (1–600, 601–1200, 1201–1800, 1801–1948) through EOF.

Scope: auto-selected B, the plan at `docs/plans/2026-10-16-remove-public-board.md` (autoplan input). UI scope: the board header (Copy Link), the Board Settings dialog (Sharing tab), the board list card (globe badge), Move to Another Board (globe mark, destination notice), Add Repositories and Move Here (shared-board notice), the board 404 page, and the deleted `/public/[slug]` page with its 404. Prior design reviews: none (`gstack-review-read`: `NO_REVIEWS`). Retrospective: #213's design review set the copy and focus rules this change keeps (Title Case labels, focus after a dialog closes, contrast tokens).

#### Step 0. Design scope

0A. Initial rating: 7/10. The plan names every element that goes and the one copy change (Copy Link's toast). A 10 also says what each touched screen looks like after the change (no hole where a notice was), how the tab row of Board Settings sits on a phone with three tabs, which element takes the place of a removed one in the keyboard order, and the exact text left on the board 404 page.

0B. `DESIGN.md`: none. Calibrated against universal principles and the rules `CLAUDE.md` states: Title Case for commands that name a thing of the app ("Button labels"), "Names that cannot break", the destructive and accent-fill contrast tokens, focus after a card dialog closes.

0C. Existing leverage: the tab styles of `BoardSettingsDialog` (`TAB_BASE`, `TAB_ACTIVE`, `TAB_INACTIVE`), Sonner toasts for Copy Link, the layout of `src/app/board/[id]/not-found.tsx`, `toMoveButtonDescription` for the Move button's `aria-describedby`. Nothing new is built.

0D. Focus areas: all seven passes, auto-decided (P1).

0.5 mockups: TASTE, auto-decided skip (P5, P3). The designer is installed (`DESIGN_READY`), but the plan adds no screen and no layout: it removes elements from existing screens. A generated mockup would invent a screen instead of showing GitBox's, and the comparison board needs the owner to choose, who is asleep. The visual evidence is the real app after the build: screenshots of the touched screens on the local check (section 6, step 3) and `/design-review` on the result. Listed for the gate.

#### 0.5. Dual voices

Voice input (`<DESIGN_INPUT>`, also this phase's checkpoint): `autoplan-design-V7bN6O/design-implementation.md`, sha `1a95fac3…`. Native voice ([Independent design voice review](d4c68c78-2590-408c-a1fe-ff918b45320c)): completed, `INPUT: design 1a95fac3…` matches; 0 critical, 0 high, 6 medium (M1 to M6) plus one trap. Codex voice: completed (`OUTSIDE_STATUS: completed`, `gpt-6-astra`, about 119 s, `VERDICT: clean`, `FINDINGS: P2`); 4 medium (D1 to D4).

CURSOR (IN-HOST) SUBAGENT (design completeness): M1 a copied board link opened signed out ends on `/boards`: sign-in drops the path (`src/proxy.ts:156`, `src/lib/actions/auth.ts:60`, `src/app/auth/callback/route.ts:35`); file it, keep PR A narrow. M2 the board 404 page loses its only explanation; replace the line with the rule and use one wording everywhere. M3 three tabs on a phone probably wrap as two plus a lone Danger Zone (estimate from `TAB_BASE`); screenshot and record. M4 the panel comment would claim an exact fit after the notice goes; the short-window test needs a floor (256px). M5 no visual check in the rollout; screenshots of four surfaces. M6 an other account's public board found before PR B: file the count. Trap: `BoardCard`'s wrapper span must stay. Checked and fine: the active tab is not persisted (`BoardSettingsDialog.tsx:198`, `:464`), the old move dialog's `!board.isPublic` still picks the first board, `aria-describedby` becomes `undefined`, not an empty string.

CODEX SAYS (design critique): D1 Copy Link explains its limit only after the press; add persistent wording beside it. D2 the same sign-in path as M1; specify the full journey. D3 the tabs have `role="tab"` without arrow keys or roving `tabIndex`; define the keyboard model and 44px targets. D4 the stale tab's silent Sharing switch is a user-visible state; give it recovery or record it as a release exception.

```
DESIGN OUTSIDE VOICES — LITMUS SCORECARD (classifier: OPERATE / app UI):
  Check                                    in-host   Codex     Consensus
  1. Brand unmistakable in first screen?   n/a       n/a       NOT SPEC'D (no screen added)
  2. One strong visual anchor?             n/a       n/a       NOT SPEC'D (unchanged)
  3. Scannable by headlines only?          yes       yes       CONFIRMED
  4. Each section has one job?             yes       yes       CONFIRMED (Sharing tab and notices go)
  5. Cards actually necessary?             n/a       n/a       NOT SPEC'D (unchanged)
  6. Motion improves hierarchy?            n/a       n/a       NOT SPEC'D (none)
  7. Premium without decorative shadows?   n/a       n/a       NOT SPEC'D (unchanged)
  Hard rejections triggered:               none      none      CONFIRMED: none
CONFIRMED findings (both voices): the sign-in path (M1 = D2); the three-tab row on a phone (M3, D3 from two sides).
DISAGREE: Copy Link wording at the button (D1: add; native: keep as is) -> taste at gate.
```

Dispositions: M1/D2 filed as #258 (existed before; outside the blast radius beyond `src/proxy.ts`; P3, P5), linked from PR A; the plan records it in Out of scope. M2 applied: "A board opens only for the account that owns it." on the 404 page, one wording in the toast, README and CHANGELOG, and the E2E asserts it (P1, P5). M3 applied as a screenshot and a recorded layout, a lone Danger Zone row accepted (P5); D3's keyboard model and touch targets filed as #259 (existed before; a behavior of its own). M4 applied (P5). M5 applied (P1). M6 applied (P1). Trap applied (P5). D1: TASTE (gate), the button stays as it is: the toast and the 404 page now carry the rule, the header is the owner's own page, and a line beside the button adds noise to every board (subtraction default). D4: applied as a recorded release exception: the old client cannot be changed, recovery would need a release before PR A for 2 users, and the window ends with a reload (P6); the plan already says so.

#### Pass 1: Information Architecture — 8/10 → 9/10

The plan keeps the header's order (Add Repositories, Add Column, Board Settings, Copy Link) and the dialog's (General, Cards, Danger Zone), and removes the one tab that did not belong to the board's own settings. Issue: the board 404 page loses its only line that says why (M2) — applied. Remaining gap: what Copy Link means is said after the press, not before (D1, taste at the gate).

```
  /board/[id]  header: title, subtitle | Add Repositories · Add Column · Board Settings · Copy Link
               Board Settings: [General] [Cards] [Danger Zone]
  /board/<other id> -> "Board not found" / "This board doesn't exist, was deleted, or belongs to another account."
                       / "A board opens only for the account that owns it." / [Go to Boards]
  /boards      grid of board cards (name, subtitle, favorite, menu; no globe)
```

#### Pass 2: Interaction State Coverage — 7/10 → 9/10

```
  FEATURE             | LOADING        | EMPTY                    | ERROR                         | SUCCESS                      | PARTIAL
  --------------------|----------------|--------------------------|-------------------------------|------------------------------|---------
  Copy Link           | -              | -                        | "Failed to copy link" toast   | "Link copied!" + the rule    | -
  Board Settings tabs | -              | -                        | per-tab forms (unchanged)     | per-tab toasts (unchanged)   | -
  Move dialog         | unchanged      | create form (unchanged)  | "Try again" (unchanged)       | "Moved to" toast (unchanged) | unknown outcome (unchanged)
  Add Repositories    | unchanged      | unchanged                | unchanged                     | unchanged                    | "not added" notice (unchanged)
  Board 404           | -              | -                        | page with the rule sentence   | -                            | -
  Stale tab, Sharing  | -              | -                        | switch stays (release exception, D4) | -                     | -
```

Issues: the 404 page (M2) and the stale tab (D4) — applied. Remaining gap: the signed-out return path ends on `/boards` (#258).

#### Pass 3: User Journey & Emotional Arc — 6/10 → 8/10

```
  STEP | USER DOES                                   | USER FEELS              | PLAN SPECIFIES?
  -----|---------------------------------------------|-------------------------|-----------------------------------------
  1    | Owner opens Board Settings                  | settled: 3 tabs, no switch about strangers | yes (3 tabs)
  2    | Owner presses Copy Link                     | knows what was copied   | yes (toast with the rule)
  3    | Owner opens that link on a signed-out phone | lost: lands on /boards  | no -> #258
  4    | Someone else opens a copied link            | told why, not puzzled   | yes (404 with the rule)
  5    | Owner moves a card / adds repositories      | no warning to parse     | yes (notices gone)
  6    | Old /public link, signed out                | asked to sign in        | yes (accepted; no link exists)
```

5-second: fewer controls on the settings dialog. 5-minute: nothing to manage about who sees a board. 5-year: "private by default" is the product's position (README line). Remaining gap: step 3 (#258).

#### Pass 4: AI Slop Risk — 10/10 → 10/10

Classifier: OPERATE (app UI). The change adds no screen, card, section or decoration; every text it adds is utility language. No hard rejection, no blacklist pattern. No issues found.

#### Pass 5: Design System Alignment — 8/10 → 9/10

No `DESIGN.md`. The plan uses only existing tokens and components (tab styles, `Button`, Sonner). Issue: `BoardCard`'s wrapper span carries the width rule of "Names that cannot break" and must survive the globe's removal (trap) — applied. Remaining gap: no `DESIGN.md` (`/design-consultation`, outside this change).

#### Pass 6: Responsive & Accessibility — 6/10 → 8/10

Issues: the three-tab row at 375px is unmeasured (M3) — applied as a screenshot and a recorded layout; the short-window panel case needs a floor (M4) — 256px; no visual check (M5) — screenshots at 375px and 1280px; `aria-describedby` must not keep an id with no element — the plan removes both ids with their notices, and the attribute becomes `undefined`. Remaining gaps: the tabs' keyboard model and 44px targets (#259, existed before).

#### Pass 7: Unresolved design decisions

```
  DECISION NEEDED                              | IF DEFERRED, WHAT HAPPENS
  ---------------------------------------------|------------------------------------------------
  Copy Link wording at the button (D1)         | the owner learns the limit from the toast (gate, taste)
  Return to the board after sign-in (#258)     | a copied link opened signed out ends on /boards
  Tab keyboard model, 44px targets (#259)      | the tab list behaves like buttons, as today
  Mockups (Step 0.5 skipped)                   | the visual check is the screenshots of step 3 (gate, taste)
```

2 resolved by filing, 2 to the gate.

#### Required outputs

NOT in scope: persistent wording next to Copy Link (gate); the sign-in return path (#258); the tab keyboard model (#259); a `DESIGN.md`; mockups (gate).

What already exists: tab styles of `BoardSettingsDialog`; Sonner toasts; the 404 layout of `src/app/board/[id]/not-found.tsx`; `toMoveButtonDescription`; the measured width rule of `BoardCard` and `names-that-cannot-break.spec.ts`.

TODOS.md updates: none from this phase (the two deferred gaps are issues, per the owner's direction).

Implementation Tasks (design):

- [ ] **T1 (P1, human: ~20min / CC: ~2min)** — copy — One wording for the rule: 404 page, Copy Link toast, README, CHANGELOG
  - Surfaced by: Pass 1 — M2
  - Files: src/app/board/[id]/not-found.tsx, src/app/board/[id]/BoardPageClient.tsx, README.md, e2e/logged-in/board-not-found.spec.ts
  - Verify: `board-not-found.spec.ts` asserts the sentence; `BoardPageClient.test.tsx` asserts the toast
- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — e2e — Re-measure the short-window picker case with a 256px floor
  - Surfaced by: Pass 6 — M4
  - Files: e2e/logged-in/add-repository-combobox.spec.ts, src/components/Board/AddRepositoryCombobox.tsx
  - Verify: `pnpm e2e:parallel`
- [ ] **T3 (P2, human: ~1h / CC: ~15min)** — visual — Screenshots before and after at 375px and 1280px of four surfaces into PR A
  - Surfaced by: Pass 6 — M3, M5
  - Files: e2e/logged-in/board-settings-narrow-viewport.spec.ts, src/components/Boards/BoardSettingsDialog.tsx
  - Verify: the images in PR A's body; the recorded tab layout in the spec header
- [ ] **T4 (P1, human: ~5min / CC: ~1min)** — component — Keep `BoardCard`'s wrapper span when the globe goes
  - Surfaced by: Pass 5 — trap
  - Files: src/components/Boards/BoardCard.tsx
  - Verify: `names-that-cannot-break.spec.ts`

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | no DESIGN.md; UI scope: 7 surfaces           |
  | Step 0               | 7/10; all 7 passes; mockups skipped (gate)   |
  | Pass 1  (Info Arch)  | 8/10 → 9/10 after fixes                      |
  | Pass 2  (States)     | 7/10 → 9/10 after fixes                      |
  | Pass 3  (Journey)    | 6/10 → 8/10 after fixes                      |
  | Pass 4  (AI Slop)    | 10/10 → 10/10                                |
  | Pass 5  (Design Sys) | 8/10 → 9/10 after fixes                      |
  | Pass 6  (Responsive) | 6/10 → 8/10 after fixes                      |
  | Pass 7  (Decisions)  | 2 resolved (filed #258, #259), 2 to the gate |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                            |
  | What already exists  | written                                      |
  | TODOS.md updates     | 0 items proposed                             |
  | Approved Mockups     | 0 generated, 0 approved (skipped, gate)      |
  | Decisions made       | 7 added to plan (M2-M6, trap, D4)            |
  | Decisions deferred   | 2 (D1, mockups: gate)                        |
  | Overall design score | 6/10 → 8/10                                  |
  +====================================================================+
```

Design phase checkpoint: `<DESIGN_INPUT>`. The record below binds this phase's replacements to its sha `c139731b…` source.

<!-- autoplan-baseline-edits:design {"sourceSha256":"c139731b9bf67c4ca34b85cff18d1da59ed279424c56f092f32105ace97a2495","replacements":[{"oldText":"- `BoardPageClient`: Copy Link copies `window.location.href` and its toast reads \"Link copied!\" with \"Only you can open this link.\"","newText":"- `BoardPageClient`: Copy Link copies `window.location.href` and its toast reads \"Link copied!\" with \"Only the account that owns this board can open it.\" (one wording for the rule across the toast, the board 404 page, the README and the CHANGELOG: \"A board opens only for the account that owns it.\"). The button keeps its place, label, icon and `title`."},{"oldText":"- `BoardCard`: remove the globe badge and the comment about the box of name and globe; the name's width rule stays as `CLAUDE.md` \"Names that cannot break\" describes it (re-measured by `names-that-cannot-break.spec.ts`).","newText":"- `BoardCard`: remove the globe badge and the comment about the box of name and globe. Delete only the `Globe` element: the wrapper `span` with `flex max-w-[calc(100%+4rem)] items-center gap-2` stays even with one child, because the measured width rule applies to that box (`CLAUDE.md` \"Names that cannot break\", re-measured by `names-that-cannot-break.spec.ts`)."},{"oldText":"- `src/app/board/[id]/not-found.tsx`: remove the line \"To see someone else's board, ask them for its public link.\" and the `/public/[slug]` note in its docstring.","newText":"- `src/app/board/[id]/not-found.tsx`: the line \"To see someone else's board, ask them for its public link.\" becomes \"A board opens only for the account that owns it.\" It is the same on every not-found, so it says nothing about the board that was asked for, and it tells the person who opened someone else's copied link why. The `/public/[slug]` note in the docstring goes."},{"oldText":"  - `board-not-found.spec.ts`: the other user's board is opened by its id and shows \"Board not found\"; the assertion on the public-link sentence goes.","newText":"  - `board-not-found.spec.ts`: the other user's board is opened by its id and shows \"Board not found\"; the assertion on the public-link sentence asks for \"A board opens only for the account that owns it.\" instead."},{"oldText":"The case keeps its claim: its window is lowered until the panel without the notice still cannot hold the search box, the filters, one row of the list and the buttons, its comment carries the measured numbers, and it runs in step 1 of section 6.","newText":"The case keeps its claim: its window is lowered until the panel without the notice still cannot hold the search box, the filters, one row of the list and the buttons, but not below 256px (the height WCAG 1.4.10 Reflow uses for content that scrolls sideways, as the board does). Its comment carries the measured numbers, and it runs in step 1 of section 6. If the panel no longer overflows at 256px, the case asserts instead that the whole panel fits with Add reachable, and a GitHub issue records that the overflow path has no test. The comment at `AddRepositoryCombobox.tsx:504-510` says that 26rem was measured with the notice, which is gone, and stays so the 416px measurement and the panel's position do not change."},{"oldText":"3. Local check as `ryota-murakami` on `http://localhost:3008`, on a board with repositories in two columns: Board Settings shows three tabs; Copy Link copies the board address; Add Repositories and Move to Another Board show no sharing notice; a signed-out `/public/a1b2c3d4e5f6` redirects to `/login`.","newText":"3. Local check as `ryota-murakami` on `http://localhost:3008`, on a board with repositories in two columns: Board Settings shows three tabs; Copy Link copies the board address and its toast reads as section 3 says; Add Repositories and Move to Another Board show no sharing notice; a signed-out `/public/a1b2c3d4e5f6` redirects to `/login`; another account's board id shows \"A board opens only for the account that owns it.\". Screenshots before (on `main`) and after, at 375px and 1280px wide: the `/boards` grid with a board whose name is one long word; each Board Settings tab at 375px (the observed row layout of the three tabs goes into the header of `board-settings-narrow-viewport.spec.ts` and the comment at `BoardSettingsDialog.tsx:486`; Danger Zone alone on a second row is acceptable, it sets the destructive tab apart); the Add Repositories panel at 1280x720 and at the short window of `add-repository-combobox.spec.ts:938`; the Move dialog with its board list open. They go into PR A's body. The header comment of `BoardPageClient.tsx:225-233` (\"all four buttons\") stays true: the header keeps four buttons."},{"oldText":" The 26rem least height of the panel and the 416px measurement stay: the panel's height comes from its position, not from its content.","newText":" The 26rem least height of the panel and the 416px measurement stay; the next bullet says why the 26rem, measured with the notice, stays."},{"oldText":"- `README.md`: the feature line \"Public board sharing with unique share links\" becomes \"Boards are private to you\".","newText":"- `README.md`: the feature line \"Public board sharing with unique share links\" becomes \"Private boards: a board opens only for the account that owns it\"."},{"oldText":"- `CHANGELOG.md` and `VERSION` through `/ship`. The entry says that public board links are gone and that a board opens for its owner only.","newText":"- `CHANGELOG.md` and `VERSION` through `/ship`. The entry says that public board links are gone and that \"A board opens only for the account that owns it.\""},{"oldText":"A public board found here is reported in PR B and the final report (its count and whether it is the owner's board or the other account's, never its slug), and the merge goes on: the owner asked for the removal, and the share ends with it.","newText":"A public board found here is reported in PR B and the final report (its count and whether it is the owner's board or the other account's, never its slug), and the merge goes on: the owner asked for the removal, and the share ends with it. When it is the other account's, a GitHub issue records the count and the owner kind, so the owner can tell that user; its visitors meet the sign-in page afterwards."},{"oldText":"- The privacy policy's wording about which repositories are stored (`src/app/privacy/page.tsx:62`): found during the review, filed as #254, not part of this change.","newText":"- The privacy policy's wording about which repositories are stored (`src/app/privacy/page.tsx:62`): found during the review, filed as #254, not part of this change.\n- Returning to the requested board after sign-in (a copied board link opened signed out ends on `/boards`): existed before, filed as #258.\n- Arrow-key navigation and touch targets of the Board Settings tabs: existed before, filed as #259."}]} -->

<!-- autoplan-accepted:design -->

- One wording for the rule, "A board opens only for the account that owns it." (it replaces the README line "Boards are private to you" and the CHANGELOG wording "a board opens for its owner only" of the CEO block): the board 404 page shows it in place of the public-link line, Copy Link's toast says "Only the account that owns this board can open it.", README's feature line is "Private boards: a board opens only for the account that owns it", and the CHANGELOG uses it; `board-not-found.spec.ts` asserts the sentence on the page.
- `BoardCard` loses only the `Globe` element; its wrapper span with `flex max-w-[calc(100%+4rem)]` stays.
- `add-repository-combobox.spec.ts:938` lowers its window no further than 256px; if the panel no longer overflows there, the case asserts that it fits with Add reachable, and an issue records the untested overflow path. The comment at `AddRepositoryCombobox.tsx:504-510` says 26rem was measured with the notice and stays unchanged.
- The local check takes screenshots before and after at 375px and 1280px of the `/boards` grid (a one-word board name), each Board Settings tab at 375px, the Add Repositories panel (1280x720 and the short window) and the Move dialog's open board list; they go into PR A's body; the observed three-tab layout at 375px goes into the narrow-viewport spec's header and the tab row comment.
- An other account's public board found before PR B is merged anyway and recorded in a GitHub issue (count and owner kind, no slug).
- The stale tab's silent Sharing switch is a recorded release exception; no code.
- The header comment "all four buttons" of `BoardPageClient.tsx` stays.

<!-- /autoplan-accepted:design -->

Phase 2 report published: Outside review completed (4 concerns), native subagent completed (7 issues), consensus 3/8 litmus rows (5 not applicable), 1 disagreement to the gate.

### Phase 2.5: DX review (mode: DX POLISH, /autoplan override)

Methodology: `.gstack/tmp/autoplan/autoplan-dx-methodology-yca7xl/methodology.md`, sha `aea5bd73…`, 2095 lines, read in four ranges (1–600, 601–1200, 1201–1800, 1801–2095) through EOF. Prior DX reviews: none.

Product type (auto-detected, auto-confirmed): the repository as contributors work in it, a **Platform + Documentation** surface: `CLAUDE.md`, `SPEC.md`, `TODOS.md`, the scripts (`pnpm db:reset`, `pnpm e2e:parallel`), the migration workflow and the Server Action endpoint list. GitBox has no public API, SDK or CLI; the terms that triggered DX scope name these.

#### 0A. Persona (auto-decided, P6)

```
TARGET DEVELOPER PERSONA
========================
Who:       the owner, or an AI coding agent (Cursor, Claude Code, Codex) working in a fresh git worktree
Context:   picks up a change like this one; reads CLAUDE.md first and follows it literally
Tolerance: low for docs that describe code that is gone: an agent acts on every stale sentence
Expects:   CLAUDE.md, SPEC.md and TODOS.md describe the system as it is; every documented command runs
```

#### 0B. Empathy narrative

I open a new worktree of GitBox to fix a bug on the board page. `CLAUDE.md` tells me a board has `is_public` and `share_slug`, that `get_public_board` is the only way to read a board that is not yours, and that `/public/<slug>` is let through the proxy. After this plan none of that exists, so every one of those lines would send me to code that is not there; the plan rewrites them (section 5). Then I run `pnpm db:reset` as `CLAUDE.md` says, and it stops at once: `cd supabase && . .env` finds no `supabase/.env`, because a worktree carries no ignored files (observed in this run). Nothing tells me which files to copy or which one I must not copy (`.env.production` points a local build at production, `CLAUDE.md` "Verification with the real account"). I copy `.env` and `supabase/.env` from the main checkout by guessing. `pnpm e2e:parallel` then works and resets the shared local database. When PR B's migration fails in CI, I read the job log: the CLI prints the message and the `DETAIL` of a failed migration (`CLAUDE.md`, "Migrations that move or delete data"), so what I do next has to be in `DETAIL`.

Corrections: none (auto-decided). The worktree friction is observed; the CI log behavior is from `CLAUDE.md` and the learning `supabase-db-push-hides-notice`.

#### 0C. Benchmark and target (auto-decided)

| Tool                          | Start → result                       | Time + evidence type                                                        | DX choice                                      | Source                                                                                                                                                               |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code / Codex worktrees | new worktree → ignored files present | reported, no time                                                           | `.worktreeinclude` lists ignored files to copy | [ChatGPT Learn: Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees), [philipm.at](https://philipm.at/2026/copy-ignored-files-to-new-git-worktrees) |
| Global post-checkout hook     | `git worktree add` → `.env*` copied  | reported, no time                                                           | hook copies `.env*`, never overwrites          | [worktree-env-copy](https://github.com/DaniAkash/worktree-env-copy)                                                                                                  |
| GitBox today                  | new worktree → `pnpm db:reset` green | estimated 5–10 min of finding and copying files by hand, before Docker work | none; undocumented                             | this run (observed failure)                                                                                                                                          |

Clock: a contributor in a fresh worktree, from "open the worktree" to "`pnpm db:reset` green and `pnpm test` running". Target (auto-decided, P5): **Competitive (2–5 min)**, reached by documentation in `CLAUDE.md`, a file this plan already edits: name the two files to copy and the one not to copy. A `.worktreeinclude` or a Cursor setup file is a change of its own (filed, below).

#### 0D. Magical moment

For this change: the Success grep returns nothing and `CLAUDE.md` describes one trust boundary, so an agent that reads the docs finds no trace of sharing. Vehicle: the grep output in PR A's body (accepted in Phase 1, C3). No new vehicle.

#### 0E. Mode

DX POLISH (/autoplan override): the plan's DX scope is right; every touchpoint gets checked; no scope added beyond the docs this plan already edits.

#### 0F. Developer journey

| Stage          | Developer does                                     | Friction                                                          | Status                                       |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| 1. Discover    | reads `CLAUDE.md`, `SPEC.md`                       | stale sharing text                                                | fixed by section 5                           |
| 2. Install     | opens a worktree, `pnpm install`, copies env files | no `supabase/.env` → `pnpm db:reset` fails; which files?          | fixed in `CLAUDE.md` (DX1); automation filed |
| 3. Hello World | `pnpm test`, `pnpm typecheck`                      | none                                                              | ok                                           |
| 4. Real usage  | removes the feature, runs `pnpm e2e:parallel`      | leftover exports pass the checks                                  | fixed by `pnpm knip` (CEO)                   |
| 5. Debug       | reads a failed migration in the CI log             | a `RAISE` without next step in `DETAIL`                           | fixed (DX2)                                  |
| 6. Upgrade     | pulls `main` into an open branch                   | code that names `isPublic` or `toggleBoardPublic` stops compiling | fixed (DX3)                                  |

#### 0G. First-time developer report

```
FIRST-TIME DEVELOPER REPORT
Persona: AI agent in a fresh worktree
Attempting: run the checks of CLAUDE.md "Critical Rules"
T+0:00  pnpm install: ok.
T+0:30  pnpm db:reset: ". .env: no such file" (supabase/.env missing). Stuck: CLAUDE.md does not mention worktrees.
T+2:00  copies .env and supabase/.env from the main checkout (guess); considers .env.production too: CLAUDE.md warns
        that it points a local build at production, but only in another section.
T+3:00  pnpm db:reset green; pnpm test green.
T+5:00  pnpm e2e:parallel green.
```

Evidenced confusion: T+0:30 and T+2:00, both resolved by DX1.

#### 0.5. Dual voices

Voice input (`<DX_INPUT>`, also this phase's checkpoint): `autoplan-dx-dNIIaZ/dx-implementation.md`, sha `b1f5d430…`. Native voice ([Independent DX voice review](83a1aa64-3ec7-4ac7-b274-3c6f9d94a976)): completed, `INPUT: dx b1f5d430…` matches; 0 critical, 2 high (H1 unbounded polls, H2 stale review bullets), 11 medium (M1 to M11). Codex voice: completed (`OUTSIDE_STATUS: completed`, `gpt-6-astra`, about 149 s, `VERDICT: findings`, `FINDINGS: P1`); 3 high (CX1 parallel builds race in `.next`, CX2 PR A cannot pass the verification query, CX3 the local stack is shared by every worktree), 4 medium (CX4 setup tools and an unmeasured target, CX5 `pnpm test` watch mode and the grep's exit status, CX6 unbounded polls and the rerun mismatch, CX7 the rollback rule is not in the permanent docs).

```
DX DUAL VOICES — CONSENSUS TABLE:
  Dimension                           in-host                     Codex                         Consensus
  1. Getting started < 5 min?          6/10: ~25 actions, no preflight  no: shared stack, missing tools  CONFIRMED gap
  2. API/CLI naming guessable?         8/10: removal simplifies    not raised                    N/A (single voice)
  3. Error messages actionable?        5/10: polls, migration text, rerun  no: polls without failure  CONFIRMED gap
  4. Docs findable & complete?         7/10: stale bullets, no proof map  no: rollback rule not in docs  CONFIRMED gap
  5. Upgrade path safe?                6/10: rollback trap after PR B  no: compatibility note missing  CONFIRMED gap
  6. Dev environment friction-free?    gaps: watch mode, preflight  no: parallel builds, shared DB   CONFIRMED gap
5 of 6 confirmed, 0 disagreements, 1 single-voice row.
```

Dispositions (P1 and P5 unless named): H1 + CX6 applied: every poll waits 15 s, has a deadline (10 min for a record, 30 min for a deployment), ends on `success`, `failure`, `error` or `inactive`, and a failure stops the run before PR B with an issue; runs are found by sha across `-L10`. M4 + CX6 applied: a failed migration run is retried once with `gh run rerun`, which keeps the event and sha. H2 applied: "Requirements added in review" says the sections govern and the later phase wins. CX1 applied: test, lint and typecheck together, then build, then E2E alone. CX2 applied: PR A's gate is the grep and `knip`; the verification query belongs to PR B. CX3 + M5 applied: a step-0 preflight (account, Docker and the local stack, linked query, no other E2E run, env files, sessions and Sentry), with stop or "not checked" per item; namespacing the shared stack is filed (#261). CX4 applied in part: the target is labeled warm (Docker images and CLI present); README prerequisites and a `.worktreeinclude` are filed (#261, P3: outside the blast radius). M6 + CX5 applied: `pnpm test run`; the grep's exit status is mapped and a pass is printed. M1 applied: a word rule for comments. M2 applied: SQL from untracked files with `-f` and `--output-format json`, checked with `jq -e`. M3 applied: each check of the migration raises a labeled message with the next step in `DETAIL`. M7 applied: before screenshots now at `fae230d`, after on PR A, one Playwright script. M8 applied: a Success-to-proof table; `curl` for the signed-out redirect on production. M9 + CX7 applied: the emergency column restore in the migration header; a compatibility note in `CLAUDE.md` "Production Migration Procedure"; PR B's CHANGELOG names the oldest compatible build. M10 applied: #257 links the proxy's prefix exception and its tests at `fae230d` (comment posted). M11 applied: the seed rename moves into PR A's first commit. DX1 (worktree note in `CLAUDE.md`) applied (P2: a file this plan edits). No User Challenge.

#### Pass 1: Getting Started — 5/10 → 7/10

Evidence: 0C (target Competitive, warm), 0F stage 2, 0G T+0:30. The plan now starts with a preflight and `CLAUDE.md` says which files a worktree needs. Ideal sequence for the persona: (1) copy `.env` and `supabase/.env` from the main checkout, (2) `pnpm install && pnpm db:start`, (3) `pnpm test run`; about 3 minutes warm, without Docker image downloads. Remaining: a cold clone still needs the Supabase CLI and Chromium that the README does not list (#261).

#### Pass 2: API/CLI/SDK — 8/10 → 8/10

The Server Action surface loses two endpoints (`toggleBoardPublic`, `getPublicBoardBySlug`), and `browser-callable-actions.test.ts` lists the rest. After the change "public" in the code has one meaning: reachable signed out (`publicPaths`). No issues found.

#### Pass 3: Error Messages & Debugging — 5/10 → 8/10

Three error paths traced. (1) A failed Vercel build: before, a poll that never ends; after, a final state, a deadline, an issue with the sha and URL, and the step to resume. (2) A failed migration check: before, "raise"; after, `remove_public_board: board.is_public still exists` with `DETAIL` "Nothing was changed (one transaction). Find what still uses it and drop that in a new migration on main." (3) A lock timeout: before, a dispatch the poll could not see; after, one `gh run rerun`, then stop. Remaining: Postgres's own dependency error is not rewritten (it names the object, which is enough).

#### Pass 4: Documentation & Learning — 7/10 → 9/10

Sections 1 to 6 govern and the review list is an index; every line of Success has its proof in the PR body; `CLAUDE.md` gains the compatibility note and the worktree note; comments use the word rule. Remaining: none in scope.

#### Pass 5: Upgrade & Migration Path — 6/10 → 8/10

Two PRs keep the old build working until PR B; after PR B the oldest compatible build is named in `CLAUDE.md` and PR B's CHANGELOG, and the migration header carries the emergency restore of the two columns. Open branches that use `isPublic` or `toggleBoardPublic` stop compiling after a rebase; PR A's body says so (DX3). Remaining: no deprecation step (the feature had no user).

#### Pass 6: Developer Environment & Tooling — 5/10 → 7/10

Serial order of the checks, `pnpm test run`, the grep's exit mapping, `knip`, the preflight's check that no other E2E run uses the shared stack. Remaining: the shared stack itself (#261).

#### Pass 7: Community & Ecosystem — 6/10 → 7/10

Every gap found became an issue: #254, #257 (with the template links), #258, #259, #261. The repository is solo; no channel is added. No other issues.

#### Pass 8: DX Measurement & Feedback Loops — 2/10 → 4/10

The Success-to-proof table measures this change; TTHW of a fresh worktree is not instrumented. Adding a timer or a CI job is a policy of its own and is not proposed (P3); #261's fix is where a measurement would start. Remaining: no TTHW measurement.

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      | 7/10   | 5/10   | ↑      |
| API/CLI/SDK          | 8/10   | 8/10   | =      |
| Error Messages       | 8/10   | 5/10   | ↑      |
| Documentation        | 9/10   | 7/10   | ↑      |
| Upgrade Path         | 8/10   | 6/10   | ↑      |
| Dev Environment      | 7/10   | 5/10   | ↑      |
| Community            | 7/10   | 6/10   | ↑      |
| DX Measurement       | 4/10   | 2/10   | ↑      |
+--------------------------------------------------------------------+
| TTHW                 | ~3 min (warm, target) | 5–10 min (estimated) | ↑ |
| Competitive Rank     | Competitive (warm); Needs Work (cold, #261)  |
| Magical Moment       | designed via the grep output in PR A's body  |
| Product Type         | Platform + Documentation (contributor repo)  |
| Mode                 | POLISH                                       |
| Overall DX           | 7/10   | 5/10   | ↑      |
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction      | covered (warm); gap (cold, #261)               |
| Learn by Doing     | covered (copy-paste commands and SQL files)    |
| Fight Uncertainty  | covered (final states, labeled messages)       |
| Opinionated + Escape Hatches | covered (serial order; emergency restore) |
| Code in Context    | covered (real commands of this repo)           |
| Magical Moments    | covered (grep gate)                            |
+====================================================================+
```

```
DX IMPLEMENTATION CHECKLIST
============================
[x] Time to hello world < 5 min (warm), by the worktree note in CLAUDE.md
[ ] Installation is one command (cold clone: #261)
[x] First run produces meaningful output (pnpm test run; "grep gate: pass")
[x] Magical moment delivered via the grep output in PR A's body
[x] Every error message has: problem + cause + fix (migration DETAIL, poll failures, rerun rule)
[x] Naming is guessable (one meaning of "public")
[x] Docs have copy-paste commands that work (SQL from files, jq checks)
[x] Upgrade path documented (compatibility note, emergency restore, oldest build)
[x] Works in CI without special configuration (unchanged)
[x] Changelog maintained (both PRs)
```

Required outputs: persona card (0A), empathy narrative (0B), benchmark (0C), magical moment (0D), journey map (0F), confusion report (0G), scorecard and checklist (above). NOT in scope: `.worktreeinclude`, a Cursor worktree setup file, README prerequisites, namespacing the shared stack (all #261); a TTHW timer. What already exists: README "Getting Started", `CLAUDE.md` "Local Development Setup" and "Production Migration Procedure", `gh run rerun`, `supabase db query -f --output-format json`. TODOS.md updates: none (the gaps are issues, per the owner's direction).

Implementation Tasks (DX):

- [ ] **T1 (P1, human: ~30min / CC: ~5min)** — rollout — Preflight and bounded polls with final states, deadlines and issues on failure
  - Surfaced by: Pass 3 — H1, CX6, M5, CX3
  - Files: docs/plans/2026-10-16-remove-public-board.md
  - Verify: the final report lists each poll's last state
- [ ] **T2 (P1, human: ~20min / CC: ~3min)** — migration — Labeled messages with `DETAIL` and the emergency restore in the header
  - Surfaced by: Pass 3 — M3, M9
  - Files: supabase/migrations/20261016190000_remove_public_board.sql
  - Verify: `pnpm db:reset` applies it; a second run returns early
- [ ] **T3 (P2, human: ~20min / CC: ~3min)** — docs — Compatibility note and worktree note in CLAUDE.md
  - Surfaced by: Pass 4/5 — CX7, DX1
  - Files: CLAUDE.md
  - Verify: the Success grep; a read of both notes
- [ ] **T4 (P2, human: ~10min / CC: ~1min)** — checks — Serial order, `pnpm test run`, grep exit mapping
  - Surfaced by: Pass 6 — CX1, CX5, M6
  - Files: to be determined
  - Verify: each check exits on its own

<!-- autoplan-baseline-edits:dx {"sourceSha256":"71a5dc8d119e073ed3fa68c4fd4421c672d8a58acf272aa046cba33f48518725","replacements":[{"oldText":"Accepted during the review. Each one is also written into the section it governs.","newText":"Accepted during the review, by phase. Sections 1 to 6 govern; this list is an index of what the review added. Where two items differ, the later phase wins: Design over CEO, DX over both (the README and CHANGELOG wording, for example, is the Design item's)."},{"oldText":"1. `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm e2e:parallel`.\n2. `pnpm db:reset`, then the verification query against the local database.","newText":"0. Preflight, before any change and before any reset; a failed item stops the run or is reported as \"not checked\", as named: `gh auth status` shows `ryota-murakami` active (stop otherwise); Docker runs and `pnpm db:start` has the local stack up (stop otherwise); `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp \"select 1\"` answers (stop before step 5 otherwise); no other checkout runs E2E against the shared local stack (`docker ps` shows no shard container; stop otherwise: the stack, its ports and the shard names are shared, #261); this worktree has `.env` and `supabase/.env`, copied from the main checkout, and no `.env.production`; the local and production browser sessions as `ryota-murakami` and Sentry access are checked when steps 3, 8 and 10 need them, and reported \"not checked\" when missing. The local database is reset by the E2E commands; the owner's local boards are not kept (`CLAUDE.md`, \"Verification with the real account\").\n1. Checks in this order, which overrides the \"run in parallel\" line of `CLAUDE.md` \"Critical Rules\" for this change: `pnpm test run`, `pnpm lint` and `pnpm typecheck` together (`pnpm test` alone is `vitest` in watch mode); then `pnpm build`; then `pnpm e2e:parallel` alone (it builds into the same `.next` with its own environment and resets the local database).\n2. Gates. PR A: the Success grep (exit 1 means no match: pass, printed as \"grep gate: pass\"; exit 0 means a match: fail; anything else means the grep itself failed) and `pnpm knip` against `main`. PR A's database keeps the two columns and the function, so the verification query is not run for PR A. PR B: on PR B's branch, `pnpm db:reset`, then the verification query. The SQL of this plan runs from files under `.gstack/tmp/` (untracked, so the grep never sees them): locally `supabase db query --local -f <file> --output-format json`, on production `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp -f <file> --output-format json`; `jq -e` checks the expected values, after a `select 1` has shown the JSON shape."},{"oldText":"They go into PR A's body. The header comment of `BoardPageClient.tsx:225-233` (\"all four buttons\") stays true: the header keeps four buttons.","newText":"They go into PR A's body. The header comment of `BoardPageClient.tsx:225-233` (\"all four buttons\") stays true: the header keeps four buttons. Order: the before screenshots are taken first, in this worktree at `fae230d` before any change, after `pnpm db:reset` (the seed's Test Board is public there, so the notices show); the after screenshots on PR A's branch after its own `pnpm db:reset`. One Playwright script under `.gstack/tmp/` lists every view, width and file name and creates the board whose name is one long word, so the set can be taken again after a rebase."},{"oldText":"Commits of PR A: (a) removal from client and server with tests, stories, fixtures and the `types.ts` edit (the fixtures are typed `Tables<'board'>`, whose `Row` lists the two columns, so the type and the fixtures change together); (b) the seed; (c) docs. Each passes `pnpm typecheck`.","newText":"Commits of PR A: (a) removal from client and server with tests, stories, fixtures, the `types.ts` edit (the fixtures are typed `Tables<'board'>`, whose `Row` lists the two columns, so the type and the fixtures change together) and the seed (the moved isolation spec reads \"Other User Board\" back, so the seed rename lands with it and the commit is green on E2E too); (b) docs. Each passes `pnpm typecheck`."},{"oldText":"6. Merge PR A. No migration runs. Confirm with `gh run list --workflow supabase-production.yml -L1 --json headSha`: no run for PR A's merge sha.","newText":"6. Merge PR A. No migration runs. Confirmed once step 7 has reached `success`, by sha and not by position: `gh run list --workflow supabase-production.yml -L10 --json headSha | jq -e --arg s \"$SHA\" 'map(select(.headSha == $s)) | length == 0'`."},{"oldText":"then poll `gh api repos/laststance/gitbox/deployments/<id>/statuses --jq '.[0].state'` until it prints `success`.","newText":"then poll `gh api repos/laststance/gitbox/deployments/<id>/statuses --jq '.[0].state'` until it prints a final state. Every poll of this plan waits 15 seconds between reads and has a deadline: 10 minutes for a record to appear, 30 minutes for the deployment to finish. `success` goes on; `failure`, `error` or `inactive`, or a deadline, stops the run before PR B: a GitHub issue records the sha, the deployment URL and the last state, and the final report names the step to resume from."},{"oldText":"9. Open PR B from `main`, CI green, production audit of step 5, then merge PR B. The `push` run of `supabase-production.yml` applies the migration: poll `gh run list --workflow supabase-production.yml --event push -L1 --json databaseId,headSha,createdAt,status` until `headSha` is PR B's full merge sha, and `gh run watch <databaseId> --exit-status` waits for it to finish green.","newText":"9. Open PR B from `main`, CI green, production audit of step 5, then merge PR B. The `push` run of `supabase-production.yml` applies the migration: poll `gh run list --workflow supabase-production.yml --event push -L10 --json databaseId,headSha,createdAt,status` until an entry has PR B's full merge sha (10 minutes at most), keep its `databaseId`, and `gh run watch <databaseId> --exit-status` waits for it to finish green."},{"oldText":"On `lock_timeout` or a deadlock, run the workflow again (`gh workflow run supabase-production.yml`).","newText":"On `lock_timeout` or a deadlock, run the same run again once with `gh run rerun <databaseId>` (it keeps the event and the sha, so the poll of step 9 still finds it) and `gh run watch <databaseId> --exit-status`; a second failure stops the run, and a GitHub issue records it."},{"oldText":"5. Check, and raise (rolling everything back) when one fails: neither column exists; the function does not exist; no function in schema `public` has `is_public` or `share_slug` in its body.","newText":"5. Check, and raise (rolling everything back) when one fails: neither column exists; the function does not exist; no function in schema `public` has `is_public` or `share_slug` in its body. Each check raises its own message, which starts with `remove_public_board:` and names the object, and puts the next step in `DETAIL` (the CLI prints a failed migration's message and `DETAIL`, not its `HINT`): \"Nothing was changed (one transaction). Find what still uses it and drop that in a new migration on main.\" A dependency at item 4 fails with Postgres's own error, which names the dependent object. The header says so, gives the fix-forward rule, and gives the emergency step for a rollback to a build before PR A after this migration ran: `ALTER TABLE public.board ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS share_slug text;` (old builds load again; the function stays gone, so nothing can be shared)."},{"oldText":"the `/public/<slug>` part of \"Signed-out access\".","newText":"the `/public/<slug>` part of \"Signed-out access\". Two additions in files this plan edits: under \"Production Migration Procedure\", a compatibility note (after PR B, PR A's merge commit is the oldest build that runs on production's schema; an Instant Rollback goes to it or later; the emergency step of the migration header; the verification query lives in this plan); under \"Local Development Setup\", a worktree note (a git worktree has no ignored files: copy `.env` and `supabase/.env` from the main checkout before `pnpm db:reset`, never `.env.production`; the local stack is shared by every checkout, so one E2E run at a time; #261 for the rest)."},{"oldText":"- New tests: none beyond the changed and moved cases.","newText":"- Wording of comments that explain what was removed: \"the removed sharing notice\" or \"link sharing (removed)\", so the Success grep stays a hard gate; neither phrase matches its pattern.\n- New tests: none beyond the changed and moved cases."},{"oldText":"11. The final report lists both PRs, the migration run, the verification result and the checks of steps 8 and 10, with the board each check used and how many cards it held.","newText":"11. The final report lists both PRs, the migration run, the verification result and the checks of steps 8 and 10, with the board each check used and how many cards it held. Each PR body and the final report hold a table from every line of Success to its proof (command or test, and its output or artifact). The signed-out redirect on production is proved without a browser: `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\\n' https://gitbox-laststance.vercel.app/public/a1b2c3d4e5f6` prints a redirect to `/login`."},{"oldText":"History stays in `CHANGELOG.md`, `docs/plans/`, `docs/designs/` and old migrations, which are not edited.","newText":"PR B's entry names PR A's merge commit as the oldest build that runs on the new schema. History stays in `CHANGELOG.md`, `docs/plans/`, `docs/designs/` and old migrations, which are not edited."}]} -->

<!-- autoplan-accepted:dx -->

- Sections 1 to 6 govern; "Requirements added in review" is an index, and where two items differ the later phase wins (Design over CEO, DX over both).
- A step-0 preflight runs before any change or reset: `ryota-murakami` active in `gh`; Docker and the local stack up; the linked production query answers; no other checkout runs E2E on the shared stack; `.env` and `supabase/.env` present and no `.env.production`; sessions and Sentry checked when needed, else "not checked".
- Checks run in this order: `pnpm test run`, `pnpm lint`, `pnpm typecheck` together; then `pnpm build`; then `pnpm e2e:parallel` alone.
- PR A's gate is the Success grep (exit 1 = pass, printed "grep gate: pass"; exit 0 = fail; else the grep failed) and `pnpm knip`; the verification query runs on PR B's branch after `pnpm db:reset`. SQL runs from untracked files under `.gstack/tmp/` with `-f` and `--output-format json`, checked with `jq -e`.
- Every poll waits 15 s between reads, has a deadline (10 min for a record to appear, 30 min for a deployment), and ends on a final state; anything but `success` stops the run before PR B and files an issue with the sha, URL and last state. Runs are found by full sha across `-L10`. A failed migration run is retried once with `gh run rerun <databaseId>`, then the run stops and an issue records it. The check that PR A started no migration runs after its deployment reached `success`.
- Each check of the migration raises a message that starts with `remove_public_board:`, names the object and puts the next step in `DETAIL`; the header gives the fix-forward rule and the emergency restore of the two columns for a rollback to a build before PR A.
- `CLAUDE.md` gains a compatibility note under "Production Migration Procedure" (after PR B, PR A's merge commit is the oldest compatible build; Instant Rollback to it or later; the emergency restore) and a worktree note under "Local Development Setup" (copy `.env` and `supabase/.env`, never `.env.production`; one E2E run at a time; #261).
- PR B's CHANGELOG entry names PR A's merge commit as the oldest build that runs on the new schema.
- Comments that explain what was removed say "the removed sharing notice" or "link sharing (removed)".
- The before screenshots are taken at `fae230d` before any change, after `pnpm db:reset`; the after screenshots on PR A's branch; one untracked Playwright script lists every view, width and file.
- PR A's first commit holds the seed rename with the code, tests, fixtures and `types.ts`; the second holds the docs.
- Each PR body and the final report map every line of Success to its proof; the signed-out redirect on production is proved with `curl`.
- PR A's body says that open branches using `isPublic` or `toggleBoardPublic` stop compiling after a rebase.

<!-- /autoplan-accepted:dx -->

Phase 2.5 report published: DX overall 7/10, TTHW 5–10 min (estimated) → 3 min (warm target); outside review completed (7 concerns), native subagent completed (13 issues), consensus 5/6, 0 disagreements.

### Phase 3: Eng review (mode: FULL_REVIEW)

Methodology: `.gstack/tmp/autoplan/autoplan-eng-methodology-V68irh/methodology.md`, sha `5dd5377a…`, 2233 lines, read in four ranges (1–600, 601–1200, 1201–1800, 1801–2233) through EOF. Target: the plan `docs/plans/2026-10-16-remove-public-board.md` (autoplan input; report file is the same plan). Prior learnings: the ten loaded at the CEO phase; `prod-migration-no-approval-gate` and `supabase-db-push-hides-notice` apply.

#### Step 0. Scope challenge

A. Assessment, read against the code at `fae230d`:

- What already solves each sub-problem: the removal reuses what exists. The proxy's login redirect (`src/proxy.ts:149-156`) answers `/public/<slug>` once its exception goes. `toMoveButtonDescription` keeps its failure id. The isolation cases move unchanged in substance. `toRepoCardDomain` stays (`src/lib/actions/mappers.ts:164`). The migration follows `20261011030000_public_board_by_slug_only.sql:50-152`.
- Minimum changes: every changed file reads or describes something that is removed; dropping any leaves dead code, a broken import or stale docs (the Success grep). Nothing is deferrable without failing the definition of done.
- Complexity: about 70 changed files [estimated; the Success grep matched 628 lines in 69 files at `fae230d`, native DX voice], 0 new classes or services, 1 new spec file (moved cases), 1 new migration. B's gate trips (8+ files).
- Search check: no new architectural pattern, infrastructure or concurrency approach; nothing to research.
- TODOS cross-reference: five entries exist only for sharing and go; "Show the fetched board name…" takes a new pattern; one entry is added (CI check of anonymous definer functions). Nothing in TODOS.md blocks this plan.
- Completeness and distribution: no new artifact to distribute.

B. Complexity selectors (auto-decided, P5 and the owner's direction). Feature cuts: none proposed; the owner asked for a complete removal. Structure: A) Original arrangement (recommended, auto-decided): every file this plan touches reads or describes a removed symbol, column or route, so no smaller arrangement keeps the removal complete. Pending remedies not decided here: none. Scope record: `feature answers: none (no cuts proposed); structure: A (auto-decided, /autoplan); accepted scope: the plan as amended by CEO, Design and DX; pending remedies: none`.

C. Findings of the scope challenge: none beyond what the earlier phases applied. Scope Challenge result: **scope accepted as-is** (MODE `FULL_REVIEW`).

| Premise | Claim                                                                                                                 | Receipt                                                                                                                                         | Verdict  |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E1      | No file outside the deleted ones imports `public-board.ts`, `validations/public-board.ts` or `to-public-board-url.ts` | `rg` at `fae230d`: importers are `src/app/public/[slug]/page.tsx`, `BoardSettingsDialog.tsx:71`, `BoardPageClient.tsx:67` and the deleted tests | verified |
| E2      | `pnpm e2e:parallel` builds the app itself                                                                             | `scripts/e2e-parallel.sh:119-127`                                                                                                               | verified |
| E3      | CI runs the unit tests once, not in watch mode                                                                        | `.github/workflows/test.yml:30` (`pnpm test run --coverage`)                                                                                    | verified |
| E4      | `supabase-production.yml` starts on push only for migrations, `config.toml` and itself                                | `.github/workflows/supabase-production.yml:3-10`                                                                                                | verified |
| E5      | No test lists `PublicBoardClient` outside the deleted test files                                                      | `rg PublicBoardClient src/tests e2e .storybook` at `fae230d`: only `src/tests/unit/app/public/*`                                                | verified |
| E6      | The only `SECURITY DEFINER` function `anon` may execute today is `get_public_board`                                   | production query 2026-10-16 (CEO phase)                                                                                                         | verified |

`unverified=0`.

REALITY: premise-table pass 6 engineering premises, 6 with receipts, unverified=0 scripts/e2e-parallel.sh:119
REALITY: already-done pass git log origin/main after fae230d on the named files returns nothing; fae230d is origin/main .github/workflows/supabase-production.yml:3
REALITY: surface-check pass pnpm test run (CI form), supabase db query --local and --linked with -f and --output-format json (--help), gh run rerun, gh run list --event, gh api deployments and statuses (live call 2026-10-16) .github/workflows/test.yml:30
REALITY: binding-decisions pass gstack-decision-search --scope branch --recent 50 returns nothing; the plan's binding decisions are its accepted blocks (two PRs, isolation tests moved, one wording) and this phase keeps them docs/plans/2026-10-16-remove-public-board.md:164
REALITY: numbers pass about 70 changed files [estimated]; 628 grep lines in 69 files [measured: native DX voice, git grep at fae230d]; 6 boards, 0 public [measured: production query 2026-10-16] scripts/e2e-parallel.sh:119
REALITY: deferred-asks pass no linked issue; the owner's three asks are all in the plan, and the problems found became #254, #257, #258, #259, #261 docs/plans/2026-10-16-remove-public-board.md:5
REALITY: pr-count finding two PRs (A: code, B: migration) where the default is one; queue cost: one more CI run (about 15 minutes) and one more /ship; user-facing references: PR A's CHANGELOG says links are gone, PR B's names the oldest compatible build docs/plans/2026-10-16-remove-public-board.md:146
REALITY: transaction-semantics n/a no driver, pool or protocol change; the migration is one DO block in the CLI's own transaction supabase/migrations/20261011030000_public_board_by_slug_only.sql:50

#### Step 0.5. Dual voices

CODEX SAYS (eng — architecture challenge), `gpt-6-astra`, read-only sandbox, 197 s, `OUTSIDE_STATUS: completed provider=codex host=cursor`; its GitHub API calls failed, so it reviewed the code and the plan only. Four Medium findings: (C1) the four moved cases do not prove the tenant-isolation line of Success: no board delete, no column update or delete, the order write is read back by `repo_name` (`public-board-data-access.spec.ts:93`, policies `20260208_reenable_rls_optimized_policies.sql:48,69`); (C2) the migration's `DETAIL` sends the operator to a later migration, which cannot run while the failing one blocks `db push` (`supabase-production.yml:47`); (C3) `docker ps` does not prove exclusive use of the local stack: a plain Playwright run resets it in `e2e/global-setup.ts:34` without shard containers, and `e2e-parallel.sh:84` resets before creating them at `:117`; (C4) `gh run watch --exit-status` has no deadline. Recommendation: "Revise the plan before implementation because its isolation proof is incomplete and its migration recovery, shared-stack exclusion, and completion deadlines are not executable as written."

CURSOR (IN-HOST) SUBAGENT (eng — independent review), `INPUT: eng 8857e89556e7288e99c93f0e482e1729fc054ccf42e8bb26050309967c73f8cf` (matches the snapshot), about 500 s [measured: file times]. Twelve findings: (N1, High) the fixed name `20261016190000` sorts before `20261016191000` of open PR #260, and `db push` refuses an older version; (N2) the base is stale (`main` at `aad85ac`) and other runs merge meanwhile, with no up-to-date rule; (N3) "no mixed window" assumes Vercel Skew Protection is off; (N4) the isolation cases cover less than Success says, and `anon` holds the table grants; (N5) `add-repository-combobox.spec.ts:1085` was measured with the notice too, and comments at `:1042` and `names-that-cannot-break.spec.ts:570` are unlisted; (N6) `_` in `ILIKE '%is_public%'` is a wildcard; (N7) `gh run watch` has no deadline; (N8) Copy Link's `window.location.href` keeps `?card=`; (N9) the Move default changes in E2E; (N10) the future CI check must read the `postgres` database, not a shard, and exclude `event_trigger`; (N11) the grep does not see "sharing" or "globe"; (N12) local CLI 2.121.0 against the pinned 2.120.0. Verified by it: the Vercel lookup by sha and `vercel[bot]`, PR A runs no migration, the CLI flags, `get_public_board` is the only definer function, nothing else depends on the columns, the signed-out redirect.

Checked by the primary reviewer before deciding:

- N1: confirmed. `gh pr list` shows #260 (`fix/picker-marks-after-list`) with `supabase/migrations/20261016191000_saved_repository_mark.sql`; production's `max(version)` is `20261016181500`, 43 applied [measured: linked query 2026-10-16]. The native fix, `supabase migration new`, would make it worse: the repository names migrations by Japan time (`20261016181500` committed 18:18 JST, `f96be39`) and the CLI names by UTC (`20261016115235` at the time of the check). Decision: the version is the JST time when PR B's branch is created and is checked against three maxima right before the merge.
- N2: confirmed. `git log fae230d..origin/main` lists #255 and #256; #260 edits `types.ts`, `board-data.ts`, `TODOS.md`, `e2e-setup-databases.sh`. The Test workflow runs on `push` to `main` (`.github/workflows/test.yml:3-7`).
- N3: confirmed, and it is on. The Vercel project API returns `skewProtectionMaxAge: 43200` (12 hours) for `gitbox` [measured: GET /v9/projects/gitbox, 2026-10-16]. `vercel` CLI 50.1.6 has no `api` command.
- N8: confirmed. `BoardPageClient.tsx:200-202` copies `window.location.href`; `boardId` is in scope (`:85`); `linked-card.ts:35` builds `/board/<id>?card=`. Board paths are written inline as `` `/board/${id}` `` in this codebase (`BoardCard.tsx:152`, `MoveToAnotherBoardDialog.tsx:306`), so no helper is added.
- N9: checked, no change needed. Every Move flow in `move-to-another-board.spec.ts` picks Work Projects by hand (`:168`, `:233`, `:288`, `:319`, `:357`, `:501`, `:568`); the return dialog at `:367` expects Test Board, the only other board.
- N5: confirmed by reading `add-repository-combobox.spec.ts:1042` and `:1085-1100`, and `names-that-cannot-break.spec.ts:570`.

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           cursor (in-host)  Codex  Consensus
  1. Architecture sound?               yes      yes     CONFIRMED (two PRs, expand then contract)
  2. Test coverage sufficient?         no       no      CONFIRMED gap (N4 = C1; N5, N8) → fixed
  3. Performance risks addressed?      yes      —       N/A (Codex did not address it)
  4. Security threats covered?         partly   partly  CONFIRMED gap (isolation proof N4 = C1; N6) → fixed
  5. Error paths handled?              no       no      CONFIRMED gap (N1 rename, N7 = C4, C2) → fixed
  6. Deployment risk manageable?       yes, with fixes  yes, with fixes  CONFIRMED (N1, N2, N3, C3)
CONFIRMED = native + outside agree; primary cannot replace outside. DISAGREE → taste.
```

Consensus 5/6 confirmed, 0 disagreements. Single-voice High finding: N1 (native only; Codex had no GitHub access). The primary reviewer verified it with live data above, so it is applied, not left as a single-voice claim.

#### Section 1. Architecture

```
                         BEFORE (fae230d)                                   AFTER PR A                       AFTER PR B
 signed-out ─▶ proxy.ts ──isPublicBoardPath──▶ /public/[slug]/page.tsx     proxy.ts ─▶ 302 /login           (same)
                                     │                    │
                                     │        getPublicBoardBySlug (actions/public-board.ts)
                                     │                    │ rate limit publicBoardView
                                     ▼                    ▼
                          supabase.rpc('get_public_board') ── SECURITY DEFINER, anon EXECUTE ──▶ board.is_public/share_slug
                                                                                                   ▲   ▲        (columns stay,  (columns, index,
 owner ─▶ BoardSettingsDialog ─Sharing tab─▶ toggleBoardPublic (actions/board.ts) ─ generateSlug ──┘   │         read by nothing) function dropped)
 owner ─▶ MoveToAnotherBoardDialog ─▶ getUserBoardsWithStatusLists (select id,name,is_public) ─────────┘     select id,name
 owner ─▶ BoardPageClient Copy Link ─▶ toPublicBoardUrl | location.href                                      origin + /board/<id>
 owner ─▶ AddRepositoryCombobox ─isBoardShared─▶ HeldRepositoryList ─▶ MoveHereDialog (notice)              (prop removed)
 owner ─▶ BoardCard (Globe)                                                                                  (span kept, Globe gone)
```

Coupling: the removal cuts one path from the public internet into the database (the only `SECURITY DEFINER` function `anon` could run) and one prop chain three components deep (`isBoardShared`). Nothing new is coupled. Scaling: one column fewer in one select; no effect at 6 boards or at 6,000. Security: the attack surface shrinks; the remaining gate is row level security, which the extended isolation cases now prove for every table and write the app uses. Production failure scenario per new path: the only new production step is the migration; its failures (lock timeout, out-of-order version, a dependent object) each have a branch in section 6. Rollback posture: PR A by Vercel Instant Rollback or revert; after PR B fix forward, with the emergency `ADD COLUMN` in the migration header. Distribution: no new artifact.

Findings: N1, N2, N3 and C2 (all applied, see the accepted block). No other architecture issue.

#### Section 2. Code quality

- DRY: no new helper. The board address is built inline as the codebase does (`BoardCard.tsx:152`); a `toBoardPath` helper for one more caller would be a new abstraction for five existing inline uses (P5, P3: not added).
- Dead code: `PUBLIC_DESTINATION_TEXT_ID`, `isDestinationShared`, `ShareSlug`, `PublicBoardSlug` and `publicBoardView` go with their only readers; `pnpm knip` gates PR A.
- Comments that would go stale: listed in sections 2 and 4 of the plan; the wording rule ("the removed sharing notice", "link sharing (removed)") keeps the grep a hard gate; N11's non-gating pass catches "sharing", "globe" and "shared" that the gate cannot.
- Over-engineering: none; the migration's partial-state handling is required by the early-return rule (DX phase) and costs four lines.
- Under-engineering: N6 (`ILIKE` with `_`), fixed to `strpos`.

Findings: N6, N11 (applied). Nothing else.

#### Section 3. Test review

Framework: Vitest (unit, `src/tests/unit/**`), Playwright (E2E, `e2e/{logged-in,unauthenticated}/**`), Storybook stories as fixtures. Read for this section: `BoardPageClient.tsx:190-215`, `useMoveDialogState.ts:210-270`, `proxy.ts:149,298-306`, `move-to-another-board.spec.ts` (Move flows), `add-repository-combobox.spec.ts:1036-1100`, `names-that-cannot-break.spec.ts:565-575`, `supabase/seed.sql:66-73,436-440`, `public-board-data-access.spec.ts:45-147` (CEO phase), `BoardPageClient.test.tsx:604,627`.

```
CODE PATHS                                                          USER FLOWS
[~] src/proxy.ts                                                    [~] Signed-out visitor opens an old /public/<slug> link
  └── /public/<anything> now falls to the login redirect               └── [★★★ TESTED] redirect to /login — proxy-signed-out-access.test.ts:50 (changed);
      ├── [★★★ TESTED] proxy-signed-out-access.test.ts:50 (changed)         production curl (step 11)
      └── [REMOVED] look-alike cases :105-147 (pass-through gone)     [~] Signed-in user opens another user's board id
[~] actions/repo-cards.ts getUserBoardsWithStatusLists                 └── [★★★ TESTED] "Board not found" + new sentence — board-not-found.spec.ts (changed)
  ├── [★★  TESTED] select 'id, name' — repo-cards.move-destinations   [~] Owner copies the board link
  └── [★★★ TESTED] dialog loads boards — move-to-another-board.spec     ├── [★★★ TESTED] copies <origin>/board/<id> — BoardPageClient.test.tsx (changed)
[~] hooks/board/useMoveDialogState toMoveDialogView default             └── [GAP → ADDED] opened at ?card=<id> still copies without the query
  ├── [★★★ TESTED] picked > remembered > first — unit "opens on the first board"
  └── [★★  TESTED] E2E return dialog expects Test Board (:367)         [~] Owner opens Board Settings
[~] BoardPageClient handleCopyBoardLink                                  ├── [★★★ TESTED] three tabs — BoardSettingsDialog.test.tsx:100 (changed)
  ├── [★★★ TESTED] clipboard + toast                                     └── [★★★ TESTED] 375px, no sideways scroll — board-settings-narrow-viewport.spec (changed)
  ├── [GAP → ADDED] from ?card= address                              [~] Owner adds repositories on a short window
  └── [★★  TESTED] clipboard failure → Sentry + error toast (exists)     ├── [★★  TESTED] whole panel scrolls — add-repository-combobox.spec:938 (re-measured, floor 256px)
[~] BoardSettingsDialog / useBoardSettings (Sharing removed)             └── [★★  TESTED] held list shrinks — :1085 (re-measured)
  └── [★★★ TESTED] remaining tabs and handlers (changed)              [~] Owner moves a card
[~] AddRepositoryCombobox → HeldRepositoryList → MoveHereDialog          └── [★★★ TESTED] move, return, create destination — move-to-another-board.spec (kept)
  └── [★★  TESTED] notice gone; aria-describedby without its id      [~] Owner sees the board grid
[~] BoardCard (Globe removed, span kept)                                 └── [★★★ TESTED] long name does not widen the card — names-that-cannot-break.spec (kept)
  └── [★★★ TESTED] width rule — names-that-cannot-break.spec
[+] migration <version>_remove_public_board.sql                     DATABASE-LEVEL ISOLATION (e2e/unauthenticated/board-data-access.spec.ts)
  ├── [★★★ TESTED] full apply — pnpm db:reset + verification query    ├── [★★★ TESTED] visitor lists nothing from board/statuslist/repocard (moved, unfiltered)
  ├── [★★  TESTED] CI E2E job applies all with pinned CLI 2.120.0     ├── [GAP → ADDED] visitor cannot insert into board
  ├── [GAP] second run / partial state (early return) — db:reset       ├── [★★★ TESTED] other user's board/columns/cards unreadable (moved)
  │        runs each file once; DEFERRED, see below                    ├── [~] write case: rename board, reorder card, delete card (moved)
  └── [GAP] self-check raise paths — DEFERRED, see below               │    └── [GAP → ADDED] delete board, rename/delete column, read back every tried field
[−] src/app/public/[slug]/**, actions/public-board.ts,                └── [~] owner reads own board
    to-public-board-url.ts and their tests — deleted                       └── [GAP → ADDED] owner reads own columns and cards

COVERAGE (changed or new paths): 24 paths, 18 tested (★★★ 13, ★★ 5), 6 gaps: 4 added to the plan, 2 deferred
QUALITY: ★★★ 13  ★★ 5  ★ 0      E2E kept for: tabs at 375px, short windows, Move, isolation (database level)
```

Gap decisions (auto-decided, logged in the audit trail):

- Copy Link from a `?card=` address: add a unit case (P1, a one-line regression the fix exists for).
- Visitor insert into `board`; other user's board delete, column rename and delete with read-back; owner reads columns and cards: add to the moved spec (P1, P2: the Success line names them; `anon` holds the table grants; each is a few lines in a spec that already signs in as both users).
- Second run and partial state of the migration: deferred. `pnpm db:reset` applies each file once; a rehearsal of the early return needs a hand-run of the DO block against a database where the change already ran. Covered by reading (the early return and the `IF EXISTS` counts) and by the production verification query after the run. The block is idempotent by construction (`DROP ... IF EXISTS`). P3: a one-time migration does not earn a harness.
- The self-check raise paths: deferred for the same reason; they raise only on a state the verification query would also report. A dry run is possible on the PR B branch by applying the migration to a database where a test function names `is_public` (create it, run, expect the `remove_public_board:` message, drop it); it is listed as an optional step of the PR B gate, not a required one.
- Regression rule: the changed behaviors (Copy Link address, Move default, the `/public/*` redirect) each have a changed or added test above, so no separate regression test is owed.
- Evals: no prompt or LLM change; none.

Test plan artifact: `~/.gstack/projects/laststance-gitbox/ryotamurakami-chore-remove-public-board-eng-review-test-plan-20261016-205511.md`.

#### Section 4. Performance

- N+1: none added or removed; `getUserBoardsWithStatusLists` loses one column of a select that is already one query with an embedded relation.
- Memory and payload: the board list and Board Settings ship less JavaScript (the Sharing panel, `to-public-board-url`, Globe icon use); the public route and its rate-limit bucket leave the server.
- Database: `ALTER TABLE ... DROP COLUMN` takes an `ACCESS EXCLUSIVE` lock on `board` for a catalog change (no rewrite; 6 rows); `lock_timeout` 5s bounds the wait; `idx_board_share_slug` drops with its column.
- Caching: none involved. Slow paths: none.

No findings.

#### Failure modes

| Codepath                         | Failure                                   | Test?                | Handled?                                                           | User sees                            | Critical gap?                       |
| -------------------------------- | ----------------------------------------- | -------------------- | ------------------------------------------------------------------ | ------------------------------------ | ----------------------------------- |
| PR B `db push`                   | version sorts before an applied one       | no (CI resets fresh) | yes: version check before merge, rename branch                     | nothing (workflow red)               | no (was critical before this phase) |
| PR B migration                   | `lock_timeout` / deadlock                 | no                   | yes: one `gh run rerun`, then issue                                | nothing                              | no                                  |
| PR B migration                   | dependent object / self-check raise       | no (deferred)        | yes: rolled back, amend the same file                              | nothing                              | no                                  |
| PR B migration run               | stalls                                    | no                   | yes: 20-minute poll deadline, issue, no retry                      | nothing                              | no                                  |
| old tab after PR A (skew window) | old server actions                        | no                   | yes: PR B waits 12 hours                                           | old Sharing switch still works there | no                                  |
| old tab after the window         | unrecognized action on the Sharing switch | no                   | partly: switch stays, no message; reload fixes                     | no feedback once                     | no (old client cannot change)       |
| concurrent merge to `main`       | reintroduces a removed name               | CI on `main`         | yes: rebase before merge, scan open PR diffs, Test on merge commit | nothing on production (deploy fails) | no                                  |
| shared local stack               | another checkout resets it mid-run        | no                   | yes: process check before every reset, wait, stop                  | flaky local E2E                      | no                                  |
| Copy Link                        | clipboard denied                          | yes (unit)           | yes: Sentry + error toast                                          | "Failed to copy link"                | no                                  |
| `/public/*` signed in            | no route                                  | no                   | yes: root 404                                                      | 404 page                             | no                                  |

Critical gaps after this phase: 0.

#### NOT in scope

- Bringing board sharing back in a safer form: #257 holds its requirements.
- The privacy policy's "Public repository names" line: #254.
- A lock that every E2E entry point respects on the shared local stack: #261 (comment added with the evidence of C3).
- A CI check of `anon_definer_functions`: TODOS.md entry (PR A's docs commit).
- A harness for the migration's second run and its raise paths: deferred, see Section 3.
- Returning to the board after sign-in (#258) and the settings tabs' arrow-key navigation (#259).

#### What already exists

- The proxy's login redirect (`src/proxy.ts:149-156`) answers `/public/*` once its exception goes; nothing new is written for it.
- `toMoveButtonDescription` keeps its failure id; only the shared part goes.
- The four isolation cases and their two-client setup (`public-board-data-access.spec.ts:45-147`) are moved and extended, not rewritten.
- `20261011030000_public_board_by_slug_only.sql:50-152` is the template for the DO block, `lock_timeout` and the header.
- The Vercel deployment lookup, the poll cadence and the issue-on-stop rule of the DX phase are reused for the migration run.

#### Worktree parallelization

Sequential implementation, no parallelization opportunity: PR A's lanes (server, client, tests, docs) all touch `types.ts` or the components the tests import, and PR B depends on PR A being live. Within PR A, docs (commit b) can be written while E2E runs, which is how step 1's order already uses the wait.

#### TODOS.md updates (collected from every phase)

- Delete five sharing-only entries; reword the ones that mention sharing (CEO, DX).
- Repoint "Show the fetched board name…" to `adoptedComments` of `useCommentState` (DX).
- Add "Check in CI that no `SECURITY DEFINER` function is executable by `anon`", run against the `postgres` database after `supabase db reset`, excluding trigger and event-trigger functions (CEO, amended here by N10).
- Deferred scope that became issues instead of TODOs: #254, #257, #258, #259, #261 (CEO, Design, DX).

#### Completion summary

```
+====================================================================+
|            ENG REVIEW — COMPLETION SUMMARY (/autoplan)              |
+====================================================================+
| Step 0               | scope accepted as-is (FULL_REVIEW), A auto    |
| Architecture         | 4 issues (N1, N2, N3, C2), all applied        |
| Code quality         | 2 issues (N6, N11), applied                   |
| Test review          | diagram produced, 6 gaps: 4 added, 2 deferred |
| Performance          | 0 issues                                      |
| NOT in scope         | written (6 items)                             |
| What already exists  | written (5 items)                             |
| TODOS.md updates     | 1 added, 5 deleted, rest reworded (all phases)|
| Failure modes        | 10 rows, 0 critical gaps                      |
| Outside voice        | Codex ran (4 Medium), native ran (12)         |
| Parallelization      | sequential                                    |
| Lake score           | 9/10 recommendations chose complete option    |
| unverified           | 0                                             |
+====================================================================+
```

Lake score: the two deferred test gaps (second run and raise paths of a one-time migration) took the shortcut, for the reason in Section 3; every other decision took the complete option.

<!-- autoplan-accepted:eng -->

- PR B's migration version is the JST time (`TZ=Asia/Tokyo date +%Y%m%d%H%M%S`) when its branch is created, never `supabase migration new` (UTC); right before the merge it must sort after production's `max(version)` of `supabase_migrations.schema_migrations`, the newest file on `origin/main` and the newest migration file of every open PR (#260 has `20261016191000`), else it is renamed first. A refusal as older than the last applied version is fixed by a rename in a new commit on `main`.
- The migration's self-check `DETAIL` says the migration is not recorded as applied and tells the operator to change this same file in a new commit, run `pnpm db:reset` and push again; any non-transient failure first confirms the version is absent from production's `schema_migrations`.
- Function-body matches use `strpos(p.prosrc, '…') > 0`, not `ILIKE`, in the migration, the verification query and the step 5 audit; `anon_definer_functions` excludes `trigger` and `event_trigger` return types.
- PR A starts from `origin/main` as fetched at implementation start (`aad85ac` on 2026-10-16); right before each merge: fetch, rebase on `origin/main`, the Success grep, `pnpm typecheck`, CI again, new grep output in the body. After PR A merges, every open PR's diff is searched for the removed names and a hit gets a comment; the Test workflow of PR A's merge commit is green before PR B is opened.
- PR B merges only after PR A's production deployment has been Ready for `skewProtectionMaxAge` (43200 s, 12 h on 2026-10-16, read again at step 9); when the session cannot wait, PR B stays open and green with the earliest merge time (JST) in its body, a GitHub issue records steps 9 to 11, and the final report says the database step is pending.
- The migration run is read with `gh run view <databaseId> --json status,conclusion,url` every 15 s for at most 20 min (no `gh run watch`); at the deadline the outcome is unknown, nothing is retried, and an issue records the run.
- The preflight's shared-stack check adds `pgrep -fl 'playwright test|e2e-parallel|e2e-setup-databases|supabase db reset'` to `docker ps`, runs again right before every reset, E2E run and screenshot run, and waits (60 s reads, 60 min deadline) while another checkout is busy, then stops and reports.
- The moved isolation cases are extended: the other user's board delete and a column rename and delete are refused, with service-role read-back of every field tried (the card's `order` too); the owner reads columns and cards; a new case: a visitor cannot insert into `board`.
- Copy Link copies `${window.location.origin}/board/${boardId}`; `BoardPageClient.test.tsx` adds a case that starts from `/board/<id>?card=<cardId>`.
- `add-repository-combobox.spec.ts:1085` is re-measured like `:938`; the comments at `:1042` and `names-that-cannot-break.spec.ts:570` follow the wording rule.
- PR A's gate adds a non-gating `git grep -n -i -w -E 'sharing|globe|shared'` pass, each line triaged in the PR body.
- The TODOS.md CI-check entry says it runs against the `postgres` database after `supabase db reset`, not a shard (`pg_dump --no-privileges`), and excludes trigger and event-trigger functions.
- Before screenshots are taken at the commit PR A starts from, not `fae230d`.

<!-- /autoplan-accepted:eng -->

<!-- autoplan-baseline-edits:eng {"sourceSha256":"1b2c6535e376f7584e89756e91534d8f81f25fad500eb4125df15c9d3ab3a994","replacements":[{"oldText":"### 1. Migration `supabase/migrations/20261016190000_remove_public_board.sql`\n\nSorts after `20261016181500`, the newest migration. It ships alone in PR B, after PR A's production deployment is Ready (section 6).","newText":"### 1. Migration `supabase/migrations/<version>_remove_public_board.sql`\n\nThe version is chosen when PR B's branch is created, not now. The repository names migrations by Japan time (`20261016181500` was committed at 18:18 JST), so the version is `TZ=Asia/Tokyo date +%Y%m%d%H%M%S` at that moment; `supabase migration new` names by UTC and would sort before the versions already applied. Right before PR B's merge the version must sort after the newest version applied on production (`SELECT max(version) FROM supabase_migrations.schema_migrations`: `20261016181500` on 2026-10-16), the newest file on `origin/main` and the newest migration file of every open PR (`20261016191000` of #260 on 2026-10-16); otherwise the file is renamed first, because `supabase db push` refuses a version older than the last one applied. It ships alone in PR B, after PR A's production deployment is Ready and the skew window of section 6 has passed."},{"oldText":"no function in schema `public` has `is_public` or `share_slug` in its body. Each check raises its own message","newText":"no function in schema `public` has `is_public` or `share_slug` in its body (matched with `strpos(p.prosrc, ...) > 0`, not `ILIKE`: `_` is a one-character wildcard in a pattern, so `ILIKE '%is_public%'` also matches \"is public\" in a comment). Each check raises its own message"},{"oldText":"\"Nothing was changed (one transaction). Find what still uses it and drop that in a new migration on main.\"","newText":"\"Nothing was changed (one transaction), and this migration is not recorded as applied. Change this migration file in a new commit on main so it handles what still uses it, run pnpm db:reset, and push again; a later migration cannot run before this one.\""},{"oldText":"so a green CI is the run on the production CLI.","newText":"so a green CI is the run on the production CLI. A local `pnpm db:reset` uses the local CLI (2.121.0 on 2026-10-16), so it is a rehearsal of the SQL, not of the pinned CLI."},{"oldText":"      AND (p.prosrc ILIKE '%is_public%' OR p.prosrc ILIKE '%share_slug%')) AS functions_naming_columns,","newText":"      AND (strpos(p.prosrc, 'is_public') > 0 OR strpos(p.prosrc, 'share_slug') > 0)) AS functions_naming_columns,"},{"oldText":"      AND p.prorettype <> 'trigger'::regtype\n","newText":"      AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)\n"},{"oldText":"- `BoardPageClient`: Copy Link copies `window.location.href` and its toast","newText":"- `BoardPageClient`: Copy Link copies `${window.location.origin}/board/${boardId}`, the board's own address without a query (`?card=<id>` of `linked-card.ts` stays in the address bar after a card is revealed, and `window.location.href` would copy it), and its toast"},{"oldText":"so row level security is all that stands between a visitor and the rows.","newText":"so row level security is all that stands between a visitor and the rows. The moved cases are extended to prove the Success line they back: the write case also tries to delete the other user's board and to rename and delete one of its columns, and checks with the service-role client that the board, the column and the card are still there and that every field it tried to change (the card's `order` too, not only `repo_name`) kept its value; the owner case reads the owner's columns and cards as well as the board; one new case: a visitor without an account cannot insert a row into `board`."},{"oldText":"  - `move-to-another-board.spec.ts`: delete the shared-destination case.","newText":"  - `move-to-another-board.spec.ts`: delete the shared-destination case (line 516). Its other cases pick Work Projects by hand, and the return dialog at line 367 expects Test Board, the only other board, so the new default changes none of them."},{"oldText":"The comment at `AddRepositoryCombobox.tsx:504-510` says that 26rem was measured with the notice, which is gone, and stays so the 416px measurement and the panel's position do not change.","newText":"The comment at `AddRepositoryCombobox.tsx:504-510` says that 26rem was measured with the notice, which is gone, and stays so the 416px measurement and the panel's position do not change.\n  - `add-repository-combobox.spec.ts:1085` (\"keeps the search box and the Cancel / Add row in view on a short window with repositories placed elsewhere\"): its numbers (a 560px window leaves the panel 473px, about 80px short) were taken with the notice on screen. It is re-measured the same way as `:938`: the window is lowered until the held list must give up height again, its assertion that the list stays under 184px holds there, and the comment gives the new numbers. The comments at `:1042` (\"416px … on a shared board\") and `names-that-cannot-break.spec.ts:570` (\"the four tabs\") change with the wording rule."},{"oldText":"  - `BoardPageClient.test.tsx`: Copy Link copies the page address and its toast says only the owner can open it; the public-link cases go.","newText":"  - `BoardPageClient.test.tsx` (cases at lines 604 and 627): Copy Link copies `<origin>/board/<id>` and its toast says only the owner can open it, also when the page was opened at `/board/<id>?card=<cardId>`; the public-link cases go."},{"oldText":"- New tests: none beyond the changed and moved cases.","newText":"- New tests: the extensions of the moved isolation cases and the signed-out insert case (above), the Copy Link case that starts from a `?card=<id>` address, and nothing else."},{"oldText":"(the verification query's `anon_definer_functions` run against the database of the E2E job; today every new function has its `REVOKE` written by hand)","newText":"(the verification query's `anon_definer_functions`, run in the E2E job against the `postgres` database after `supabase db reset`, not against a shard: shards are cloned with `pg_dump --no-privileges`, so every function there looks executable by `PUBLIC`; trigger and event-trigger functions are excluded; today every new function has its `REVOKE` written by hand)"},{"oldText":"no other checkout runs E2E against the shared local stack (`docker ps` shows no shard container; stop otherwise: the stack, its ports and the shard names are shared, #261);","newText":"no other checkout uses the shared local stack: `docker ps` shows no shard container and `pgrep -fl 'playwright test|e2e-parallel|e2e-setup-databases|supabase db reset'` shows no process of another checkout (a plain Playwright run resets the database in `e2e/global-setup.ts` without any shard container, and `e2e-parallel.sh` resets before it creates them). This check runs again right before every reset, E2E run and screenshot run, not once; while another checkout is busy the run waits, reading every 60 seconds for at most 60 minutes, then stops and reports. A lock that both entry points respect stays in #261; Vercel Skew Protection is read from the project API (`skewProtectionMaxAge`: 43200 seconds, 12 hours, on 2026-10-16) for step 9;"},{"oldText":"and `pnpm knip` against `main`. PR A's database keeps","newText":"and `pnpm knip` against `main`, plus one pass that does not gate: `git grep -n -i -w -E 'sharing|globe|shared'` over the same paths, each line triaged in PR A's body as kept (not about board sharing) or changed. PR A's database keeps"},{"oldText":"in this worktree at `fae230d` before any change, after `pnpm db:reset`","newText":"in this worktree at the commit PR A starts from (`origin/main`, step 5) before any change, after `pnpm db:reset`"},{"oldText":"5. Before each merge: rebase on `main` if anything merged after the branch started (PR A starts from `fae230d`, after PR #253 merged); after a rebase the `git grep` of Success and CI run again, and the PR body gets the new grep output.","newText":"5. PR A starts from `origin/main` as fetched when the implementation starts (`aad85ac` on 2026-10-16, two merges past `fae230d`): other runs merge to `main` meanwhile, and nothing requires a branch to be up to date before it merges. Right before each merge: fetch, rebase on `origin/main`, run the `git grep` of Success and `pnpm typecheck`, let CI run again, and put the new grep output into the PR body. After PR A merges, the diff of every open PR is searched for the removed names (`gh pr diff <n> | rg -i 'isPublic|is_public|toggleBoardPublic|isBoardShared|share_slug|publicShareSlug'`), and a PR with a hit gets a comment naming the lines (PR #260 edits `types.ts`, `board-data.ts` and `TODOS.md` too). The Test workflow run of PR A's merge commit (`push` to `main`) must be green before PR B is opened."},{"oldText":"AND (p.prosrc ILIKE '%is_public%' OR p.prosrc ILIKE '%share_slug%')`. Expected:","newText":"AND (strpos(p.prosrc, 'is_public') > 0 OR strpos(p.prosrc, 'share_slug') > 0)`. Expected:"},{"oldText":"9. Open PR B from `main`, CI green, production audit of step 5, then merge PR B.","newText":"9. Open PR B from `main` and get CI green. PR B merges only after PR A's production deployment has been Ready for `skewProtectionMaxAge` seconds (43200, 12 hours, on 2026-10-16; read again from the project API at this step): Vercel Skew Protection serves a tab opened before PR A from the old build's server actions and server components for that long, and the old build selects `is_public`. When the session cannot wait so long, PR B stays open and green with the earliest merge time (JST) in its body, a GitHub issue records steps 9 to 11 as the remaining work, and the final report says the database step is pending. At merge time: the production audit of step 5, the version check of section 1, then merge PR B."},{"oldText":"keep its `databaseId`, and `gh run watch <databaseId> --exit-status` waits for it to finish green.","newText":"keep its `databaseId`, and read `gh run view <databaseId> --json status,conclusion,url` every 15 seconds for at most 20 minutes (`gh run watch` has no deadline). `completed` with `success` goes on; any other conclusion follows \"When the migration run fails\" below; at the deadline the outcome is unknown: the run stops, nothing is retried, and a GitHub issue records the run URL and its last state."},{"oldText":"No mixed window: PR B merges only after PR A's production deployment is Ready (steps 6 to 9), and PR A's build works on both schemas.","newText":"No mixed window: PR B merges only after PR A's production deployment is Ready and the skew window of step 9 has passed (steps 6 to 9), and PR A's build works on both schemas."},{"oldText":"A tab opened before the deployment keeps the old client until it is reloaded. Its Sharing switch then calls a server action the new build no longer has: Next.js answers","newText":"A tab opened before the deployment keeps the old client until it is reloaded, and Skew Protection sends its server actions to the old build for up to 12 hours; there its Sharing switch still writes the columns, which still exist, and a link made then opens nothing, because every page load goes to the new build (the audit of step 5 counts such a share before PR B). After the window its Sharing switch calls a server action the new build no longer has: Next.js answers"},{"oldText":"On `lock_timeout` or a deadlock, run the same run again once with `gh run rerun <databaseId>` (it keeps the event and the sha, so the poll of step 9 still finds it) and `gh run watch <databaseId> --exit-status`; a second failure stops the run, and a GitHub issue records it. On any other error, fix the same migration file in a new commit on `main`.","newText":"On `lock_timeout` or a deadlock, once its conclusion is `failure`, run the same run again once with `gh run rerun <databaseId>` (it keeps the event and the sha, so the poll of step 9 still finds it) and read it as step 9 does; a second failure stops the run, and a GitHub issue records it. When the CLI refuses the file as older than the last applied version, nothing ran: rename the file to a version that sorts after the remote maximum (section 1) in a new commit on `main`, and its push run applies it. On any other error, first confirm that the version is not in production's `supabase_migrations.schema_migrations`, then change the same migration file in a new commit on `main` (a later migration cannot run before it), rehearse with `pnpm db:reset`, and its push run applies it."}]} -->

#### CEO phase record

The record below holds every replacement the CEO phase made to the implementation plan, bound to the checkpoint's source sha `2a9977c2…`: C1's rollout (later replaced by the two-PR rollout of the dual voices), the fixes of spec launches 1 to 3 (S, T, U) and the voices' fixes (N, X). The accepted block after it lists the CEO phase's requirements; the design block above supersedes its README and CHANGELOG wording.

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"2a9977c234cd5bd235f3dd0941918c9f25b8d569b9971f2b4c454dcc28e7665f","replacements":[{"oldText":"- `git grep -n -i -E 'is_public|share_slug|get_public_board|public[ _-]?board|publicBoard|isPublic|shareSlug|share link|shared board|public link|isBoardShared|publicShareSlug|PUBLIC_BOARD|/public/\\[slug\\]|/public/<slug>' -- src e2e mocks scripts supabase/seed.sql .storybook README.md CLAUDE.md SPEC.md TODOS.md` returns no lines.","newText":"- `git grep -n -i -E 'is_public|share_slug|get_public_board|public[ _-]?board|publicBoard|isPublic|shareSlug|share link|shared board|public link|isBoardShared|publicShareSlug|PUBLIC_BOARD|/public/\\[slug\\]|/public/<slug>|tab-sharing|panel-sharing|public sharing|name and globe|whose globe|board that is not shared|share slug|shareLink|the public page|its public page|even when public|four tabs|4-tab' -- src e2e mocks scripts supabase/seed.sql .storybook README.md CLAUDE.md SPEC.md TODOS.md` returns no lines. (A bare `not shared` would also match `src/lib/rate-limit/memory.ts:5`, which is about server instances, so the pattern names the board. A comment that wraps between two words of a phrase escapes the grep; section 4 names the ones found.)"},{"oldText":"comments in `add-repository-combobox.spec.ts` and `column-color-data-access.spec.ts`;","newText":"comments in `add-repository-combobox.spec.ts`, `column-color-data-access.spec.ts`, `names-that-cannot-break.spec.ts` (lines 344 and 348: a shared board and its globe) and `src/tests/unit/lib/validations/board.test.ts` (line 251: the shared page);"},{"oldText":"Sorts after `20261016181500`, the newest migration. One `DO` block, `lock_timeout` 5s.","newText":"Sorts after `20261016181500`, the newest migration. It ships alone in PR B, after PR A's production deployment is Ready (section 6). One `DO` block; `lock_timeout` 5s through `PERFORM set_config('lock_timeout', '5s', true)`, as `20261011030000` does. The header comment states the fix-forward rule of section 6."},{"oldText":"3. `REVOKE` and `DROP FUNCTION IF EXISTS public.get_public_board(text)`.","newText":"3. `DROP FUNCTION IF EXISTS public.get_public_board(text)`. No `REVOKE` before it: `REVOKE` has no `IF EXISTS`, so it would fail when the function is gone and a column is not, and dropping the function removes its grants."},{"oldText":"  - `board-settings-narrow-viewport.spec.ts`: tabs General, Cards, Danger Zone.","newText":"  - `board-settings-narrow-viewport.spec.ts`: tabs General, Cards, Danger Zone; its header (line 4) and the test names and values (lines 25 and 26) say three tabs. `BoardSettingsDialog.test.tsx:100` (\"should display all four tabs\") checks the three.\n  - `names-that-cannot-break.spec.ts`: the comments at lines 344 and 348 stop naming a shared board and its globe; the measurements stay. `src/tests/unit/lib/validations/board.test.ts`: the comment at line 251 stops naming the shared page; the case stays.\n  - Comments that wrap across lines, which the grep cannot see: the header of `column-color-data-access.spec.ts` (lines 8 and 9, \"on a shared board the server prints it into the page a visitor loads\") says the color is printed into a style attribute of the owner's own page; `one-repo-across-boards.spec.ts:602-603` (\"even when it is public\") loses that clause; `add-repository-combobox.spec.ts:943` and `src/components/Board/AddRepositoryCombobox.tsx:509` stop listing the notice of a shared board among what the panel holds. The 26rem least height of the panel and the 416px measurement stay: the panel's height comes from its position, not from its content.\n  - `add-repository-combobox.spec.ts:938` (\"scrolls the whole panel on a window too short for a row of the list\"): the seed's Test Board was public, so the notice was on screen in every E2E run and counted into the overflow this case needs. Without it the content may fit the 276px panel of a 300px window. The case keeps its claim: its window is lowered until the panel without the notice still cannot hold the search box, the filters, one row of the list and the buttons, its comment carries the measured numbers, and it runs in step 1 of section 6."},{"oldText":"  - `proxy-signed-out-access.test.ts`: drop the `/public/<slug>` cases.","newText":"  - `proxy-signed-out-access.test.ts`: the case that let `/public/a1b2c3d4e5f6` through (line 50) now expects a redirect to `/login`; it is the only automated proof of the third line of Success, because E2E test mode skips the session check (`CLAUDE.md`, \"Signed-out access\"). The three look-alike cases (`/public/`, `/publicity`, `/public/<slug>/edit`, lines 105 to 147) go: they guarded the edges of a pass-through that no longer exists. The file header stops describing shared links."},{"oldText":"- `CLAUDE.md`: route tree, `board` schema line,","newText":"- `CLAUDE.md`: route tree, \"Names that cannot break\" (line 567: `max-w-[calc(100%+4rem)]` on \"the box of name and globe\" becomes the box of the name), \"Client Components rendered by Server Components\" (its example of a render-time reset, `shareLink` in `useBoardSettings`, becomes `adoptedComments` in `useCommentState`, `src/hooks/board/useCommentState.ts:77`), `board` schema line,"},{"oldText":"- `CHANGELOG.md` and `VERSION` through `/ship`. History stays in `CHANGELOG.md`, `docs/plans/` and old migrations, which are not edited.","newText":"- `CHANGELOG.md` and `VERSION` through `/ship`. The entry says that public board links are gone and that a board opens for its owner only. History stays in `CHANGELOG.md`, `docs/plans/`, `docs/designs/` and old migrations, which are not edited."},{"oldText":"4. `/review`, `/ship` (CI on the PR). Commits: (a) removal from client and server with tests, stories and fixtures; (b) the migration with `types.ts` and the seed; (c) docs. Each passes `pnpm typecheck`.","newText":"4. Two PRs. PR A (`chore/remove-public-board`) holds everything but the migration file: client, server, `types.ts`, tests, stories, fixtures, `supabase/seed.sql` and docs. Its merge touches no path that starts `supabase-production.yml` (`supabase/migrations/**`, `supabase/config.toml`, the workflow file), so it runs no migration, and the two columns and the function stay in the database, read by nothing. PR B (`chore/drop-public-board-columns`, from `main` after PR A merged) holds the migration file only. Commits of PR A: (a) removal from client and server with tests, stories, fixtures and the `types.ts` edit (the fixtures are typed `Tables<'board'>`, whose `Row` lists the two columns, so the type and the fixtures change together); (b) the seed; (c) docs. Each passes `pnpm typecheck`. `/review` and `/ship` for each PR (CI on the PR). Before PR A is marked ready, the `git grep` of Success runs and its output (expected: no lines) goes into the PR body, with a link to #254 and #257 (found during the review; the body must not put close, fix or resolve in front of a number). PR B's CI applies every migration with the pinned CLI, which is the rehearsal on the production CLI."},{"oldText":"5. Right before the merge: the production audit query again (public boards, slugs, functions naming the columns, board count). Rebase on `main` if PR #253 (it rewords the shared-board notices this PR deletes) merged first.","newText":"5. Before each merge: rebase on `main` if anything merged after the branch started (PR A starts from `fae230d`, after PR #253 merged); after a rebase the `git grep` of Success and CI run again, and the PR body gets the new grep output. Before PR B's merge, also the production audit, with `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp \"<sql>\"` (works from any directory; `--project-ref` alone is refused): `SELECT count(*) FILTER (WHERE is_public) AS public_boards, count(*) FILTER (WHERE share_slug IS NOT NULL) AS boards_with_slug, count(*) AS boards FROM board` and `SELECT count(*) AS functions_naming_columns FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (p.prosrc ILIKE '%is_public%' OR p.prosrc ILIKE '%share_slug%')`. Expected: 0, 0, the board count (6 on 2026-10-16), and 1 (`get_public_board`). A public board found here is reported in PR B and the final report (its count and whether it is the owner's board or the other account's, never its slug), and the merge goes on: the owner asked for the removal, and the share ends with it."},{"oldText":"6. Merge. The merge runs `supabase db push` on production at once, and Vercel deploys.\n7. Wait for the `Supabase Production Migration` run of the merge commit to finish green; run the verification query on production.\n8. Wait for the Vercel production deployment of the merge commit.\n9. Production check as `ryota-murakami`: Board Settings has three tabs; Copy Link; Move to Another Board between two scratch boards (deleted afterwards); signed-out `/public/<slug>` redirects to `/login`.","newText":"6. Merge PR A. No migration runs. Confirm with `gh run list --workflow supabase-production.yml -L1 --json headSha`: no run for PR A's merge sha.\n7. Wait for the Vercel production deployment of PR A's merge commit to be Ready. Poll `gh api \"repos/laststance/gitbox/deployments?sha=<full 40-character merge sha>&environment=production\" --jq '[.[] | select(.creator.login == \"vercel[bot]\")][0].id'` until it prints an id (the filter ignores case, and the migration workflow's job writes `production` records of its own as `ryota-murakami`; Vercel's are `Production` by `vercel[bot]`), then poll `gh api repos/laststance/gitbox/deployments/<id>/statuses --jq '.[0].state'` until it prints `success`. The new build runs on the old schema: it names neither column nor the function.\n8. Production check of PR A as `ryota-murakami`: Board Settings has three tabs; Copy Link copies the board address; Move to Another Board between two scratch boards (deleted afterwards); signed-out `/public/a1b2c3d4e5f6` redirects to `/login`. Sentry: the issues of the first hour after the deployment, if the session can reach Sentry; otherwise reported as not checked.\n9. Open PR B from `main`, CI green, production audit of step 5, then merge PR B. The `push` run of `supabase-production.yml` applies the migration: poll `gh run list --workflow supabase-production.yml --event push -L1 --json databaseId,headSha,createdAt,status` until `headSha` is PR B's full merge sha, and `gh run watch <databaseId> --exit-status` waits for it to finish green. Run the verification query on production (`supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp`, as in step 5).\n10. Production check of PR B as `ryota-murakami`: Move to Another Board loads its boards (the reader that named `is_public` is gone since PR A; this shows the live build reads neither column) and the Board Settings dialog opens.\n11. The final report lists both PRs, the migration run, the verification result and the checks of steps 8 and 10, with the board each check used and how many cards it held."},{"oldText":"Known window: the migration finishes within a minute of the merge, the Vercel build takes a few minutes. Until the new build is live, the old build runs on the new schema: Move to Another Board cannot load its boards (its select names `is_public`), the Sharing switch fails with an error toast, a `/public/<slug>` link answers 404 (it did for every slug already: none exists). Boards, cards, drags, notes and board creation keep working: the board page reads `board.*` and the old client treats the missing `is_public` as false. The new build runs on the old schema as well (it names neither column nor the function), so a failed migration leaves the app working. Accepted for 2 users at night; the alternative is two PRs (code first, migration after the deploy).","newText":"No mixed window: PR B merges only after PR A's production deployment is Ready (steps 6 to 9), and PR A's build works on both schemas. The build before PR A never meets the new schema; in one PR it would, for the minutes of the Vercel build, and Move to Another Board could not load its boards then (its select names `is_public`). No workflow is disabled at any point. If the run stops between the two PRs, production is consistent: the code is gone, the two columns and the function stay, and nothing reads them. Until PR B, `get_public_board` stays callable, and an owner could still set `is_public` and `share_slug` on their own board through the API, as today; the function answers for nothing else. If PR A's deployment fails, PR B waits for a fixed deployment of `main`. A tab opened before the deployment keeps the old client until it is reloaded. Its Sharing switch then calls a server action the new build no longer has: Next.js answers with an unrecognized-action error, `handleTogglePublic` (`BoardSettingsDialog.tsx:323-340`) has `try`/`finally` and no `catch`, so the switch stays where it was without a message and the error may reach Sentry. A reload brings the new build. The old client cannot be changed any more, so this needs no code.\n\nRollback. Before PR B, PR A can be rolled back like any change (Vercel Instant Rollback or a revert), because the old build still finds its columns. Fix forward only after PR B: once the migration has run, a rollback to a build before PR A brings back a move dialog that selects `is_public` and fails to load its boards. A rollback to PR A's build stays safe. A defect is fixed by a new commit on `main`. The header of the migration says the same, as `20261011030000` does for its own change."},{"oldText":"2. Count the boards that are public and the boards that have a slug. `RAISE NOTICE` with the two counts (counts only; the CLI may not print it and no step depends on it). The migration does not refuse when a board is shared: removing the share is the change.","newText":"2. Count the boards that are public and the boards that have a slug, each only while its column exists (`IF EXISTS` on `information_schema.columns`, the count through `EXECUTE`), so a run on a partial state does not fail on the missing column. `RAISE NOTICE` with the two counts (counts only; the CLI may not print it and no step depends on it). The migration does not refuse when a board is shared: removing the share is the change."},{"oldText":"  - `board-not-found.spec.ts`: the other user's board is opened by its id and shows \"Board not found\"; the assertion on the public-link sentence goes.","newText":"  - `board-not-found.spec.ts`: the other user's board is opened by its id and shows \"Board not found\"; the assertion on the public-link sentence goes. Its check that the board's name is not shown (line 70) asks for \"Other User Board\", the seed's new name, so it still checks something."},{"oldText":"the `shareLink` example of \"Client Components rendered by Server Components\" (point at another render-time reset or drop the pointer), ","newText":""},{"oldText":"; in the others drop the sharing parts and keep the rest.","newText":"; in the others drop the sharing parts and keep the rest. \"Show the fetched board name, subtitle and card display settings after a refetch\" (lines 256 and 260) takes `shareLink` of `useBoardSettings` as its pattern; it takes `adoptedComments` of `useCommentState` instead. One entry is added: \"Check in CI that no `SECURITY DEFINER` function is executable by `anon`\" (the verification query's `anon_definer_functions` run against the database of the E2E job; today every new function has its `REVOKE` written by hand)."},{"oldText":"- Comments: `constants/board-bundle.ts` (the second reader of the card columns), `board-data.ts` (why a foreign board is not found).","newText":"- Comments: `constants/board-bundle.ts` (the second reader of the card columns), `board-data.ts` (line 164, \"even when public\", and line 205: why a foreign board is not found), `validations/repo-card.ts` (lines 23 and 41: the fields are rendered on the card; \"the public page\" goes)."},{"oldText":"Three tabs remain: General, Cards, Danger Zone. The tab row keeps `flex-wrap`.","newText":"Three tabs remain: General, Cards, Danger Zone. The tab row keeps `flex-wrap`, and its comment (line 486), which gives four tabs as the reason, speaks of the tabs without a count."},{"oldText":"- `rate-limit/config.ts`: drop `publicBoardView` (and the \"Public: Unauthenticated endpoints\" heading when nothing else is under it).","newText":"- `rate-limit/config.ts`: drop `publicBoardView`. The \"Public: Unauthenticated endpoints\" heading stays: `sentryTunnel` is under it."},{"oldText":"- Editing old migrations, `CHANGELOG.md` entries or `docs/plans/2026-*.md` (history).","newText":"- Editing old migrations, `CHANGELOG.md` entries, `docs/plans/2026-*.md` or `docs/designs/*.md` (history: `docs/designs/issue-216-repository-memory.md` names shared boards and `get_public_board` as they were when it was written; the Success grep leaves `docs/` out for that reason)."},{"oldText":"- The `statuslist_color_hex` check: it stays; the color is still printed into a style attribute.","newText":"- The `statuslist_color_hex` check: it stays; the color is still printed into a style attribute.\n- The privacy policy's wording about which repositories are stored (`src/app/privacy/page.tsx:62`): found during the review, filed as #254, not part of this change.\n- Sharing in another form (a snapshot the owner generates, an export, a demo board on the landing page): what a later version needs is kept in #257.\n\n## Requirements added in review\n\nAccepted during the review. Each one is also written into the section it governs."},{"oldText":"Nobody uses it: on production 0 of 6 boards are public and 0 have a share slug (count-only query, 2026-10-16).","newText":"Removing it breaks no working link: on production 0 of 6 boards are public and 0 have a share slug (count-only query, 2026-10-16). With 2 users that says nothing about demand. The reason for the removal is the cost above, paid for a feature the owner no longer wants to carry; what a later version would need is kept in #257."},{"oldText":"- Board Settings has three tabs (General, Cards, Danger Zone). Copy Link copies the board's own address. Move to Another Board and Add Repositories show no sharing notice.","newText":"- Board Settings has three tabs (General, Cards, Danger Zone). Copy Link copies the board's own address. Move to Another Board and Add Repositories show no sharing notice.\n- The tenant-isolation cases still run, from `e2e/unauthenticated/board-data-access.spec.ts`: a visitor without an account lists nothing from `board`, `statuslist` or `repocard`; a signed-in user can neither read, change nor delete another user's board, columns or cards; the owner reads their own.\n- After PR B no `SECURITY DEFINER` function in schema `public` that is not a trigger can be executed by `anon` (the verification query's `anon_definer_functions` is 0; on 2026-10-16 it is 1, `get_public_board`)."},{"oldText":"  (SELECT count(*) FROM board) AS boards;\n```","newText":"  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace\n    WHERE n.nspname = 'public' AND p.prosecdef\n      AND p.prorettype <> 'trigger'::regtype\n      AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_definer_functions,\n  (SELECT count(*) FROM board) AS boards;\n```"},{"oldText":"Expected: `true`, `true`, `true`, `0`, and on production the board count of the audit right before the merge.","newText":"Expected: `true`, `true`, `true`, `0`, `0`, and on production the board count of the audit right before PR B's merge."},{"oldText":"No reverse migration: there is no data to bring back (0 public boards), and the code that read the columns is gone in the same PR.","newText":"No reverse migration: there is no data to bring back (0 public boards), and the code that read the columns is gone since PR A, which ships first."},{"oldText":"remove `is_public` and `share_slug` from `board` Row/Insert/Update and the `get_public_board` function entry.","newText":"remove `is_public` and `share_slug` from `board` Row/Insert/Update and the `get_public_board` function entry. The edit ships in PR A: the columns that stay in the database until PR B do the code no harm."},{"oldText":"- Delete: `e2e/unauthenticated/public-board.spec.ts`, `public-board-happy-path.spec.ts`, `public-board-data-access.spec.ts`;","newText":"- Delete: `e2e/unauthenticated/public-board.spec.ts`, `public-board-happy-path.spec.ts`, `public-board-data-access.spec.ts` (after its four tenant-isolation cases moved, below);"},{"oldText":"- Change, keeping every case that tests behavior that stays:","newText":"- Move: the four cases of `public-board-data-access.spec.ts` that test who can reach a board (lines 45, 66, 93 and 133: a visitor without an account lists nothing from the three tables; a signed-in user cannot read another user's board, columns or cards, nor change or delete them; the owner still reads their own) go to `e2e/unauthenticated/board-data-access.spec.ts`. The visitor's query reads the whole `board` table without the `.eq('is_public', true)` filter, which checks more than before; names and comments say \"board\" for \"public board\"; a board name read back is \"Other User Board\". The share-link cases (line 148 to the end) go with the feature. These four are the only database-level checks of row level security on those tables, and `anon` may `SELECT` every table (`20260625140000_restore_postgrest_role_grants.sql:18`), so row level security is all that stands between a visitor and the rows.\n- Change, keeping every case that tests behavior that stays:"},{"oldText":"it existed before sharing (#40)","newText":"it existed before sharing (#35, 2026-01-15; sharing came with #130, 2026-02-19)"},{"oldText":"- `README.md`: drop \"Public board sharing with unique share links\".","newText":"- `README.md`: the feature line \"Public board sharing with unique share links\" becomes \"Boards are private to you\"."},{"oldText":"- New tests: none beyond the changed cases. No test asserts that a removed thing is absent: nothing could bring it back by accident, and the grep of Success runs once before the PR is marked ready.","newText":"- New tests: none beyond the changed and moved cases. No test asserts that a removed route or column is absent: the grep of Success runs once before PR A is marked ready. The kind of hole this route was (a `SECURITY DEFINER` function `anon` may call) is checked by the verification query's `anon_definer_functions`; a CI check of it goes to TODOS.md."}]} -->

<!-- autoplan-accepted:ceo -->

- Two PRs. PR A holds everything but the migration file (client, server, `types.ts`, tests, stories, fixtures, `supabase/seed.sql`, docs) and touches no path that starts `supabase-production.yml`. PR B holds the migration file only and merges after PR A's Vercel production deployment is Ready and PR A's production check passed. No workflow is disabled. Verified in the final report by the run list of `supabase-production.yml` (no run for PR A's merge sha, one `push` run for PR B's) and the two production checks.
- The Vercel deployment is found with the full 40-character merge sha and `select(.creator.login == "vercel[bot]")`, polled until an id appears, and is Ready when its latest status is `success`; PR B's migration run is polled until its `headSha` is PR B's full merge sha and awaited with `gh run watch --exit-status`.
- Before PR B, PR A can be rolled back like any change; after PR B the change is fixed forward only, and a rollback to PR A's build stays safe. Section 6 and the migration's header say so.
- The four tenant-isolation cases of `public-board-data-access.spec.ts` (lines 45, 66, 93, 133) move to `e2e/unauthenticated/board-data-access.spec.ts`; the visitor's query reads the whole `board` table without the `is_public` filter; they are a line of Success.
- The verification query has `anon_definer_functions` (no non-trigger `SECURITY DEFINER` function in `public` executable by `anon`), expected 0 after PR B; a CI check of it is a new TODOS.md entry.
- The Problem section says the counts show that no working link breaks, not that nobody wants sharing; the requirements of a later sharing feature are kept in issue #257.
- The CHANGELOG entry of PR A says that public board links are gone and that a board opens for its owner only. README's feature line becomes "Boards are private to you".
- Copy Link stays; its origin is #35 (2026-01-15), before sharing (#130).
- The `git grep` of Success (with `tab-sharing|panel-sharing|public sharing|name and globe|whose globe|board that is not shared|share slug|shareLink|the public page|its public page|even when public|four tabs|4-tab`) runs before PR A is marked ready and after any rebase; its output (expected: no lines) goes into the PR body, which links #254 and #257 without a closing keyword in front of a number.
- Production SQL runs as `supabase db query --linked --project-ref zfcwvzazzzsefbkztsyp`; the audit before PR B is the two count queries of step 5, and a public board found then is reported (count and owner kind, no slug) while the merge goes on.
- The migration drops `get_public_board(text)` with `DROP FUNCTION IF EXISTS` and no `REVOKE`, sets `lock_timeout` through `set_config`, and counts each column only while it exists.
- `proxy-signed-out-access.test.ts` expects a signed-out `/public/a1b2c3d4e5f6` to be redirected to `/login`, and its three look-alike `/public` cases are deleted.
- The `types.ts` edit is in PR A's first commit, with the fixtures typed by it.
- Wording the grep cannot see changes too: the header of `column-color-data-access.spec.ts`, `one-repo-across-boards.spec.ts:602-603`, `add-repository-combobox.spec.ts:943`, `AddRepositoryCombobox.tsx:509`; `validations/repo-card.ts:23/41`, `board-data.ts:164`, the settings dialog's tab comment (line 486), `board-settings-narrow-viewport.spec.ts:4/25/26`, `BoardSettingsDialog.test.tsx:100`, the `TODOS.md` entry that takes `shareLink` as its pattern. The panel's 26rem least height stays.
- `add-repository-combobox.spec.ts:938` keeps its claim (a window too short for one row of the list) with a window lowered until the panel without the notice still overflows; its comment carries the measured numbers.
- `board-not-found.spec.ts:70` asks for "Other User Board".
- `docs/designs/` is history and is not edited, like `docs/plans/` and `CHANGELOG.md`.
- `CLAUDE.md`'s example of a render-time reset becomes `adoptedComments` in `useCommentState`; the "Public: Unauthenticated endpoints" heading of the rate-limit config stays.
- An old tab's Sharing switch after PR A's deployment stays where it was without a message (unrecognized action, no `catch`); a reload fixes it; no code.
- The production check of PR A looks at the Sentry issues of the first hour after the deployment when the session can reach Sentry, and says "not checked" otherwise.
- `pnpm knip` runs before PR A is marked ready and shows no unused file or export that `main` does not show.

<!-- /autoplan-accepted:ceo -->

<!-- AUTONOMOUS DECISION LOG -->

## Decision Audit Trail

| #   | Phase  | Decision                                                                      | Classification  | Principle | Rationale                                                           | Rejected                             |
| --- | ------ | ----------------------------------------------------------------------------- | --------------- | --------- | ------------------------------------------------------------------- | ------------------------------------ |
| 1   | CEO    | Mode SELECTIVE EXPANSION                                                      | Mechanical      | P6        | /autoplan override; owner asleep                                    | asking for a mode                    |
| 2   | CEO    | Full removal, columns included                                                | Mechanical      | P1        | owner's "完全に削除"                                                | code-only removal                    |
| 3   | CEO    | C1 workflow hold (later replaced by two PRs, #12)                             | Mechanical      | P1, P2    | zero-window rollout, zero code                                      | one PR with a mixed window           |
| 4   | CEO    | C2 CHANGELOG says links are gone                                              | Mechanical      | P1        | users learn what changed                                            | silent removal                       |
| 5   | CEO    | C3 grep output in the PR body                                                 | Mechanical      | P1        | definition of done is visible                                       | trust without proof                  |
| 6   | CEO    | C4 privacy wording filed as #254                                              | Mechanical      | P3        | outside the blast radius                                            | edit in this PR                      |
| 7   | CEO    | C5 no redirect for old links                                                  | Mechanical      | P5        | no working link exists                                              | redirect page                        |
| 8   | CEO    | C6 Copy Link label unchanged                                                  | Mechanical      | P5        | toast already says whose link                                       | rename                               |
| 9   | CEO    | Spec review S1–S10, T1–T9, U1–U8 applied                                      | Mechanical      | P1, P5    | each verified against code                                          | partial application                  |
| 10  | CEO    | 0H document approval A                                                        | Mechanical      | P6        | both documents carry the same decisions                             | revise loop                          |
| 11  | CEO    | N1 isolation cases moved, not deleted                                         | Mechanical      | P1        | only DB-level RLS proof                                             | delete with the feature              |
| 12  | CEO    | N2/X3 two PRs replace the workflow hold                                       | Mechanical      | P1, P5    | safe state between PRs; no disabled workflow                        | workflow disable/enable              |
| 13  | CEO    | N3/X1 premise wording; requirements in #257                                   | Mechanical      | P1        | counts show no broken link, not no demand                           | "nobody uses it"                     |
| 14  | CEO    | N4 `anon_definer_functions` in the verification query                         | Mechanical      | P1        | the hole this route was                                             | no check                             |
| 15  | CEO    | N5/N6 Copy Link origin #35; README wording                                    | Mechanical      | P5        | verified history                                                    | —                                    |
| 16  | CEO    | X2 acquisition path: removal stays                                            | Taste (gate d1) | P1, P5    | owner's direction; alternatives in #257                             | keep sharing                         |
| 17  | CEO    | X4 privacy wording in #254                                                    | Taste (gate d2) | P3        | outside the blast radius                                            | fix now                              |
| 18  | CEO    | X5 Sentry check of the first hour                                             | Mechanical      | P5        | outcome signal without new metrics                                  | outcome statement                    |
| 19  | CEO    | X6 public board found before PR B: report, merge on                           | Mechanical      | P1        | owner asked for the removal                                         | notification flow                    |
| 20  | CEO    | Copy Link stays                                                               | Taste (gate d3) | P5        | predates sharing                                                    | remove                               |
| 21  | CEO    | Spec not re-run after launch 3                                                | Taste (gate d4) | P6        | later phases read the amended plan                                  | fourth launch                        |
| 22  | Design | All seven passes                                                              | Mechanical      | P1        | full coverage                                                       | focused subset                       |
| 23  | Design | Mockups skipped                                                               | Taste (gate d5) | P5, P3    | removal adds no screen                                              | generated mockups                    |
| 24  | Design | M1/D2 sign-in return filed as #258                                            | Mechanical      | P3        | existed before                                                      | fix here                             |
| 25  | Design | M2 one wording for the rule                                                   | Mechanical      | P5        | toast, 404, README, CHANGELOG agree                                 | separate wordings                    |
| 26  | Design | BoardCard wrapper span kept                                                   | Mechanical      | P5        | width rule applies to that box                                      | unwrap                               |
| 27  | Design | 256px floor for the short-window case                                         | Mechanical      | P1        | WCAG 1.4.10 height                                                  | unbounded lowering                   |
| 28  | Design | Before/after screenshots in PR A                                              | Mechanical      | P1        | visual proof                                                        | none                                 |
| 29  | Design | Tab keyboard model filed as #259                                              | Mechanical      | P3        | existed before                                                      | fix here                             |
| 30  | Design | D1 Copy Link wording: toast only                                              | Taste (gate d6) | P5        | header space                                                        | label next to button                 |
| 31  | DX     | Mode DX POLISH                                                                | Mechanical      | P6        | /autoplan override                                                  | —                                    |
| 32  | DX     | Persona: contributor or agent in a fresh worktree                             | Mechanical      | P6        | observed friction                                                   | —                                    |
| 33  | DX     | TTHW target 2–5 min through CLAUDE.md notes                                   | Mechanical      | P5        | docs in files already edited                                        | setup script                         |
| 34  | DX     | Preflight, serial checks, bounded polls, gates, rollback note                 | Mechanical      | P1, P5    | unattended run must stop cleanly                                    | best-effort steps                    |
| 35  | DX     | Worktree setup and shared stack filed as #261                                 | Mechanical      | P3        | outside the blast radius                                            | fix here                             |
| 36  | Eng    | Scope accepted as-is; structure A                                             | Mechanical      | P5        | every file reads a removed symbol                                   | smaller arrangement                  |
| 37  | Eng    | N1 migration version in JST at PR B branch time, checked against three maxima | Mechanical      | P5        | #260 has 20261016191000; CLI names by UTC                           | fixed name; `supabase migration new` |
| 38  | Eng    | C2 DETAIL: amend the same unapplied file                                      | Mechanical      | P5        | a later migration cannot run first                                  | new migration                        |
| 39  | Eng    | N6 `strpos` instead of `ILIKE`                                                | Mechanical      | P5        | `_` is a wildcard                                                   | ILIKE                                |
| 40  | Eng    | N2 rebase before each merge; scan open PR diffs; Test green on merge commit   | Mechanical      | P1        | main moves under concurrent runs                                    | rebase only if needed                |
| 41  | Eng    | N3 PR B waits the 12 h skew window                                            | Taste (gate d7) | P1, P5    | skewProtectionMaxAge 43200 measured                                 | skew boundary; merge at once         |
| 42  | Eng    | N7/C4 bounded poll of the migration run                                       | Mechanical      | P1        | `gh run watch` has no deadline                                      | gh run watch                         |
| 43  | Eng    | C3 pgrep check before every reset; wait then stop                             | Mechanical      | P1        | another checkout is active (#260)                                   | docker ps once                       |
| 44  | Eng    | N4/C1 isolation cases extended; visitor insert case                           | Mechanical      | P1, P2    | Success line must be proved                                         | narrow the wording                   |
| 45  | Eng    | N8 Copy Link copies origin + /board/<id>                                      | Mechanical      | P5        | `?card=` stays in the address                                       | location.href                        |
| 46  | Eng    | N5 re-measure `:1085`; reword `:1042`, `:570`                                 | Mechanical      | P1        | measured with the notice                                            | leave numbers                        |
| 47  | Eng    | N9 Move default: no E2E change needed                                         | Mechanical      | P3        | flows pick by hand; :367 only other board                           | rewrite specs                        |
| 48  | Eng    | N10 TODO entry: postgres DB, not a shard                                      | Mechanical      | P1        | shards drop privileges                                              | shard check                          |
| 49  | Eng    | N11 non-gating sharing/globe/shared triage                                    | Mechanical      | P1        | grep blind spot                                                     | widen the gate                       |
| 50  | Eng    | N12 CLI version difference noted only                                         | Mechanical      | P3        | CI is the pinned rehearsal                                          | pin local CLI                        |
| 51  | Eng    | Migration second-run and raise-path harness deferred                          | Mechanical      | P3        | one-time migration; idempotent by construction                      | harness                              |
| 52  | Eng    | No `toBoardPath` helper                                                       | Mechanical      | P5, P3    | codebase builds board paths inline                                  | new helper                           |
| 53  | Gate   | Plan approved as-is (A), every taste item at its recommendation               | Mechanical      | P6        | owner's standing instruction: "全てreccomendの選択肢で進行" = `all` | overrides                            |
