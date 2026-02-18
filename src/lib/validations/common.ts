/**
 * Common Validation Schemas
 *
 * Shared schemas used across multiple validation modules.
 */

import { z } from 'zod'

/**
 * UUID schema for database IDs
 *
 * Accepts any UUID format (v1-v5 and nil) — not restricted to v4 only.
 * Zod's built-in .uuid() rejects valid non-v4 UUIDs (e.g. deterministic test IDs),
 * so we use a format-only regex: 8-4-4-4-12 hex chars.
 *
 * @example
 * uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000') // => { success: true }
 * uuidSchema.safeParse('00000000-0000-0000-0000-000000000100') // => { success: true }
 * uuidSchema.safeParse('invalid')                              // => { success: false }
 */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Invalid ID format',
  )

/**
 * URL schema with http/https protocol validation
 *
 * @example
 * urlSchema.safeParse('https://example.com') // => { success: true }
 * urlSchema.safeParse('ftp://example.com')   // => { success: false }
 * urlSchema.safeParse('invalid')             // => { success: false }
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL must start with http:// or https://',
  )

/**
 * Optional URL schema that allows empty strings
 *
 * Used for form fields where URL is optional.
 * Empty strings are transformed to undefined.
 *
 * @example
 * optionalUrlSchema.safeParse('https://example.com') // => { success: true, data: 'https://example.com' }
 * optionalUrlSchema.safeParse('')                     // => { success: true, data: undefined }
 */
export const optionalUrlSchema = z
  .string()
  .transform((val) => (val === '' ? undefined : val))
  .pipe(urlSchema.optional())
