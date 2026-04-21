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
 * @example
 * ```ts
 * // Read-only (no rate limit)
 * export const getPresets = () =>
 *   withAuthResult(async (supabase, user) => { ... })
 *
 * // Mutation (rate limited, returns ActionResult)
 * export const createBoard = (name: string) =>
 *   withAuthResultRateLimit('boardCrud', async (supabase, user) => { ... })
 *
 * // DnD (rate limited, throws for try/catch rollback)
 * export const batchUpdate = (updates: ...) =>
 *   withAuthRateLimit('batchDnD', async (supabase, user) => { ... })
 * ```
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import { checkRateLimit } from '@/lib/rate-limit/check'
import type { RateLimitKey } from '@/lib/rate-limit/config'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

import type { ActionResult } from './types'

type AuthedAction<T> = (
  supabase: SupabaseClient<Database>,
  user: User,
) => Promise<T>

/**
 * Resolve the current authenticated user, returning `null` when unauthenticated.
 * Centralizes the `supabase.auth.getUser()` pattern used by all guards.
 */
async function getAuthedContext(): Promise<{
  supabase: SupabaseClient<Database>
  user: User
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return { supabase, user }
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
    const data = await action(ctx.supabase, ctx.user)
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

  const rlResult = checkRateLimit(rateLimitKey, ctx.user.id)
  if (!rlResult.allowed) {
    return { success: false, error: rlResult.error! }
  }

  try {
    const data = await action(ctx.supabase, ctx.user)
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

  const rlResult = checkRateLimit(rateLimitKey, ctx.user.id)
  if (!rlResult.allowed) throw new Error(rlResult.error!)

  return action(ctx.supabase, ctx.user)
}
