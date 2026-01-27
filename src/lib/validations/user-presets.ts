/**
 * User Presets Validation Schemas
 *
 * Zod schemas for validating user-defined link type presets.
 */

import { z } from 'zod'

import { isBuiltInPreset } from '@/lib/constants/link-presets'

// ========================================
// Constants
// ========================================

/** Maximum number of custom presets per user */
export const MAX_CUSTOM_PRESETS = 50

/** Maximum label length */
export const MAX_LABEL_LENGTH = 50

/** Valid kebab-case pattern */
export const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ========================================
// Preset Value Schema
// ========================================

/**
 * Schema for validating preset value (kebab-case identifier).
 *
 * @example
 * presetValueSchema.safeParse('my-custom-preset') // => { success: true }
 * presetValueSchema.safeParse('My Preset')        // => { success: false }
 * presetValueSchema.safeParse('vercel')           // => { success: false } (built-in)
 */
export const presetValueSchema = z
  .string()
  .min(1, 'Value is required')
  .regex(
    KEBAB_CASE_REGEX,
    'Value must be in kebab-case format (lowercase letters, numbers, and hyphens)',
  )
  .refine((val) => !isBuiltInPreset(val), {
    message: 'Cannot use a built-in preset value',
  })

// ========================================
// Preset Label Schema
// ========================================

/**
 * Schema for validating preset label (display name).
 *
 * @example
 * presetLabelSchema.safeParse('My Custom Service') // => { success: true }
 * presetLabelSchema.safeParse('')                   // => { success: false }
 * presetLabelSchema.safeParse('x'.repeat(51))       // => { success: false }
 */
export const presetLabelSchema = z
  .string()
  .trim()
  .min(1, 'Label is required')
  .max(MAX_LABEL_LENGTH, `Label must be ${MAX_LABEL_LENGTH} characters or less`)

// ========================================
// Preset Icon Schema
// ========================================

/**
 * Schema for validating preset icon name.
 * Icons are optional and default to 'Link'.
 *
 * @example
 * presetIconSchema.safeParse('Star')     // => { success: true }
 * presetIconSchema.safeParse(undefined)  // => { success: true, data: 'Link' }
 */
export const presetIconSchema = z.string().optional().default('Link')

// ========================================
// Complete Preset Schema
// ========================================

/**
 * Schema for creating a new user preset.
 *
 * @example
 * createPresetSchema.safeParse({ label: 'My Service', icon: 'Star' })
 * // => { success: true, data: { label: 'My Service', icon: 'Star' } }
 */
export const createPresetSchema = z.object({
  label: presetLabelSchema,
  icon: presetIconSchema,
})

/**
 * Schema for updating an existing user preset.
 * All fields are optional.
 *
 * @example
 * updatePresetSchema.safeParse({ label: 'Updated Name' })
 * // => { success: true, data: { label: 'Updated Name' } }
 */
export const updatePresetSchema = z.object({
  label: presetLabelSchema.optional(),
  icon: z.string().optional(),
})

// ========================================
// Validation Helper Functions (backward compatibility)
// ========================================

/**
 * Validate preset value and return result.
 *
 * @param value - Value to validate
 * @returns Validation result with success/error
 */
export function validatePresetValueWithSchema(value: string): {
  success: boolean
  error?: string
} {
  const result = presetValueSchema.safeParse(value)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: result.error.issues[0]?.message }
}

/**
 * Validate preset label and return result.
 *
 * @param label - Label to validate
 * @returns Validation result with success/error
 */
export function validatePresetLabelWithSchema(label: string): {
  success: boolean
  error?: string
} {
  const result = presetLabelSchema.safeParse(label)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: result.error.issues[0]?.message }
}
