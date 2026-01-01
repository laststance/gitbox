/**
 * Project Info Validation Schemas
 *
 * Zod schemas for validating project info form inputs:
 * - Notes (rich text with Slate JSON format)
 * - Comments (plain text)
 * - Comment colors
 * - Project links with URL validation
 */

import { z } from 'zod'

import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'

// ========================================
// Constants
// ========================================

/** Maximum character limit for notes (rich text) */
export const NOTE_MAX_LENGTH = 20000

/** Maximum character limit for comments (inline, Card-in-Card) */
export const COMMENT_MAX_LENGTH = 2000

/** Valid comment colors (matches DB CHECK constraint) */
export const VALID_COMMENT_COLORS = [
  'neutral',
  'primary',
  'blue',
  'green',
  'amber',
  'purple',
  'rose',
  'cyan',
] as const

/** Default comment color */
export const DEFAULT_COMMENT_COLOR = 'primary' as const

// ========================================
// Comment Color Schema
// ========================================

export type CommentColorType = (typeof VALID_COMMENT_COLORS)[number]

/**
 * Schema for validating comment colors.
 *
 * @example
 * commentColorSchema.safeParse('primary') // => { success: true, data: 'primary' }
 * commentColorSchema.safeParse('invalid') // => { success: false }
 */
export const commentColorSchema = z.enum(VALID_COMMENT_COLORS, {
  message: 'Invalid comment color',
})

// ========================================
// Note Schema (Slate JSON with text length validation)
// ========================================

/**
 * Schema for validating note content (rich text in Slate JSON format).
 *
 * Validates the actual text length, not the JSON string length.
 * Handles both Slate JSON format and legacy plain text.
 *
 * @example
 * noteSchema.safeParse('[{"type":"p","children":[{"text":"Hello"}]}]')
 * // => { success: true }
 *
 * noteSchema.safeParse('x'.repeat(20001))
 * // => { success: false, error: 'Note must be 20000 characters or less' }
 */
export const noteSchema = z.string().superRefine((val, ctx) => {
  try {
    // Parse JSON to get actual text length
    const slateValue = parseSlateValue(val)
    const textLength = getSlateTextLength(slateValue)

    if (textLength > NOTE_MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Note must be ${NOTE_MAX_LENGTH} characters or less`,
      })
    }
  } catch {
    // If parsing fails, fall back to raw length check (legacy plain text)
    if (val.length > NOTE_MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Note must be ${NOTE_MAX_LENGTH} characters or less`,
      })
    }
  }
})

export type NoteInput = z.infer<typeof noteSchema>

// ========================================
// Comment Schema
// ========================================

/**
 * Schema for validating comment content (plain text).
 *
 * @example
 * commentSchema.safeParse('Short comment') // => { success: true }
 * commentSchema.safeParse('x'.repeat(2001)) // => { success: false }
 */
export const commentSchema = z
  .string()
  .max(
    COMMENT_MAX_LENGTH,
    `Comment must be ${COMMENT_MAX_LENGTH} characters or less`,
  )

export type CommentInput = z.infer<typeof commentSchema>

// ========================================
// URL Schema (for project links)
// ========================================

/**
 * Schema for validating project link URLs.
 *
 * Allows empty strings (filtered out later).
 * Validates http/https protocol and URL format.
 *
 * @example
 * projectLinkUrlSchema.safeParse('https://example.com') // => { success: true }
 * projectLinkUrlSchema.safeParse('ftp://example.com')   // => { success: false }
 * projectLinkUrlSchema.safeParse('')                     // => { success: true }
 */
export const projectLinkUrlSchema = z.string().superRefine((val, ctx) => {
  // Allow empty strings (will be filtered out)
  if (!val) return

  // Check protocol
  const urlRegex = /^https?:\/\/.+/
  if (!urlRegex.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'URL must start with http:// or https://',
    })
    return
  }

  // Validate URL format
  try {
    new URL(val)
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid URL format',
    })
  }
})

// ========================================
// Project Link Schema
// ========================================

/**
 * Schema for a single project link.
 *
 * @example
 * projectLinkSchema.safeParse({ type: 'vercel', url: 'https://vercel.com' })
 * // => { success: true }
 */
export const projectLinkSchema = z.object({
  type: z.string().min(1, 'Link type is required'),
  url: projectLinkUrlSchema,
})

export type ProjectLinkInput = z.infer<typeof projectLinkSchema>

/**
 * Schema for an array of project links.
 */
export const projectLinksArraySchema = z.array(projectLinkSchema)

// ========================================
// Legacy Links Format (backward compatibility)
// ========================================

/**
 * Old links format schema (for backward compatibility).
 * Used before the 55-preset system was implemented.
 */
const legacyLinksSchema = z.object({
  production: z.array(z.string()).optional(),
  tracking: z.array(z.string()).optional(),
  supabase: z.array(z.string()).optional(),
})

/**
 * Transform function to normalize legacy format to new format.
 */
function normalizeLegacyLinks(
  legacy: z.infer<typeof legacyLinksSchema>,
): ProjectLinkInput[] {
  const result: ProjectLinkInput[] = []

  if (legacy.production) {
    for (const url of legacy.production) {
      result.push({ type: 'production', url })
    }
  }
  if (legacy.tracking) {
    for (const url of legacy.tracking) {
      result.push({ type: 'tracking', url })
    }
  }
  if (legacy.supabase) {
    for (const url of legacy.supabase) {
      result.push({ type: 'supabase', url })
    }
  }

  return result
}

/**
 * Schema for links input that handles both old and new formats.
 * Transforms old format to new format automatically.
 *
 * @example
 * // New format (array)
 * linksInputSchema.parse([{ type: 'vercel', url: 'https://...' }])
 * // => [{ type: 'vercel', url: 'https://...' }]
 *
 * // Old format (object)
 * linksInputSchema.parse({ production: ['https://...'] })
 * // => [{ type: 'production', url: 'https://...' }]
 */
export const linksInputSchema = z
  .union([projectLinksArraySchema, legacyLinksSchema])
  .transform((val) => {
    // If it's already an array, it's new format
    if (Array.isArray(val)) {
      return val
    }
    // Otherwise, transform from legacy format
    return normalizeLegacyLinks(val)
  })

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validate note content and return result.
 * Drop-in replacement for the old validateNote function.
 *
 * @param note - Note content to validate
 * @returns Validation result with success/error
 */
export function validateNoteWithSchema(note: string): {
  success: boolean
  error?: string
} {
  const result = noteSchema.safeParse(note)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: result.error.issues[0]?.message }
}

/**
 * Validate comment content and return result.
 * Drop-in replacement for the old validateComment function.
 *
 * @param comment - Comment content to validate
 * @returns Validation result with success/error
 */
export function validateCommentWithSchema(comment: string): {
  success: boolean
  error?: string
} {
  const result = commentSchema.safeParse(comment)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: result.error.issues[0]?.message }
}

/**
 * Validate comment color and return result.
 * Drop-in replacement for the old validateCommentColor function.
 *
 * @param color - Color to validate
 * @returns Validation result with success/error
 */
export function validateCommentColorWithSchema(color: string): {
  success: boolean
  error?: string
} {
  const result = commentColorSchema.safeParse(color)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: result.error.issues[0]?.message }
}

/**
 * Validate URL and return result.
 * Drop-in replacement for the old validateUrl function.
 *
 * @param url - URL to validate
 * @returns Validation result with success/error
 */
export function validateUrlWithSchema(url: string): {
  success: boolean
  error?: string
} {
  const result = projectLinkUrlSchema.safeParse(url)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: result.error.issues[0]?.message }
}
