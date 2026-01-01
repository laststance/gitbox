/**
 * Common Validation Schemas Tests
 */

import { describe, expect, test } from 'vitest'

import {
  uuidSchema,
  urlSchema,
  optionalUrlSchema,
} from '@/lib/validations/common'

describe('uuidSchema', () => {
  test('accepts valid UUID v4', () => {
    const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
  })

  test('rejects invalid UUID', () => {
    const result = uuidSchema.safeParse('not-a-uuid')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Invalid')
  })

  test('rejects empty string', () => {
    const result = uuidSchema.safeParse('')
    expect(result.success).toBe(false)
  })
})

describe('urlSchema', () => {
  test('accepts valid https URL', () => {
    const result = urlSchema.safeParse('https://example.com')
    expect(result.success).toBe(true)
  })

  test('accepts valid http URL', () => {
    const result = urlSchema.safeParse('http://localhost:3000')
    expect(result.success).toBe(true)
  })

  test('rejects invalid URL format', () => {
    const result = urlSchema.safeParse('not-a-url')
    expect(result.success).toBe(false)
  })

  test('rejects ftp protocol', () => {
    const result = urlSchema.safeParse('ftp://example.com')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('http')
  })
})

describe('optionalUrlSchema', () => {
  test('accepts valid URL', () => {
    const result = optionalUrlSchema.safeParse('https://example.com')
    expect(result.success).toBe(true)
    expect(result.data).toBe('https://example.com')
  })

  test('transforms empty string to undefined', () => {
    const result = optionalUrlSchema.safeParse('')
    expect(result.success).toBe(true)
    expect(result.data).toBeUndefined()
  })

  test('rejects invalid non-empty URL', () => {
    const result = optionalUrlSchema.safeParse('not-a-url')
    expect(result.success).toBe(false)
  })
})
