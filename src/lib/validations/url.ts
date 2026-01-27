/**
 * URL Validation Utility
 *
 * Provides URL validation with security constraints for EditableUrlItem.
 * Features:
 * - Protocol whitelist (http/https only) to block XSS vectors
 * - Max length enforcement (browser limit)
 * - Return format compatible with inline validation UI
 *
 * @example
 * isValidUrl('https://example.com') // => { valid: true }
 * isValidUrl('javascript:alert(1)') // => { valid: false, error: 'URL must start with http:// or https://' }
 * isValidUrl('x'.repeat(2084)) // => { valid: false, error: 'URL too long (max 2083 characters)' }
 */

/** Maximum URL length (browser limit) */
export const MAX_URL_LENGTH = 2083

/** Protocol whitelist regex - blocks javascript:, data:, vbscript:, file: etc. */
const ALLOWED_PROTOCOLS = /^https?:\/\//i

/**
 * Validates a URL with security constraints.
 *
 * @param url - URL to validate
 * @returns Validation result with success/error
 *
 * @example
 * isValidUrl('https://github.com') // => { valid: true }
 * isValidUrl('') // => { valid: true } (empty allowed)
 * isValidUrl('ftp://server.com') // => { valid: false, error: 'URL must start with http:// or https://' }
 */
export const isValidUrl = (url: string): { valid: boolean; error?: string } => {
  const trimmed = url.trim()

  // Empty is allowed (will be filtered out on save)
  if (!trimmed) {
    return { valid: true }
  }

  // Check max length
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `URL too long (max ${MAX_URL_LENGTH} characters)`,
    }
  }

  // Check protocol whitelist (blocks XSS vectors like javascript:, data:, vbscript:)
  if (!ALLOWED_PROTOCOLS.test(trimmed)) {
    return {
      valid: false,
      error: 'URL must start with http:// or https://',
    }
  }

  // Validate URL format
  try {
    new URL(trimmed)
    return { valid: true }
  } catch {
    return {
      valid: false,
      error: 'Please enter a valid URL',
    }
  }
}
