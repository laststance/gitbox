/**
 * Board Settings Types
 *
 * Type definitions for board-level settings stored in board.settings JSON column.
 * Used for card display customization and future board-specific preferences.
 *
 * @see https://github.com/laststance/gitbox/issues/20 (Phase 5)
 */

import type {
  COMMENT_FONT_SIZES,
  COMMENT_FONT_WEIGHTS,
} from '@/components/Board/CommentDisplay'

/**
 * Comment text settings (font size and weight only)
 * Border color is now per-comment, not board-wide.
 */
export interface CommentTextSettings {
  /** Font size for comment text */
  fontSize: keyof typeof COMMENT_FONT_SIZES
  /** Font weight for comment text */
  fontWeight: keyof typeof COMMENT_FONT_WEIGHTS
}

/**
 * Card display settings for RepoCards on the board
 */
export interface CardDisplaySettings {
  /** Show GitHub repository description on cards */
  showGitHubDescription: boolean
  /** Show inline comment on cards */
  showComment: boolean
  /** Text style settings for comment display (font size/weight) */
  commentText: CommentTextSettings
}

/**
 * Root board settings object stored in board.settings JSON column
 */
export interface BoardSettings {
  /** Card display customization */
  cardDisplay?: CardDisplaySettings
}

/**
 * Default comment text settings
 */
export const DEFAULT_COMMENT_TEXT_SETTINGS: CommentTextSettings = {
  fontSize: 'sm',
  fontWeight: 'normal',
}

/**
 * Default card display settings
 */
export const DEFAULT_CARD_DISPLAY_SETTINGS: CardDisplaySettings = {
  showGitHubDescription: true,
  showComment: true,
  commentText: DEFAULT_COMMENT_TEXT_SETTINGS,
}

/**
 * Default board settings
 */
export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  cardDisplay: DEFAULT_CARD_DISPLAY_SETTINGS,
}

/**
 * Parse board settings from JSON, applying defaults for missing values
 *
 * @param json - Raw JSON from database (may be null or partial)
 * @returns Complete BoardSettings with defaults applied
 *
 * @example
 * const settings = parseBoardSettings(board.settings)
 * console.log(settings.cardDisplay.showComment) // always defined
 */
export function parseBoardSettings(json: unknown): BoardSettings {
  if (!json || typeof json !== 'object') {
    return DEFAULT_BOARD_SETTINGS
  }

  const raw = json as Record<string, unknown>
  const cardDisplay = raw.cardDisplay as
    | Partial<CardDisplaySettings>
    | undefined

  const commentText = cardDisplay?.commentText

  return {
    cardDisplay: {
      showGitHubDescription:
        cardDisplay?.showGitHubDescription ??
        DEFAULT_CARD_DISPLAY_SETTINGS.showGitHubDescription,
      showComment:
        cardDisplay?.showComment ?? DEFAULT_CARD_DISPLAY_SETTINGS.showComment,
      commentText: {
        fontSize:
          commentText?.fontSize ??
          DEFAULT_CARD_DISPLAY_SETTINGS.commentText.fontSize,
        fontWeight:
          commentText?.fontWeight ??
          DEFAULT_CARD_DISPLAY_SETTINGS.commentText.fontWeight,
      },
    },
  }
}
