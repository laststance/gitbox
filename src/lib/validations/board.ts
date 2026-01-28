/**
 * Board Validation Schemas
 *
 * Zod schemas for validating board-related form inputs.
 */

import { z } from 'zod'

import { ALL_THEME_IDS } from '@/lib/constants/themes'

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
// Theme Schema
// ========================================

/**
 * Schema for validating theme IDs.
 * Uses the centralized ALL_THEME_IDS constant from themes.ts.
 *
 * @example
 * themeSchema.safeParse('midnight') // => { success: true, data: 'midnight' }
 * themeSchema.safeParse('invalid')  // => { success: false, error: 'Invalid theme' }
 */
export const themeSchema = z.enum(ALL_THEME_IDS, {
  message: 'Invalid theme',
})

// ========================================
// Board Settings Schema
// ========================================

/**
 * Schema for card display settings within board settings.
 */
const cardDisplaySettingsSchema = z
  .object({
    commentText: z
      .object({
        enabled: z.boolean().optional(),
        maxLength: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .passthrough()

/**
 * Schema for validating board settings.
 * Uses passthrough() to allow additional properties for future extensibility.
 *
 * @example
 * boardSettingsSchema.safeParse({ cardDisplay: { commentText: { enabled: true } } })
 * // => { success: true }
 */
export const boardSettingsSchema = z
  .object({
    cardDisplay: cardDisplaySettingsSchema.optional(),
  })
  .passthrough()

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
 * Schema for update theme form data.
 *
 * @example
 * updateThemeFormSchema.safeParse({ boardId: 'uuid', theme: 'midnight' })
 */
export const updateThemeFormSchema = z.object({
  boardId: boardIdSchema,
  theme: themeSchema,
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
