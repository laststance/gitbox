# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.17.0] - 2026-10-18

### Changed

- Account now shows Profile, Account Data, and Danger Zone as sections of one page. The two counts sit in a row without a tile around each.

## [0.7.16.0] - 2026-10-18

### Changed

- Card, comment, and column menus are 36px tall. On a touch screen their tap target is 44px, as is Close on a dialog and the held-repository row actions.

## [0.7.15.0] - 2026-10-18

### Changed

- The signed-out landing page now names what GitBox does, uses a display face on its headings, and shows the page without a fade-in. The Kanban Board card is the featured one.

## [0.7.14.0] - 2026-10-18

### Changed

- A failed drag, undo, or remove still puts cards and columns back only when the screen still shows that same attempt. If the board has moved on, the page asks for a fresh copy instead of overwriting it.

## [0.7.13.0] - 2026-10-18

### Fixed

- Pressing Z after a column was deleted no longer moves the columns that remain. An older layout is restored only when every column in it is still on the board and two columns would not land on the same cell.
- A card is not sent back to a column that was deleted. It keeps its place in its current column, and the other cards in that undo still go back.

## [0.7.12.1] - 2026-10-18

### Changed

- The note on a failed card move now counts that save, and a save that throws asks for a fresh copy of the board.

## [0.7.12.0] - 2026-10-18

### Fixed

- When a board takes longer than 15 seconds to reload, the page stops waiting and offers Try again. That retry does not line up behind the request that never answered.

## [0.7.11.0] - 2026-10-18

### Fixed

- After a card is dragged, the browser's Back button leaves it in the column it was dragged to.

## [0.7.10.0] - 2026-10-18

### Fixed

- Dragging a card no longer rewrites the saved settings. Changing the theme still saves it.

## [0.7.9.0] - 2026-10-18

### Fixed

- After Z fails to save an undo, the next Z tries that same undo again. A second failure of that step gets out of the way, so an older undo can still run.

## [0.7.8.0] - 2026-10-18

### Fixed

- A board fetched just before a column edit, an added card, a removed card, or a refreshed GitHub description no longer puts the older copy back on screen.

## [0.7.7.0] - 2026-10-18

### Fixed

- A board change that fails to save says what the screen did. A removal the server refused keeps that sentence when the card comes back. A save that never got an answer puts the old layout back and reloads the board, because the change may already be stored. Offline, that is one notice, it stays up while a save is still going out, and it can be closed.

## [0.7.6.0] - 2026-10-18

### Added

- The test suite fails if the proxy stops running for the error-report path, including a capital M or a trailing slash, or if Sentry's own tunnel rewrite is no longer `/monitoring(/?)`.

## [0.7.5.0] - 2026-10-17

### Fixed

- A burst of error reports or sign-in attempts is counted once across the servers that handle it. When that shared count does not answer, the app still limits the one server that received the request.

## [0.7.4.0] - 2026-10-17

### Fixed

- Error reports sent to Sentry no longer carry every header the browser or the host attached. The tunnel forwards only the few the ingest needs.

## [0.7.3.0] - 2026-10-17

### Fixed

- Letting go of a column, even in the same moment you pick it up, takes the drop places off the board. They follow the drag itself, so they no longer stay behind until the next drag.

## [0.7.2.0] - 2026-10-17

### Added

- The browser checks now cover a board drag handle and a card pointing at a stable description, Favorite Boards leaving that description off the page, coming back to the button that opened Add Repositories, putting the cursor back on an empty comment, leaving an unedited note out of the draft, clearing drafts and the last move destination on Sign Out while keeping the theme, replacing a stale card description from GitHub, and keeping a deleted column gone when a column move is undone.

## [0.7.1.0] - 2026-10-17

### Removed

- The database no longer keeps anything for board sharing: the public flag of a board, its share code and the lookup that served shared boards are gone. The oldest app build that runs on this database is the one released as 0.7.0.0 (merge commit `a3a3090`).

## [0.7.0.0] - 2026-10-16

### Removed

- Public board links are gone. A board opens only for the account that owns it: Board Settings no longer has a Sharing tab, and an old `/public/…` link leads to the sign-in page, or to "not found" when you are signed in.
- Add Repositories, Move Here and Move to Another Board no longer warn about who sees a shared board, and the board list no longer marks one with a globe.

### Changed

