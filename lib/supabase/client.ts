/**
 * Supabase Client (Browser)
 *
 * Supabase client for client-side use
 * Used for authentication and database operations in browser environment
 */

import { createClient, type Session } from '@supabase/supabase-js'

import type { Database } from './types'

// Environment variable validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Supabase client singleton instance
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Recommended for GitHub OAuth
  },
})

/**
 * Get current user session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Failed to get session:', error)
    return null
  }
  return data.session
}

/**
 * Get current user information
 */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Failed to get user:', error)
    return null
  }
  return data.user
}

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGitHub(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email',
    },
  })

  if (error) {
    console.error('Failed to sign in with GitHub:', error)
    throw error
  }

  return data
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Failed to sign out:', error)
    throw error
  }
}

/**
 * Monitor authentication state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback)
}
