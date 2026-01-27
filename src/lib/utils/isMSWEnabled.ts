/**
 * MSW Activation Logic
 *
 * Determines whether Mock Service Worker should be enabled.
 * Uses asymmetric logic for client vs server to prevent accidental production activation.
 *
 * @description
 * - Client-side: Only checks NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true'
 *   (Simple check to prevent hydration mismatches)
 * - Server-side: ALSO requires APP_ENV === 'test' OR NODE_ENV === 'test'
 *   (Double-check to prevent production activation even if env var is misconfigured)
 *
 * @returns {boolean} Whether MSW should be enabled
 *
 * @example
 * // Client-side: NEXT_PUBLIC_ENABLE_MSW_MOCK='true' -> true
 * // Server-side: NEXT_PUBLIC_ENABLE_MSW_MOCK='true' + APP_ENV='test' -> true
 * // Server-side: NEXT_PUBLIC_ENABLE_MSW_MOCK='true' + APP_ENV='production' -> false (safety)
 */
import { env } from '@/lib/env'

export function isMSWEnabled(): boolean {
  // Client-side: Simple check to avoid hydration mismatches
  // env.NEXT_PUBLIC_ENABLE_MSW_MOCK is transformed to boolean by t3-env
  if (typeof window !== 'undefined') {
    return env.NEXT_PUBLIC_ENABLE_MSW_MOCK === true
  }

  // Server-side: Double-check to prevent accidental production activation
  // Even if NEXT_PUBLIC_ENABLE_MSW_MOCK is accidentally set to 'true' in production,
  // MSW will NOT activate unless APP_ENV or NODE_ENV is explicitly 'test'
  return (
    env.NEXT_PUBLIC_ENABLE_MSW_MOCK === true &&
    (env.APP_ENV === 'test' || process.env.NODE_ENV === 'test')
  )
}
