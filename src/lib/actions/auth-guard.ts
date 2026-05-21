/**
 * Authentication Guard for Server Actions
 *
 * Three wrappers for different use cases:
 *
 * | Wrapper                  | Returns          | Rate Limit | Use Case                    |
 * |--------------------------|------------------|------------|-----------------------------|
 * | `withAuthResult<T>`      | `ActionResult<T>`| No         | Read-only operations        |
 * | `withAuthResultRateLimit` | `ActionResult<T>`| Yes        | All mutations               |
 * | `withAuthRateLimit<T>`   | `T` (throws)     | Yes        | DnD optimistic ops (throw)  |
 *
 * Identity comes from `getCachedClaims()` (JWKS-verified JWT) instead of
 * `getUser()` (Auth server round-trip). The action callback receives
 * `claims` instead of `user`; use `claims.sub` for the user UUID.
 *
 * @example
 * ```ts
 * // Read-only (no rate limit)
 * export const getPresets = () =>
 *   withAuthResult(async (supabase, claims) => { ... })
 *
 * // Mutation (rate limited, returns ActionResult)
 * export const createBoard = (name: string) =>
 *   withAuthResultRateLimit('boardCrud', async (supabase, claims) => { ... })
 *
 * // DnD (rate limited, throws for try/catch rollback)
 * export const batchUpdate = (updates: ...) =>
 *   withAuthRateLimit('batchDnD', async (supabase, claims) => { ... })
 * ```
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getCachedClaims,
  type SupabaseClaims,
} from '@/lib/auth/get-cached-claims'
import { checkRateLimit } from '@/lib/rate-limit/check'
import type { RateLimitKey } from '@/lib/rate-limit/config'
import type { Database } from '@/lib/supabase/types'

import type { ActionResult } from './types'

type AuthedAction<T> = (
  supabase: SupabaseClient<Database>,
  claims: SupabaseClaims,
) => Promise<T>

/**
 * Resolve the current authenticated claims, returning `null` when unauthenticated.
 * Centralizes the JWKS-verified `getClaims()` pattern used by all guards.
 */
async function getAuthedContext(): Promise<{
  supabase: SupabaseClient<Database>
  claims: SupabaseClaims
} | null> {
  return getCachedClaims()
}

// Always return a generic message to clients — Sentry.captureException
// preserves the original error for debugging without leaking stack traces,
// internal table names, or DB error strings to the browser.
function toErrorMessage(): string {
  return 'An unexpected error occurred'
}

/**
 * Wraps a Server Action with authentication (no rate limiting).
 * Returns ActionResult<T> (does not throw).
 *
 * Use this for read-only server actions that need auth but not rate limiting.
 */
export async function withAuthResult<T>(
  action: AuthedAction<T>,
): Promise<ActionResult<T>> {
  const ctx = await getAuthedContext()
  if (!ctx) return { success: false, error: 'Authentication required' }

  try {
    const data = await action(ctx.supabase, ctx.claims)
    return { success: true, data }
  } catch (error) {
    Sentry.captureException(error, { extra: { context: 'withAuthResult' } })
    return { success: false, error: toErrorMessage() }
  }
}

/**
 * Wraps a Server Action with authentication AND rate limiting.
 * Returns ActionResult<T> (does not throw).
 *
 * Combines auth check → rate limit check → action execution.
 * Use this for mutation server actions that need abuse protection.
 */
export async function withAuthResultRateLimit<T>(
  rateLimitKey: RateLimitKey,
  action: AuthedAction<T>,
): Promise<ActionResult<T>> {
  const ctx = await getAuthedContext()
  if (!ctx) return { success: false, error: 'Authentication required' }

  const rlResult = checkRateLimit(rateLimitKey, ctx.claims.sub)
  if (!rlResult.allowed) {
    return { success: false, error: rlResult.error! }
  }

  try {
    const data = await action(ctx.supabase, ctx.claims)
    return { success: true, data }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: `withAuthResultRateLimit:${rateLimitKey}` },
    })
    return { success: false, error: toErrorMessage() }
  }
}

/**
 * Wraps a Server Action with authentication AND rate limiting.
 * Throws on auth/rate-limit failure (for actions that use throw-based error handling).
 *
 * @throws {Error} 'Authentication required' or rate limit error message
 */
export async function withAuthRateLimit<T>(
  rateLimitKey: RateLimitKey,
  action: AuthedAction<T>,
): Promise<T> {
  const ctx = await getAuthedContext()
  if (!ctx) throw new Error('Authentication required')

  const rlResult = checkRateLimit(rateLimitKey, ctx.claims.sub)
  if (!rlResult.allowed) throw new Error(rlResult.error!)

  return action(ctx.supabase, ctx.claims)
}
