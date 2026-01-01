/**
 * Common Validation Schemas
 *
 * Shared schemas used across multiple validation modules.
 */

import { z } from 'zod'

/**
 * UUID v4 schema for database IDs
 *
 * @example
 * uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000') // => { success: true }
 * uuidSchema.safeParse('invalid')                              // => { success: false }
 */
export const uuidSchema = z.string().uuid('Invalid ID format')

export type UuidInput = z.infer<typeof uuidSchema>

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

export type UrlInput = z.infer<typeof urlSchema>

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

export type OptionalUrlInput = z.infer<typeof optionalUrlSchema>
