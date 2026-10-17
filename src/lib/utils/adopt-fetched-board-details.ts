/**
 * Take a board's name, subtitle, card display settings and comments from a
 * refetch, without putting back a copy that was read before a save on this
 * tab landed.
 *
 * A refetch does not rebuild the page, so the values on screen stay in hook
 * state. {@link useBoardSettings} and {@link useCommentState} call these when
 * {@link useBoardServerSync} has applied a fetch. Each field is compared to
 * the last copy taken from the server. A field that still matches that copy
 * is the one this tab already showed, including a read that started before a
 * rename or a comment edit was saved, and the screen keeps what the save put
 * there. A field that differs was saved after that copy, in this tab or
 * another, and the screen shows it.
 */

import type { CommentData } from '@/lib/actions/project-info-core'
import {
  DEFAULT_CARD_DISPLAY_SETTINGS,
  parseBoardSettings,
  type CardDisplaySettings,
} from '@/lib/types/board-settings'

/**
 * The name, subtitle and display settings one fetch or one page handed over.
 * `subtitle` is `''` when the board has none. `cardDisplay` is the parsed
 * settings, so a missing flag is already the default.
 */
export interface ShownBoardDetails {
  /** Board name shown in the header. */
  name: string
  /** Subtitle shown in the header, or `''` when there is none. */
  subtitle: string
  /** Which lines a card shows, and the comment's type. */
  cardDisplay: CardDisplaySettings
  /** Whether the header shows the subtitle. */
  showSubtitle: boolean
}

/**
 * The board row and the comments of one fetch that was applied.
 *
 * Passed by {@link useBoardServerSync} to the page, which hands the name and
 * the settings to {@link useBoardSettings} and the comments to
 * {@link useCommentState}. A new object on every applied fetch. A fetch that
 * was dropped never produces one.
 */
export interface FetchedBoardDetails {
  /** Board the fetch read. */
  boardId: string
  /** `board.name` from that read. */
  name: string
  /** `board.subtitle` from that read. `null` when the board has none. */
  subtitle: string | null
  /** `board.settings` from that read. A new object on every fetch. */
  settings: unknown
  /** Comments from that read, one entry per card. */
  comments: Record<string, CommentData>
}

/**
 * The name and the settings the page props describe.
 *
 * Called by {@link useBoardSettings} for the first paint and when the page
 * moves to another board.
 *
 * @param boardName - `board.name` from the page.
 * @param boardSubtitle - `board.subtitle` from the page.
 * @param boardSettings - `board.settings` from the page.
 * @returns The four values the header and the cards show.
 */
export function shownBoardDetailsFromProps(
  boardName: string,
  boardSubtitle: string | null,
  boardSettings: unknown,
): ShownBoardDetails {
  return shownBoardDetailsFromSettings(boardName, boardSubtitle, boardSettings)
}

/**
 * The name and the settings a fetch that was applied describes.
 *
 * Called by {@link useBoardSettings} when {@link FetchedBoardDetails} arrives.
 * The settings are parsed, so a new object with the same flags compares equal
 * to the copy already shown.
 *
 * @param details - The fetch that was applied.
 * @returns The four values that read carried.
 */
export function shownBoardDetailsFromFetch(
  details: FetchedBoardDetails,
): ShownBoardDetails {
  return shownBoardDetailsFromSettings(
    details.name,
    details.subtitle,
    details.settings,
  )
}

/**
 * Take the fetched name, subtitle and display settings that differ from the
 * last copy this tab took from the server.
 *
 * Called by {@link useBoardSettings} during render. A field equal to
 * `baseline` stays as `screen` has it: that is the copy read before a save
 * on this tab landed. A field that differs replaces what the screen shows,
 * and becomes the baseline a later fetch is compared to.
 *
 * @param screen - What the header and the cards show now.
 * @param baseline - The last name and settings taken from the server.
 * @param fetched - The name and settings of the fetch just applied.
 * @returns The same objects when nothing moved, so the hook skips the update.
 */
