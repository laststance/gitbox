/**
 * Board Validation Schemas
 *
 * Zod schemas for validating board-related form inputs.
 */

import { z } from 'zod'

import { uuidSchema } from './common'

// ========================================
// Board Name Schema
// ========================================

/** Maximum character limit for board names */
export const BOARD_NAME_MAX_LENGTH = 50

/**
 * Schema for validating board names.
 *
 * @example
 * boardNameSchema.safeParse('My Board')    // => { success: true, data: 'My Board' }
 * boardNameSchema.safeParse('')            // => { success: false, error: ... }
 * boardNameSchema.safeParse('x'.repeat(51)) // => { success: false, error: ... }
 */
export const boardNameSchema = z
  .string()
  .trim()
  .min(1, 'Board name is required')
  .max(
    BOARD_NAME_MAX_LENGTH,
    `Board name must be ${BOARD_NAME_MAX_LENGTH} characters or less`,
  )

// ========================================
// Board Subtitle Schema
// ========================================

/** Maximum character limit for board subtitles */
export const BOARD_SUBTITLE_MAX_LENGTH = 100

/**
 * Schema for validating board subtitles.
 * Allows empty string (clears subtitle) or text up to 100 chars.
 *
 * @example
 * boardSubtitleSchema.safeParse('My project board')  // => { success: true, data: 'My project board' }
 * boardSubtitleSchema.safeParse('')                   // => { success: true, data: '' }
 * boardSubtitleSchema.safeParse('x'.repeat(101))      // => { success: false, error: ... }
 */
export const boardSubtitleSchema = z
  .string()
  .trim()
  .max(
    BOARD_SUBTITLE_MAX_LENGTH,
    `Subtitle must be ${BOARD_SUBTITLE_MAX_LENGTH} characters or less`,
  )

// ========================================
// Board ID Schema
// ========================================

/**
 * Schema for validating board IDs (UUID v4).
 *
 * @example
 * boardIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000') // => { success: true }
 * boardIdSchema.safeParse('invalid')                              // => { success: false }
 */
export const boardIdSchema = uuidSchema

// ========================================
// Board Settings Schema
// ========================================

/**
 * Schema for card display settings within board settings.
 */
const cardDisplaySettingsSchema = z.object({
  commentText: z
    .object({
      enabled: z.boolean().optional(),
      maxLength: z.number().int().positive().optional(),
    })
    .optional(),
})

/**
 * Schema for validating board settings.
 * Unknown properties are stripped for security (prevents arbitrary JSON injection).
 *
 * @example
 * boardSettingsSchema.safeParse({ cardDisplay: { commentText: { enabled: true } } })
 * // => { success: true }
 */
export const boardSettingsSchema = z.object({
  cardDisplay: cardDisplaySettingsSchema.optional(),
  showSubtitle: z.boolean().optional(),
})

// ========================================
// StatusList Schemas (P2-1, P2-4)
// ========================================

/** Maximum character limit for status list names */
export const STATUS_LIST_NAME_MAX_LENGTH = 50

/**
 * Schema for validating status list names.
 *
 * @example
 * statusListNameSchema.safeParse('In Progress') // => { success: true }
 * statusListNameSchema.safeParse('')             // => { success: false }
 */
export const statusListNameSchema = z
  .string()
  .trim()
  .min(1, 'Column name is required')
  .max(
    STATUS_LIST_NAME_MAX_LENGTH,
    `Column name must be ${STATUS_LIST_NAME_MAX_LENGTH} characters or less`,
  )

/**
 * Schema for validating status list color (hex format).
 *
 * @example
 * statusListColorSchema.safeParse('#6B7280') // => { success: true }
 * statusListColorSchema.safeParse('red')     // => { success: false }
 */
export const statusListColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #6B7280)')

/**
 * Schema for validating grid positions (non-negative integers).
 *
 * @example
 * gridPositionSchema.safeParse({ gridRow: 0, gridCol: 3 }) // => { success: true }
 * gridPositionSchema.safeParse({ gridRow: -1, gridCol: 0 }) // => { success: false }
 */
export const gridPositionSchema = z.object({
  gridRow: z.number().int().min(0, 'Grid row must be non-negative'),
  gridCol: z.number().int().min(0, 'Grid column must be non-negative'),
})

// ========================================
// Board Position Schema
// ========================================

/**
 * Schema for validating a single board position update.
 *
 * @example
 * boardPositionUpdateSchema.safeParse({ id: 'uuid', position: 0 }) // => { success: true }
 * boardPositionUpdateSchema.safeParse({ id: 'uuid', position: -1 }) // => { success: false }
 */
export const boardPositionUpdateSchema = z.object({
  // Use lenient UUID regex instead of z.string().uuid() which rejects
  // test seed UUIDs (version byte 0 not in RFC 4122 [1-8] range)
  id: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      'Invalid ID format',
    ),
  position: z.number().int().min(0, 'Position must be non-negative'),
})

/**
 * Schema for validating a batch of board position updates.
 *
 * @example
 * boardPositionUpdatesSchema.safeParse([
 *   { id: 'uuid-1', position: 0 },
 *   { id: 'uuid-2', position: 1 },
 * ]) // => { success: true }
 */
export const boardPositionUpdatesSchema = z
  .array(boardPositionUpdateSchema)
  .min(1, 'At least one position update is required')

// ========================================
// Form Schemas for Server Actions
// ========================================

/**
 * Schema for rename board form data.
 *
 * @example
 * renameBoardFormSchema.safeParse({ boardId: 'uuid', name: 'New Name' })
 */
export const renameBoardFormSchema = z.object({
  boardId: boardIdSchema,
  name: boardNameSchema,
})

/**
 * Schema for delete board form data.
 *
 * @example
 * deleteBoardFormSchema.safeParse({ boardId: 'uuid' })
 */
export const deleteBoardFormSchema = z.object({
  boardId: boardIdSchema,
})

/**
 * Schema for update settings form data.
 *
 * @example
 * updateSettingsFormSchema.safeParse({ boardId: 'uuid', settings: '{"cardDisplay":{}}' })
 */
export const updateSettingsFormSchema = z.object({
  boardId: boardIdSchema,
  settings: z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val)
      const result = boardSettingsSchema.safeParse(parsed)
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.error.issues.map((i) => i.message).join(', '),
        })
        return z.NEVER
      }
      return result.data
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid settings format',
      })
      return z.NEVER
    }
  }),
})
