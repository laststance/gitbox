/**
 * Authentication Guard for Server Actions
 *
 * Provides a reusable `withAuth` wrapper that handles Supabase client creation
 * and user authentication, eliminating the repeated 4-line auth boilerplate
 * across all Server Actions.
 *
 * @example
 * ```ts
 * // Before: repeated in every action
 * const supabase = await createClient()
 * const { data: { user }, error } = await supabase.auth.getUser()
 * if (error || !user) throw new Error('Authentication required')
 *
 * // After: single-line wrapper
 * export const deleteBoard = (id: string) =>
 *   withAuth(async (supabase, user) => { ... })
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

/**
 * Wraps a Server Action with authentication, providing an authenticated
 * Supabase client and the current user.
 *
 * @param action - Async function receiving authenticated supabase client and user
 * @returns The action's return value, or throws if not authenticated
 * @throws {Error} 'Authentication required' when user is not logged in
 *
 * @example
 * export const createBoard = (name: string) =>
 *   withAuth(async (supabase, user) => {
 *     const { data, error } = await supabase
 *       .from('board')
 *       .insert({ name, user_id: user.id })
 *     if (error) throw error
 *     return data
 *   })
 */
export async function withAuth<T>(
  action: (supabase: SupabaseClient<Database>, user: User) => Promise<T>,
): Promise<T> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Authentication required')
  }

  return action(supabase, user)
}

/**
 * Wraps a Server Action with authentication AND rate limiting.
 * Returns ActionResult<T> (does not throw).
 *
 * Combines auth check → rate limit check → action execution.
 * Use this for mutation server actions that need abuse protection.
 *
 * @param rateLimitKey - Rate limit configuration key
 * @param action - Async function receiving authenticated supabase client and user
 * @returns ActionResult<T> with success/data or error
 *
 * @example
 * export const createBoard = (name: string) =>
 *   withAuthResultRateLimit('boardCrud', async (supabase, user) => {
 *     const { data } = await supabase.from('board').insert({ name, user_id: user.id }).select().single()
 *     return data
 *   })
 */
export async function withAuthResultRateLimit<T>(
  rateLimitKey: RateLimitKey,
  action: (supabase: SupabaseClient<Database>, user: User) => Promise<T>,
): Promise<ActionResult<T>> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Authentication required' }
  }

  // Rate limit check using user.id
  const rlResult = checkRateLimit(rateLimitKey, user.id)
  if (!rlResult.allowed) {
    return { success: false, error: rlResult.error! }
  }

  try {
    const data = await action(supabase, user)
    return { success: true, data }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: `withAuthResultRateLimit:${rateLimitKey}` },
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}

/**
 * Wraps a Server Action with authentication AND rate limiting.
 * Throws on auth/rate-limit failure (for actions that use throw-based error handling).
 *
 * @param rateLimitKey - Rate limit configuration key
 * @param action - Async function receiving authenticated supabase client and user
 * @returns The action's return value
 * @throws {Error} 'Authentication required' or rate limit error message
 *
 * @example
 * export const batchUpdateOrders = (updates: Array<...>) =>
 *   withAuthRateLimit('batchDnD', async (supabase, user) => {
 *     await supabase.rpc('batch_update', { p_updates: updates })
 *   })
 */
export async function withAuthRateLimit<T>(
  rateLimitKey: RateLimitKey,
  action: (supabase: SupabaseClient<Database>, user: User) => Promise<T>,
): Promise<T> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Authentication required')
  }

  // Rate limit check using user.id
  const rlResult = checkRateLimit(rateLimitKey, user.id)
  if (!rlResult.allowed) {
    throw new Error(rlResult.error!)
  }

  return action(supabase, user)
}
