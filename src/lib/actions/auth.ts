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

import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { deleteGitHubTokenCookie } from '@/lib/constants/cookies'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { logSecurityEvent } from '@/lib/security-events'
import {
  createServerActionClient,
  createAdminClient,
} from '@/lib/supabase/server'
import { getForwardedClientIp } from '@/lib/utils/get-client-ip'

/**
 * Sign in with GitHub OAuth
 *
 * @returns Redirect URL to GitHub authentication screen
 */
export async function signInWithGitHub() {
  // Rate limit by IP (user not yet authenticated)
  const headerStore = await headers()
  const forwarded = getForwardedClientIp(headerStore)
  if (!forwarded) {
    Sentry.captureMessage('signInWithGitHub: x-forwarded-for header missing', {
      level: 'warning',
      tags: { category: 'rate_limit' },
    })
  }
  const ip = forwarded ?? '127.0.0.1'
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

  const { error } = await supabase.auth.signOut()

  if (error) {
    Sentry.captureException(error, { extra: { context: 'Sign out' } })
    throw new Error(error.message)
  }

  await deleteGitHubTokenCookie()

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
  // Get current user via JWT claims (~5ms WebCrypto verify) instead of the
  // ~50ms `auth.getUser()` GoTrue round-trip. `claims.sub` is the user UUID.
  const authedContext = await getCachedClaims()

  if (!authedContext) {
    Sentry.captureException(new Error('User not found'), {
      extra: { context: 'Delete account - get user' },
    })
    throw new Error('Not authenticated')
  }

  const { claims } = authedContext

  // Rate limit by user ID
  const rlResult = checkRateLimit('deleteAccount', claims.sub)
  if (!rlResult.allowed) {
    throw new Error(rlResult.error!)
  }

  // Use admin client to delete user (bypasses RLS)
  const adminClient = createAdminClient()
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    claims.sub,
  )

  if (deleteError) {
    Sentry.captureException(deleteError, {
      extra: { context: 'Delete account', userId: claims.sub },
    })
    throw new Error('Failed to delete account')
  }

  logSecurityEvent('account_deleted', { userId: claims.sub })

  await deleteGitHubTokenCookie()

  redirect('/')
}
