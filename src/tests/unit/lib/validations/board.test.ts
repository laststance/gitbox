/**
 * Board Validation Schemas Tests
 */

import { describe, expect, test } from 'vitest'

import {
  BOARD_NAME_MAX_LENGTH,
  boardNameSchema,
  boardIdSchema,
  boardSettingsSchema,
  renameBoardFormSchema,
  deleteBoardFormSchema,
  updateSettingsFormSchema,
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

describe('renameBoardFormSchema', () => {
  const validBoardId = '550e8400-e29b-41d4-a716-446655440000'

  test('accepts valid rename data', () => {
    const result = renameBoardFormSchema.safeParse({
      boardId: validBoardId,
      name: 'New Board Name',
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid board ID', () => {
    const result = renameBoardFormSchema.safeParse({
      boardId: 'invalid',
      name: 'New Name',
    })
    expect(result.success).toBe(false)
  })

  test('rejects empty name', () => {
    const result = renameBoardFormSchema.safeParse({
      boardId: validBoardId,
      name: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('deleteBoardFormSchema', () => {
  test('accepts valid board ID', () => {
    const result = deleteBoardFormSchema.safeParse({
      boardId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid board ID', () => {
    const result = deleteBoardFormSchema.safeParse({
      boardId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateSettingsFormSchema', () => {
  const validBoardId = '550e8400-e29b-41d4-a716-446655440000'

  test('accepts valid JSON settings string', () => {
    const settings = JSON.stringify({
      cardDisplay: {
        commentText: {
          enabled: true,
          maxLength: 100,
        },
      },
    })

    const result = updateSettingsFormSchema.safeParse({
      boardId: validBoardId,
      settings,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.settings).toEqual({
        cardDisplay: {
          commentText: {
            enabled: true,
            maxLength: 100,
          },
        },
      })
    }
  })

  test('accepts empty object settings', () => {
    const result = updateSettingsFormSchema.safeParse({
      boardId: validBoardId,
      settings: '{}',
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid JSON string', () => {
    const result = updateSettingsFormSchema.safeParse({
      boardId: validBoardId,
      settings: 'not valid json',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain(
        'Invalid settings format',
      )
    }
  })

  test('rejects invalid settings structure', () => {
    // Create settings with invalid cardDisplay structure
    const settings = JSON.stringify({
      cardDisplay: {
        commentText: {
          maxLength: -1, // Invalid: should be positive
        },
      },
    })

    const result = updateSettingsFormSchema.safeParse({
      boardId: validBoardId,
      settings,
    })

    expect(result.success).toBe(false)
  })

  test('passes through additional properties in settings', () => {
    const settings = JSON.stringify({
      cardDisplay: {},
      customProperty: 'value',
    })

    const result = updateSettingsFormSchema.safeParse({
      boardId: validBoardId,
      settings,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.settings).toHaveProperty('customProperty')
    }
  })
})
