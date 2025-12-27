/**
 * Authentication Actions
 *
 * Execute authentication processes with server actions
 * - GitHub OAuth sign in
 * - Sign out
 * - Session management
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createServerActionClient } from '@/lib/supabase/server'

/**
 * Sign in with GitHub OAuth
 *
 * @returns Redirect URL to GitHub authentication screen
 */
export async function signInWithGitHub() {
  const supabase = await createServerActionClient()
  const origin =
    (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: 'read:user user:email repo', // Required scopes for GitHub Repository access
    },
  })

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'GitHub OAuth sign in' },
    })
    redirect(
      `/login?error=oauth_failed&message=${encodeURIComponent(error.message)}`,
    )
  }

  if (data.url) {
    redirect(data.url)
  }

  // Handle case where no URL is returned (unexpected state)
  Sentry.captureMessage('GitHub OAuth: No redirect URL returned', 'error')
  redirect('/login?error=oauth_failed&message=No%20redirect%20URL%20returned')
}

/**
 * Sign out
 *
 * - Delete Supabase session
 * - Redirect to login page
 */
export async function signOut() {
  const supabase = await createServerActionClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    Sentry.captureException(error, { extra: { context: 'Sign out' } })
    throw new Error(error.message)
  }

  redirect('/login')
}

/**
 * Get current user session
 *
 * @returns Session information (null if not authenticated)
 */
export async function getSession() {
  const supabase = await createServerActionClient()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    Sentry.captureException(error, { extra: { context: 'Get session' } })
    return null
  }

  return session
}

/**
 * Get current user information
 *
 * @returns User information (null if not authenticated)
 */
export async function getUser() {
  const supabase = await createServerActionClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    Sentry.captureException(error, { extra: { context: 'Get user' } })
    return null
  }

  return user
}