- Copy Link copies the board's own address, without the part that points at a card, and says that only the account that owns the board can open it.
- Move to Another Board opens on the board your last move from this board went to, or else on your newest board.
- The "Board not found" page says that a board opens only for the account that owns it.

## [0.6.0.0] - 2026-10-15

### Added

- A repository keeps its note, its links and its comment when its card goes. Remove it from a board, delete its column or delete its board, add the repository again (to any board), and the note, the links and the comment are back.
- The Add Repositories picker marks a repository that has something kept, for example "Saved: note, 3 links, comment", so you can tell which ones you wrote about before.

### Changed

- "Remove from Board", "Delete Column" and "Delete Board" say that the note, links and comment of the repositories are kept for when you add them again. "Remove from Board" no longer points to "Move to Another Board" as the way to keep them.

### Fixed

- A note that cannot be loaded no longer opens as an empty editor, where saving would have replaced the note with nothing. A message says the note could not be loaded, and the editor stays closed until you try again.
- A note the server refuses to save now says so and keeps what you typed: open the note again to save it. Before, the text was thrown away without a word.

## [0.5.1.0] - 2026-10-14

### Fixed

- The list of boards no longer throws away the page the server sent (React error 418) when a board was made between midnight in UTC and midnight where you are. The day a board was made, and the day your account was linked on the account page, are shown in your own time zone once the page has loaded.
- A shared board no longer throws away its page in a browser set to a language that writes 1.234 for 1,234: star counts are written the same way on the server and in the browser.

## [0.5.0.0] - 2026-10-14

### Removed

- Maintenance Mode: the Maintenance page, "Move to Maintenance" in a card's menu, and the Maintenance entries of the sidebar and the command palette. To set a repository aside, move its card to a board you keep for that. Every repository that was in Maintenance is now a card on a board named "Maintenance" in your board list, with its note, links and comment.

### Added

- "Move to Another Board" can create the board it moves to: press "New Board...", name it, and the card goes there.
- On a phone the sidebar's toggle opens the full sidebar, with its labels, over the page. The toggle stays where it was, so a second press closes the sidebar again; the page behind it, Escape or a link close it too.
- The Add Repositories picker and "Move to Another Board" say so when the board is shared by a public link: anyone who has the link will see the repositories you put there.

### Changed

- A board is created together with its columns in one step, so a creation that fails leaves no board without columns. When the connection drops and nobody can tell whether the board was created, the message says that and sends you to your boards before a second try.
- Below 768px the sidebar is an icon rail and the page uses the rest of the screen. It was 256px wide and left a phone 119px for the page.
- After "Move to Another Board" or "Remove from Board" the keyboard focus goes to the next card of the column instead of the top of the page.
- "Move to Another Board" waits 15 seconds for an answer, then says that the move could not be confirmed and offers "Reload page". It says the same when the server could not tell whether the card was moved, instead of calling that an error.
- A column's color has to be a six-digit hex color (`#RRGGBB`), and a board has at most 100 columns when it is created.
- Toasts use the colors of the chosen theme, and in a dark theme the browser draws its own parts (scrollbars, the list of a native select, autofill) dark too.
- A card's menu button is named after the owner and the repository ("Open menu for owner/name"), and the sidebar tells a screen reader which page is open.
- Controls that appeared only under the mouse pointer (a card's menu, a comment's menu, the favorite star) are always shown on phones and tablets, where the main pointer is a finger.

### Fixed

