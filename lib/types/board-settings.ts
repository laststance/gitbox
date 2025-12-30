/**
 * Board Settings Types
 *
 * Type definitions for board-level settings stored in board.settings JSON column.
 * Used for card display customization and future board-specific preferences.
 *
 * @see https://github.com/laststance/gitbox/issues/20 (Phase 5)
 */

import type { CommentStyleSettings } from '@/components/Board/CommentDisplay'

/**
 * Card display settings for RepoCards on the board
 */
export interface CardDisplaySettings {
  /** Show GitHub repository description on cards */
  showGitHubDescription: boolean
  /** Show inline comment on cards */
  showComment: boolean
  /** Style settings for comment display */
  commentStyle: CommentStyleSettings
}

/**
 * Root board settings object stored in board.settings JSON column
 */
export interface BoardSettings {
  /** Card display customization */
  cardDisplay?: CardDisplaySettings
}

/**
 * Default card display settings
 */
export const DEFAULT_CARD_DISPLAY_SETTINGS: CardDisplaySettings = {
  showGitHubDescription: true,
  showComment: true,
  commentStyle: {
    borderColor: 'primary',
    backgroundColor: 'subtle',
    fontSize: 'sm',
    fontWeight: 'normal',
  },
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

  return {
    cardDisplay: {
      showGitHubDescription:
        cardDisplay?.showGitHubDescription ??
        DEFAULT_CARD_DISPLAY_SETTINGS.showGitHubDescription,
      showComment:
        cardDisplay?.showComment ?? DEFAULT_CARD_DISPLAY_SETTINGS.showComment,
      commentStyle: {
        borderColor:
          cardDisplay?.commentStyle?.borderColor ??
          DEFAULT_CARD_DISPLAY_SETTINGS.commentStyle.borderColor,
        backgroundColor:
          cardDisplay?.commentStyle?.backgroundColor ??
          DEFAULT_CARD_DISPLAY_SETTINGS.commentStyle.backgroundColor,
        fontSize:
          cardDisplay?.commentStyle?.fontSize ??
          DEFAULT_CARD_DISPLAY_SETTINGS.commentStyle.fontSize,
        fontWeight:
          cardDisplay?.commentStyle?.fontWeight ??
          DEFAULT_CARD_DISPLAY_SETTINGS.commentStyle.fontWeight,
      },
    },
  }
}
