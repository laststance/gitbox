/**
 * Board Validation Schemas Tests
 */

import { describe, expect, test } from 'vitest'

import {
  BOARD_NAME_MAX_LENGTH,
  boardNameSchema,
  boardIdSchema,
  themeSchema,
  boardSettingsSchema,
} from '@/lib/validations/board'

describe('boardNameSchema', () => {
  test('accepts valid board name', () => {
    const result = boardNameSchema.safeParse('My Board')
    expect(result.success).toBe(true)
    expect(result.data).toBe('My Board')
  })

  test('trims whitespace from board name', () => {
    const result = boardNameSchema.safeParse('  My Board  ')
    expect(result.success).toBe(true)
    expect(result.data).toBe('My Board')
  })

  test('rejects empty string', () => {
    const result = boardNameSchema.safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('required')
  })

  test('rejects whitespace-only string', () => {
    const result = boardNameSchema.safeParse('   ')
    expect(result.success).toBe(false)
  })

  test(`rejects name exceeding ${BOARD_NAME_MAX_LENGTH} characters`, () => {
    const longName = 'x'.repeat(BOARD_NAME_MAX_LENGTH + 1)
    const result = boardNameSchema.safeParse(longName)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('50')
  })

  test(`accepts name at exactly ${BOARD_NAME_MAX_LENGTH} characters`, () => {
    const maxName = 'x'.repeat(BOARD_NAME_MAX_LENGTH)
    const result = boardNameSchema.safeParse(maxName)
    expect(result.success).toBe(true)
  })
})

describe('boardIdSchema', () => {
  test('accepts valid UUID', () => {
    const result = boardIdSchema.safeParse(
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(result.success).toBe(true)
  })

  test('rejects invalid UUID', () => {
    const result = boardIdSchema.safeParse('invalid-id')
    expect(result.success).toBe(false)
  })
})

describe('themeSchema', () => {
  const validThemes = [
    'default',
    'sunrise',
    'sandstone',
    'mint',
    'sky',
    'lavender',
    'rose',
    'dark',
    'midnight',
    'graphite',
    'forest',
    'ocean',
    'plum',
    'rust',
  ]

  test.each(validThemes)('accepts valid theme: %s', (theme) => {
    const result = themeSchema.safeParse(theme)
    expect(result.success).toBe(true)
    expect(result.data).toBe(theme)
  })

  test('rejects invalid theme', () => {
    const result = themeSchema.safeParse('invalid-theme')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Invalid theme')
  })
})

describe('boardSettingsSchema', () => {
  test('accepts valid settings with cardDisplay', () => {
    const result = boardSettingsSchema.safeParse({
      cardDisplay: {
        commentText: {
          enabled: true,
          maxLength: 100,
        },
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts empty object', () => {
    const result = boardSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test('accepts partial cardDisplay settings', () => {
    const result = boardSettingsSchema.safeParse({
      cardDisplay: {
        commentText: {
          enabled: true,
        },
      },
    })
    expect(result.success).toBe(true)
  })

  test('passes through additional properties', () => {
    const result = boardSettingsSchema.safeParse({
      cardDisplay: {},
      futureFeature: 'value',
    })
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('futureFeature')
  })
})
