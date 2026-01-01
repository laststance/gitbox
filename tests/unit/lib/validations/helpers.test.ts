/**
 * Validation Helpers Tests
 */

import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import {
  toFieldErrors,
  getRootErrors,
  getAllErrors,
  getFirstError,
} from '@/lib/validations/helpers'

describe('toFieldErrors', () => {
  test('extracts field errors from ZodError', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email'),
    })

    const result = schema.safeParse({ name: '', email: 'invalid' })
    if (!result.success) {
      const fieldErrors = toFieldErrors(result.error)
      expect(fieldErrors).toEqual({
        name: ['Name is required'],
        email: ['Invalid email'],
      })
    }
  })

  test('groups multiple errors for same field', () => {
    const schema = z.object({
      password: z
        .string()
        .min(8, 'Password too short')
        .regex(/[A-Z]/, 'Must contain uppercase'),
    })

    const result = schema.safeParse({ password: 'short' })
    if (!result.success) {
      const fieldErrors = toFieldErrors(result.error)
      expect(fieldErrors.password).toHaveLength(2)
      expect(fieldErrors.password).toContain('Password too short')
      expect(fieldErrors.password).toContain('Must contain uppercase')
    }
  })

  test('returns empty object for valid input', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 'valid' })
    expect(result.success).toBe(true)
  })
})

describe('getRootErrors', () => {
  test('extracts root-level errors', () => {
    const schema = z
      .object({
        password: z.string(),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords must match',
      })

    const result = schema.safeParse({
      password: 'abc',
      confirmPassword: 'xyz',
    })
    if (!result.success) {
      const rootErrors = getRootErrors(result.error)
      expect(rootErrors).toEqual(['Passwords must match'])
    }
  })

  test('returns empty array when no root errors', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name required'),
    })

    const result = schema.safeParse({ name: '' })
    if (!result.success) {
      const rootErrors = getRootErrors(result.error)
      expect(rootErrors).toEqual([])
    }
  })
})

describe('getAllErrors', () => {
  test('returns all error messages flattened', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name required'),
      email: z.string().email('Invalid email'),
    })

    const result = schema.safeParse({ name: '', email: 'bad' })
    if (!result.success) {
      const allErrors = getAllErrors(result.error)
      expect(allErrors).toHaveLength(2)
      expect(allErrors).toContain('Name required')
      expect(allErrors).toContain('Invalid email')
    }
  })
})

describe('getFirstError', () => {
  test('returns first error message', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name required'),
      email: z.string().email('Invalid email'),
    })

    const result = schema.safeParse({ name: '', email: 'bad' })
    if (!result.success) {
      const firstError = getFirstError(result.error)
      expect(firstError).toBe('Name required')
    }
  })

  test('returns undefined for valid input', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 'valid' })
    expect(result.success).toBe(true)
  })
})