- Opening a board a second time no longer fails to hydrate (React error 418) and render twice: the board is no longer kept in the browser's storage.
- The red of destructive buttons, menu items and counters is readable in the dark themes, and toast text, the character counters and the favorite star pass the contrast minimum on all 14 themes.
- The Add Repositories picker stays on the screen at every window width: it spans a phone's screen, and on a tablet or a narrow laptop window its left part is no longer cut off. Its search box and its Cancel / Add row stay in view on a short window, also when a long board title pushes the header down or the header changes while the picker is open. Where its button stands too low in a short window, the picker moves up over the header instead of shrinking.
- The label of the page you are on in the sidebar, the name of the current theme (also under the mouse pointer), the badges of selected repositories, the chosen Font Size and Font Weight in the board settings and the counter of a note near its limit are readable on all 14 themes.
- In the Add Repositories picker the description, the stars and the check mark of a repository that is selected or under the mouse pointer are readable on all 14 themes. So is the check mark of the current theme and of the current comment color while its menu item is highlighted.
- On a phone the list of themes opens inside the sidebar instead of running off the screen, and the sidebar ends where the visible screen ends, so the account link and "Sign Out" can be reached while the browser shows its bars.
- `Z` no longer undoes a drag on the board behind the command palette, behind the Add Repositories picker, or behind the sidebar while it is open over the page.
- On a window between 640px and 767px wide the sidebar opens over the Add Repositories picker instead of under it.
- In a comment's menu a click or a tap on "Color" opens the colors, and Enter or Space on the menu button opens the menu. Both opened the comment's editor before, so a phone or a tablet had no way to the colors, and choosing a color with Enter opened the editor as well.
- An item in the menu of a card or of a column, the "Note" button of a card and the menu button of a column answer when the mouse moves a little while it is down and when a finger rests on them before it lifts. The card or the column was picked up instead, and nothing else happened: "Move to Another Board" on a slow tap, "Edit Column", the colors of a comment and "Note".
- Enter and Space on the "Note" button of a card open the note. They picked the card up for a keyboard drag before.
- While a comment is being edited, a press on the editor's counter or edge no longer picks the card up.
- Escape during a column drag puts the board back as it was. The drop zones for a new row and for empty places stayed on the board until the next drag before.
- A name of one long word (snake_case, no space or hyphen) no longer pushes what stands beside it out of reach. The menu of a card stays on the card, "Column options" stays in its column, the buttons of a board's header and "Create Board" stay on the screen, a board's name stays on its card, and a dialog that shows such a name stays as wide as a phone's screen, with its lists of boards and columns. The name breaks where its line ends. An ordinary word is left whole.
- On a phone "Create Board" stands under the title and the subtitle of the boards page. Beside the button the title had 120px there: a title of one word either pushed the button past the edge of the screen or had to break.
- The board settings fit a phone's screen: its four tabs take a second row there instead of making the dialog scroll sideways. A screen reader says which tab a panel belongs to and finds the sections of the Cards tab one level under the dialog's title.
- In the Add Repositories picker, Escape in the open list of organizations closes that list and leaves the picker open with what you typed and selected. It closed the picker as well before.
- After a move the server refused or nobody could confirm, after a board creation nobody could confirm and after a failed load of the boards, a screen reader reads the message together with the control the keyboard lands on ("Move", "Reload page", "Reload boards", "Open your boards", "Try again").
- The Sharing tab of the board settings names the subtitle among what a public link shows.
- After a board creation the server refused, the keyboard focus is back in the name field.
- A dialog scrolls on a short screen, has one title for a screen reader, and its close button is a 32px target (44px for a finger).
- The loading skeleton of the account page has the shape of the page and fits a phone.
- A board creation that fails is reported once, in the form, with the name field marked.
- Headings of a board and of the board list are in order (one h1, then h2), and a board page has one main region for a screen reader instead of two.
- "Sign Out" is written the same way in the sidebar, on the account page and in the command palette.

## [0.4.2.0] - 2026-10-11

### Fixed

- Reloading the board after a failed save no longer closes an open dialog, drops text that was typed but not saved, or empties the undo history. Every page was built again from scratch whenever its data was fetched again; now only what changed is updated.
- The Maintenance page keeps its search text, sort order and view after a repository is restored or deleted.

## [0.4.1.0] - 2026-10-11

### Fixed

- Errors on pages seen while signed out (the landing page, the login page, a shared board) are now reported. Their reports were redirected to the login page and lost.
- A save that fails no longer puts an older board layout over newer changes. The board puts back only what that save changed, and reloads when something else changed in the meantime. This covers card and column drags, undo, Remove from Board and Move to Maintenance.
- Reloading the board after a failed save no longer replaces a drag made while the reload was on its way.
- The message after a failed drag or undo says what happens next: "You're offline. Try again when the connection is back." without a connection, "Reloading the board to show what was saved." when the board is fetched again. Repeated failed drags replace one message instead of stacking.
- Opening a board link while signed out leads to the login page instead of "Board not found".
- The app manifest and the link preview images load without a session. They were redirected to the login page.

### Changed

