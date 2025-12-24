/**
 * Board Validation Schemas
 *
 * Zod schemas for validating board-related form inputs.
 */

import { z } from 'zod'

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
  .min(1, 'Board name is required')
  .max(
    BOARD_NAME_MAX_LENGTH,
    `Board name must be ${BOARD_NAME_MAX_LENGTH} characters or less`,
  )
  .trim()

export type BoardNameInput = z.infer<typeof boardNameSchema>
