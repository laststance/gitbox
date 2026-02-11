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

import type { SupabaseClient, User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

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
