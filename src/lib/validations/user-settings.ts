import { z } from 'zod'

/**
 * Default values for the boards page header.
 * Used as fallback when user_settings row has NULL values.
 *
 * @example
 * // In component: show default when DB value is null
 * value={initialTitle || BOARDS_PAGE_DEFAULTS.title}
 */
export const BOARDS_PAGE_DEFAULTS = {
  title: 'My Boards',
  subtitle: 'Manage your GitHub repositories in Kanban format',
} as const

/** Maximum character limit for boards page title */
export const BOARDS_PAGE_TITLE_MAX_LENGTH = 50

/** Maximum character limit for boards page subtitle */
export const BOARDS_PAGE_SUBTITLE_MAX_LENGTH = 100

/**
 * Schema for boards page title.
 * Allows empty string (clears to default) or text up to 50 chars.
 * @example
 * boardsPageTitleSchema.safeParse('My Projects')    // => { success: true }
 * boardsPageTitleSchema.safeParse('')               // => { success: true, data: '' }
 * boardsPageTitleSchema.safeParse('x'.repeat(51))   // => { success: false }
 */
export const boardsPageTitleSchema = z
  .string()
  .trim()
  .max(
    BOARDS_PAGE_TITLE_MAX_LENGTH,
    `Title must be ${BOARDS_PAGE_TITLE_MAX_LENGTH} characters or less`,
  )

/**
 * Schema for boards page subtitle.
 * Allows empty string (clears to default) or text up to 100 chars.
 * @example
 * boardsPageSubtitleSchema.safeParse('Custom subtitle')  // => { success: true }
 * boardsPageSubtitleSchema.safeParse('')                   // => { success: true, data: '' }
 * boardsPageSubtitleSchema.safeParse('x'.repeat(101))     // => { success: false }
 */
export const boardsPageSubtitleSchema = z
  .string()
  .trim()
  .max(
    BOARDS_PAGE_SUBTITLE_MAX_LENGTH,
    `Subtitle must be ${BOARDS_PAGE_SUBTITLE_MAX_LENGTH} characters or less`,
  )