- A board opens at `/board/<id>` for its owner only. To show a board to someone else, turn on Public Sharing and send the public link. A `/board/<id>` link sent to another person earlier now shows "Board not found", and that page says to ask for the public link.
- Copy Link copies the public link when the board is shared, and says that only you can open the link when it is not.
- A shared board can be opened only with its link. Shared boards can no longer be listed, and the shared page no longer receives the owner's user id or the board's settings. It shows at most 1000 columns and 1000 cards.
- A share link that is mistyped or no longer shared shows its own "This shared board isn't available" page.
- Error reports go to this app's own Sentry project only, and session cookies are no longer sent along with them.
- The address that receives error reports limits how many it forwards from one client (120 a minute on each server instance) and refuses a report that declares more than 20 MiB.

## [0.4.0.0] - 2026-10-11

### Added

- A repository can now sit on only one of your boards, and never on a board and in Maintenance at once, so its note, links and comment live in one place.
- The Add Repositories picker lists repositories that are already on another board or in Maintenance under "Already placed elsewhere", each with a link to where it lives, instead of offering them again.
- When a repository was placed somewhere else after the picker opened (for example in another tab), the picker says which board holds it instead of adding a second card.

### Changed

- Restoring a repository from Maintenance or moving a card to another board now names the board that already holds the repository instead of showing "An unexpected error occurred".
- The "Remove from Board" confirmation states that the card's note, links and comment are deleted for good and that adding the repository again does not bring them back.
- An empty picker tells apart "nothing left to add" from "the current search or filters hide everything".
- Adding more than 100 repositories at once is refused with a message that says so.

### Fixed

- Pressing Z to undo a drag no longer brings back a card that was moved to another board, sent to Maintenance or removed in the meantime, and saves the card order exactly as shown on screen.
- A card can no longer end up in a column of a different board, where it was shown on no board.
- Pressing Enter to confirm Japanese (IME) input in the picker's search box no longer adds the selected repositories. Enter on Cancel, on a selected badge's remove button or on a repository row no longer submits the selection either.
- The picker stays inside short browser windows and scrolls instead of pushing its buttons off screen.
- A previous error in the "Move to Another Board" dialog disappears when another board or column is chosen.

## [0.3.3.0] - 2026-10-07

### Fixed

- Keep the repository picker visibly loading during GitHub reauthentication and reopen it in the selected column when authentication completes.
- Preserve the latest column choice, cancellation, and board query/hash across authentication; show an error when a resumed session still lacks a GitHub token.
- Keep saved organization filters readable while repositories load and restore the default column after closing the resumed picker.

## [0.3.2.0] - 2026-10-05

### Changed

- Updated all direct dependencies to their latest stable releases, including Next.js 16.3.8, React 19.3, Sentry 11, MSW 3, Vitest 5, and Motion 14.
- Adopted the TypeScript 7 native compiler for typechecking while keeping the TypeScript 6 API available to ESLint and other tools that require it.

### Fixed

- Migrated Sentry and MSW configuration to their current APIs and refreshed the test Service Worker.
- Kept unit tests stable with Motion's JavaScript animation fallback in Happy DOM.

## [0.3.1.3] - 2026-05-27

### Removed

- Dead read-path query functions left orphaned by the v0.3.1.0 single-embed migration: `getStatusLists`, `getRepoCards`, and `getBoardData` (`src/lib/actions/board.ts`), and `getCommentsForCards` (`src/lib/actions/project-info.ts`). All four had zero callers — the `/board/[id]` read path has resolved through `getBoardBundle`'s PostgREST nested embed since v0.3.1.0. Pure code removal: no runtime, schema, or behavior change. `createDefaultStatusLists` (still called by `createFirstBoardIfNeeded` and the board-data no-columns fallback) and `getCommentsCore` (still used by `maintenance-project-info.ts`) are retained.

## [0.3.1.2] - 2026-05-27

### Added

- E2E coverage for the `/board/[id]` not-found contract (`e2e/logged-in/board-not-found.spec.ts`): a malformed board id (rejected by `boardIdSchema` before any Postgres round-trip) and a well-formed but unseeded board UUID (`.maybeSingle()` resolves `null`) both render the segment-local "Board not found" boundary. Previously the `getBoardBundle` `null` ⇒ `notFound()` path was only covered indirectly; this is the first end-to-end assertion that an invalid `/board/[id]` URL reaches the 404 page. Asserts page content rather than HTTP status, since the Next.js App Router may stream a 200 before `notFound()` throws.

## [0.3.1.1] - 2026-05-27

### Added

