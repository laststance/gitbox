/**
 * Validation Helper Functions
 *
 * Utilities for extracting and formatting Zod validation errors.
 * Compatible with useActionState error response patterns.
 */

import type { z } from 'zod'

/**
 * Extract error messages grouped by field from ZodError
 *
 * Replaces deprecated `.flatten().fieldErrors` pattern.
 * Returns format compatible with useActionState: { fieldName: string[] }
 *
 * @param error - ZodError instance from safeParse
 * @returns Record mapping field names to error message arrays
 *
 * @example
 * const result = schema.safeParse(data)
 * if (!result.success) {
 *   return { errors: toFieldErrors(result.error) }
 * }
 * // => { errors: { name: ['Required'], email: ['Invalid email'] } }
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]?.toString() || '_root'
    if (!fieldErrors[field]) {
      fieldErrors[field] = []
    }
    fieldErrors[field].push(issue.message)
  }

  return fieldErrors
}

/**
 * Get root-level errors (errors without field path)
 *
 * Replaces deprecated `.flatten().formErrors` pattern.
 * Used for simple schema validation (e.g., z.string())
 *
 * @param error - ZodError instance from safeParse
 * @returns Array of error messages for root-level issues
 *
 * @example
 * const result = boardNameSchema.safeParse('')
 * if (!result.success) {
 *   return { errors: { name: getRootErrors(result.error) } }
 * }
 * // => { errors: { name: ['Board name is required'] } }
 */
export function getRootErrors(error: z.ZodError): string[] {
  return error.issues
    .filter((issue) => issue.path.length === 0)
    .map((issue) => issue.message)
}

/**
 * Get all error messages flattened into a single array
 *
 * Useful for displaying validation errors in a simple list.
 *
 * @param error - ZodError instance from safeParse
 * @returns Array of all error messages
 *
 * @example
 * const result = schema.safeParse(data)
 * if (!result.success) {
 *   return { error: getAllErrors(result.error).join(', ') }
 * }
 */
export function getAllErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message)
}

/**
 * Get first error message from ZodError
 *
 * Convenient for displaying a single error message.
 *
 * @param error - ZodError instance from safeParse
 * @returns First error message or undefined if no errors
 *
 * @example
 * const result = schema.safeParse(data)
 * if (!result.success) {
 *   setError(getFirstError(result.error))
 * }
 */
export function getFirstError(error: z.ZodError): string | undefined {
  return error.issues[0]?.message
}
