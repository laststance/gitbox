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
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getGitHubTokenCookieName } from '@/lib/constants/cookies'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { logSecurityEvent } from '@/lib/security-events'
import {
  createServerActionClient,
  createAdminClient,
} from '@/lib/supabase/server'

/**
 * Sign in with GitHub OAuth
 *
 * @returns Redirect URL to GitHub authentication screen
 */
export async function signInWithGitHub() {
  // Rate limit by IP (user not yet authenticated)
  const headerStore = await headers()
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  const rlResult = checkRateLimit('signInWithGitHub', ip)
  if (!rlResult.allowed) {
    redirect(
      `/login?error=rate_limited&message=${encodeURIComponent(rlResult.error!)}`,
    )
  }

  const supabase = await createServerActionClient()
  const origin = headerStore.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL

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
 * Terminates the user session by:
 * - Deleting the Supabase session
 * - Deleting the GitHub provider token cookie
 * - Redirecting to the landing page
 *
 * @throws Error if Supabase sign out fails
 */
export async function signOut() {
  const supabase = await createServerActionClient()
  const cookieStore = await cookies()

  const { error } = await supabase.auth.signOut()

  if (error) {
    Sentry.captureException(error, { extra: { context: 'Sign out' } })
    throw new Error(error.message)
  }

  // Delete GitHub provider token cookie
  const githubTokenCookieName = getGitHubTokenCookieName()
  cookieStore.delete(githubTokenCookieName)

  logSecurityEvent('logout')

  redirect('/')
}

/**
 * Delete user account permanently
 *
 * Deletes the user from Supabase Auth using admin privileges.
 * All related data (boards, cards, etc.) is automatically deleted
 * via ON DELETE CASCADE constraints in the database.
 *
 * @throws Error if user is not authenticated
 * @throws Error if deletion fails
 */
export async function deleteAccount() {
  const supabase = await createServerActionClient()
  const cookieStore = await cookies()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    Sentry.captureException(userError ?? new Error('User not found'), {
      extra: { context: 'Delete account - get user' },
    })
    throw new Error('Not authenticated')
  }

  // Rate limit by user ID
  const rlResult = checkRateLimit('deleteAccount', user.id)
  if (!rlResult.allowed) {
    throw new Error(rlResult.error!)
  }

  // Use admin client to delete user (bypasses RLS)
  const adminClient = createAdminClient()
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    user.id,
  )

  if (deleteError) {
    Sentry.captureException(deleteError, {
      extra: { context: 'Delete account', userId: user.id },
    })
    throw new Error('Failed to delete account')
  }

  logSecurityEvent('account_deleted', { userId: user.id })

  // Delete GitHub provider token cookie
  const githubTokenCookieName = getGitHubTokenCookieName()
  cookieStore.delete(githubTokenCookieName)

  // Redirect to landing page
  redirect('/')
}