- Unit tests for `logBoardTiming` (`src/lib/utils/board-timing.ts`) locking the `BOARD_TIMING_LOG` opt-in contract: a silent no-op when the flag is off (the production default), and exactly one structured line tagged `board-timing` carrying the board id plus every timing segment when it is on. Regression cover against accidental production log spam and against renaming the `board-timing` module tag that operators grep on.

## [0.3.1.0] - 2026-05-25

### Changed

- `/board/[id]` read path collapsed from a four-query waterfall (plus a duplicate board fetch) into a single PostgREST nested embed (`board` + `statuslist` + `repocard` + each card's `projectinfo` comment), deduplicated across `generateMetadata` and the page render via `React.cache()`. The board detail page now resolves its data in one database round-trip.
- Embedded repo cards are ordered by `order` ascending, so that if a board ever exceeds the PostgREST embed row cap, truncation drops the highest-order cards deterministically (parity with the previous `getRepoCards` ordering). `remapBoardEmbed` still re-sorts for render, so normal boards are unaffected.

### Added

- `BOARD_TIMING_LOG` flag and `logBoardTiming` utility (`src/lib/utils/board-timing.ts`) for opt-in board read-path timing instrumentation.
- Unit suites for `remapBoardEmbed` (column/card ordering, comment parity, RLS no-leak) and `getBoardBundle` (malformed-id 404 guard, no Postgres round-trip).

### Fixed

- `/board/<malformed-uuid>` now returns 404 instead of 500: `getBoardBundle` validates the board id with `boardIdSchema` before querying Postgres, restoring parity with the previous read path and avoiding Sentry noise.
- `generateMetadata` falls back to a generic "Board" title on a transient embed failure instead of throwing. A `React.cache`-memoized rejection would otherwise surface during metadata generation; the page render still replays the same rejection, so genuine failures are not hidden.

## [0.3.0] - 2026-04-29

### Added

- Silent GitHub OAuth token refresh on expired provider token. When a Server Action returns `errorCode: 'GITHUB_TOKEN_MISSING'`, the client redirects to `/api/auth/github/refresh?next=<path>`, which silently re-runs OAuth via Supabase and returns the user to the original page.
- `sanitizeNextPath` utility for open-redirect-safe `next` query parameter handling. Reused by `/auth/callback` and `/api/auth/github/refresh`.
- `getForwardedClientIp` utility consolidating `x-forwarded-for` parsing for rate-limit IP resolution.
- `handleGitHubTokenMissing` client helper with module-level lock and `sessionStorage` attempt counter for loop protection.
- `errorCode: 'GITHUB_TOKEN_MISSING'` discriminant on `ActionResult<T>` failure variant; emitted by 4 GitHub Server Actions.
- Unit tests for the refresh route, both new hooks, the client helper, the cookie module, the 401 interceptor, and `errorCode` propagation across GitHub Server Actions.
- E2E spec covering the refresh route's attempt-cap bail-out (`e2e/logged-in/silent-token-refresh.spec.ts`).
- gstack skill-routing rules in `CLAUDE.md`.

### Changed

- GitHub provider token cookie TTL extended from 8 hours to 30 days, aligned with the Supabase refresh token lifetime. Cookie remains `httpOnly`, `secure` (production), and `SameSite=Lax`.
- `signOut`, `deleteAccount`, and the axios 401 interceptor now use the shared `deleteGitHubTokenCookie` helper.
- `auth.ts`, `github.ts`, `public-board.ts`, and the refresh route now use the shared `getForwardedClientIp` helper for consistent x-forwarded-for parsing.

### Fixed

- Bookmark-after-8-hours bug: users returning to a bookmarked `/board/<id>` after the previous 8-hour cookie window no longer hit "GitHub token not found. Please sign in again." The flow now silently re-authenticates and lands them back on the original page.

## [0.2.0] - prior

Initial tracked release.

[Unreleased]: https://github.com/laststance/gitbox/compare/v0.3.1.3...HEAD
[0.3.1.3]: https://github.com/laststance/gitbox/compare/v0.3.1.2...v0.3.1.3
[0.3.1.2]: https://github.com/laststance/gitbox/compare/v0.3.1.1...v0.3.1.2
[0.3.1.1]: https://github.com/laststance/gitbox/compare/v0.3.1.0...v0.3.1.1
[0.3.1.0]: https://github.com/laststance/gitbox/compare/v0.3.0...v0.3.1.0
[0.3.0]: https://github.com/laststance/gitbox/compare/v0.2.0...v0.3.0
