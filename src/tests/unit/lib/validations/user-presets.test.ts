/**
 * User Presets Validation Schemas Tests
 */

import { describe, expect, test } from 'vitest'

import {
  MAX_LABEL_LENGTH,
  KEBAB_CASE_REGEX,
  presetValueSchema,
  presetLabelSchema,
  presetIconSchema,
  createPresetSchema,
  updatePresetSchema,
  validatePresetValueWithSchema,
  validatePresetLabelWithSchema,
} from '@/lib/validations/user-presets'

describe('KEBAB_CASE_REGEX', () => {
  test('matches valid kebab-case strings', () => {
    expect(KEBAB_CASE_REGEX.test('my-preset')).toBe(true)
    expect(KEBAB_CASE_REGEX.test('preset')).toBe(true)
    expect(KEBAB_CASE_REGEX.test('my-custom-preset')).toBe(true)
    expect(KEBAB_CASE_REGEX.test('preset123')).toBe(true)
    expect(KEBAB_CASE_REGEX.test('my-preset-2')).toBe(true)
  })

  test('rejects invalid strings', () => {
    expect(KEBAB_CASE_REGEX.test('My-Preset')).toBe(false) // Uppercase
    expect(KEBAB_CASE_REGEX.test('my_preset')).toBe(false) // Underscore
    expect(KEBAB_CASE_REGEX.test('my preset')).toBe(false) // Space
    expect(KEBAB_CASE_REGEX.test('-my-preset')).toBe(false) // Leading hyphen
    expect(KEBAB_CASE_REGEX.test('my-preset-')).toBe(false) // Trailing hyphen
    expect(KEBAB_CASE_REGEX.test('')).toBe(false) // Empty
  })
})

describe('presetValueSchema', () => {
  test('accepts valid kebab-case value', () => {
    const result = presetValueSchema.safeParse('my-custom-preset')
    expect(result.success).toBe(true)
    expect(result.data).toBe('my-custom-preset')
  })

  test('accepts single word', () => {
    const result = presetValueSchema.safeParse('preset')
    expect(result.success).toBe(true)
  })

  test('rejects empty string', () => {
    const result = presetValueSchema.safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('required')
  })

  test('rejects uppercase letters', () => {
    const result = presetValueSchema.safeParse('My-Preset')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('kebab-case')
  })

  test('rejects built-in preset values', () => {
    const result = presetValueSchema.safeParse('vercel')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('built-in')
  })

  test('rejects built-in preset: sentry', () => {
    const result = presetValueSchema.safeParse('sentry')
    expect(result.success).toBe(false)
  })

  test('rejects built-in preset: notion', () => {
    const result = presetValueSchema.safeParse('notion')
    expect(result.success).toBe(false)
  })
})

describe('presetLabelSchema', () => {
  test('accepts valid label', () => {
    const result = presetLabelSchema.safeParse('My Custom Service')
    expect(result.success).toBe(true)
    expect(result.data).toBe('My Custom Service')
  })

  test('trims whitespace', () => {
    const result = presetLabelSchema.safeParse('  My Label  ')
    expect(result.success).toBe(true)
    expect(result.data).toBe('My Label')
  })

  test('rejects empty string', () => {
    const result = presetLabelSchema.safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('required')
  })

  test('rejects whitespace-only string', () => {
    const result = presetLabelSchema.safeParse('   ')
    expect(result.success).toBe(false)
  })

  test(`rejects label exceeding ${MAX_LABEL_LENGTH} characters`, () => {
    const longLabel = 'x'.repeat(MAX_LABEL_LENGTH + 1)
    const result = presetLabelSchema.safeParse(longLabel)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('50')
  })

  test(`accepts label at exactly ${MAX_LABEL_LENGTH} characters`, () => {
    const maxLabel = 'x'.repeat(MAX_LABEL_LENGTH)
    const result = presetLabelSchema.safeParse(maxLabel)
    expect(result.success).toBe(true)
  })
})

describe('presetIconSchema', () => {
  test('accepts icon name', () => {
    const result = presetIconSchema.safeParse('Star')
    expect(result.success).toBe(true)
    expect(result.data).toBe('Star')
  })

  test('defaults to Link when undefined', () => {
    const result = presetIconSchema.safeParse(undefined)
    expect(result.success).toBe(true)
    expect(result.data).toBe('Link')
  })
})

describe('createPresetSchema', () => {
  test('accepts valid create input', () => {
    const result = createPresetSchema.safeParse({
      label: 'My Service',
      icon: 'Star',
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ label: 'My Service', icon: 'Star' })
  })

  test('applies default icon when not provided', () => {
    const result = createPresetSchema.safeParse({
      label: 'My Service',
    })
    expect(result.success).toBe(true)
    expect(result.data?.icon).toBe('Link')
  })

  test('rejects missing label', () => {
    const result = createPresetSchema.safeParse({
      icon: 'Star',
    })
    expect(result.success).toBe(false)
  })
})

describe('updatePresetSchema', () => {
  test('accepts partial update with label only', () => {
    const result = updatePresetSchema.safeParse({
      label: 'Updated Name',
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ label: 'Updated Name' })
  })

  test('accepts partial update with icon only', () => {
    const result = updatePresetSchema.safeParse({
      icon: 'Heart',
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ icon: 'Heart' })
  })

  test('accepts empty object', () => {
    const result = updatePresetSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('validatePresetValueWithSchema', () => {
  test('returns success for valid value', () => {
    const result = validatePresetValueWithSchema('my-preset')
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('returns error for invalid value', () => {
    const result = validatePresetValueWithSchema('Invalid Value')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('returns error for built-in preset', () => {
    const result = validatePresetValueWithSchema('vercel')
    expect(result.success).toBe(false)
    expect(result.error).toContain('built-in')
  })
})

describe('validatePresetLabelWithSchema', () => {
  test('returns success for valid label', () => {
    const result = validatePresetLabelWithSchema('My Label')
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('returns error for empty label', () => {
    const result = validatePresetLabelWithSchema('')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