export function adoptFetchedBoardDetails(
  screen: ShownBoardDetails,
  baseline: ShownBoardDetails,
  fetched: ShownBoardDetails,
): { screen: ShownBoardDetails; baseline: ShownBoardDetails } {
  const name = fetched.name === baseline.name ? screen.name : fetched.name
  const subtitle =
    fetched.subtitle === baseline.subtitle ? screen.subtitle : fetched.subtitle
  // The whole card-display object is one save. A new object with the same
  // flags is the copy this tab already has.
  const cardDisplay = sameCardDisplay(fetched.cardDisplay, baseline.cardDisplay)
    ? screen.cardDisplay
    : fetched.cardDisplay
  const showSubtitle =
    fetched.showSubtitle === baseline.showSubtitle
      ? screen.showSubtitle
      : fetched.showSubtitle

  const nextBaseline: ShownBoardDetails = {
    name: fetched.name === baseline.name ? baseline.name : fetched.name,
    subtitle:
      fetched.subtitle === baseline.subtitle
        ? baseline.subtitle
        : fetched.subtitle,
    cardDisplay: sameCardDisplay(fetched.cardDisplay, baseline.cardDisplay)
      ? baseline.cardDisplay
      : fetched.cardDisplay,
    showSubtitle:
      fetched.showSubtitle === baseline.showSubtitle
        ? baseline.showSubtitle
        : fetched.showSubtitle,
  }

  const screenUnchanged =
    name === screen.name &&
    subtitle === screen.subtitle &&
    cardDisplay === screen.cardDisplay &&
    showSubtitle === screen.showSubtitle
  const baselineUnchanged =
    nextBaseline.name === baseline.name &&
    nextBaseline.subtitle === baseline.subtitle &&
    nextBaseline.cardDisplay === baseline.cardDisplay &&
    nextBaseline.showSubtitle === baseline.showSubtitle

  return {
    screen: screenUnchanged
      ? screen
      : { name, subtitle, cardDisplay, showSubtitle },
    baseline: baselineUnchanged ? baseline : nextBaseline,
  }
}

/**
 * Take the comments of a fetch that differ from the last copy this tab took
 * from the server.
 *
 * Called by {@link useCommentState} during render. A comment equal to the
 * baseline stays as the screen has it, so an edit saved on this tab is not
 * replaced by a read that started before that save. A comment that differs,
 * and a card the screen has not seen, is shown. A card the fetch no longer
 * has drops off when this tab has not edited it.
 *
 * @param screen - Comments the board shows now.
 * @param baseline - The last comments taken from the server.
 * @param fetched - Comments of the fetch just applied.
 * @returns The same objects when nothing moved, so the hook skips the update.
 */
export function adoptFetchedComments(
  screen: Record<string, CommentData>,
  baseline: Record<string, CommentData>,
  fetched: Record<string, CommentData>,
): {
  screen: Record<string, CommentData>
  baseline: Record<string, CommentData>
} {
  let nextScreen = screen
  let nextBaseline = baseline

  for (const [cardId, fetchedComment] of Object.entries(fetched)) {
    const base = nextBaseline[cardId]
    // The read still has the comment this tab last took from the server
    if (base !== undefined && sameComment(base, fetchedComment)) continue

    const current = nextScreen[cardId]
    if (current === undefined || !sameComment(current, fetchedComment)) {
      if (nextScreen === screen) nextScreen = { ...screen }
      nextScreen[cardId] = fetchedComment
    }
    if (nextBaseline === baseline) nextBaseline = { ...baseline }
    nextBaseline[cardId] = fetchedComment
  }

  for (const cardId of Object.keys(screen)) {
    // Still on the board
    if (Object.hasOwn(fetched, cardId)) continue
    const base = nextBaseline[cardId]
    const current = nextScreen[cardId]
    if (current === undefined) continue
    // Edited here since the last server copy: keep it
    if (base !== undefined && !sameComment(base, current)) continue
    if (nextScreen === screen) nextScreen = { ...screen }
    delete nextScreen[cardId]
    if (base === undefined) continue
    if (nextBaseline === baseline) nextBaseline = { ...baseline }
    delete nextBaseline[cardId]
  }

  return { screen: nextScreen, baseline: nextBaseline }
}

/**
 * Parse one board row into the four values the header and the cards show.
 *
 * @param name - Board name.
 * @param subtitle - Board subtitle. `null` is shown as `''`.
 * @param settings - Raw `board.settings`.
 * @returns Name, subtitle, card display and the show-subtitle switch.
 */
function shownBoardDetailsFromSettings(
  name: string,
  subtitle: string | null,
  settings: unknown,
): ShownBoardDetails {
  const parsed = parseBoardSettings(settings)
  return {
    name,
    subtitle: subtitle ?? '',
    cardDisplay: parsed.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS,
    showSubtitle: parsed.showSubtitle ?? true,
  }
}

/**
 * Whether two card-display settings show the same lines and the same type.
 *
 * @param left - One parsed card display.
 * @param right - Another parsed card display.
 * @returns `true` when every flag and both type fields match.
 */
function sameCardDisplay(
  left: CardDisplaySettings,
  right: CardDisplaySettings,
): boolean {
  return (
    left.showGitHubDescription === right.showGitHubDescription &&
    left.showComment === right.showComment &&
    left.commentText.fontSize === right.commentText.fontSize &&
    left.commentText.fontWeight === right.commentText.fontWeight
  )
}

/**
 * Whether two comments show the same text in the same color.
 *
 * @param left - One comment.
 * @param right - Another comment.
 * @returns `true` when the text and the color match.
 */
function sameComment(left: CommentData, right: CommentData): boolean {
  return left.comment === right.comment && left.color === right.color
}
