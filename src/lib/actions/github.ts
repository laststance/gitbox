/**
 * GitHub repository catalog Server Action.
 *
 * Authentication and request rate limiting stay outside the Next.js cache
 * scope; the expensive read-only GitHub catalog is cached by token fingerprint.
 *
 * @see https://docs.github.com/en/rest/repos/repos
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import { isAxiosError } from 'axios'
import { headers } from 'next/headers'

import { getGitHubToken } from '@/lib/axios-github'
import { deleteGitHubTokenCookie } from '@/lib/constants/cookies'
import {
  getCachedGitHubRepositoryCatalog,
  getGitHubCatalogErrorStatus,
} from '@/lib/github/repository-catalog'
import { createModuleLogger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit/check'
import type { GitHubRepositoryCatalog } from '@/lib/types/github'
import { getForwardedClientIp } from '@/lib/utils/get-client-ip'

import type { ActionResult } from './types'

export type {
  GitHubOrganization,
  GitHubRepository,
  GitHubRepositoryCatalog,
  GitHubUser,
} from '@/lib/types/github'

const log = createModuleLogger('github')
const TOKEN_MISSING_ERROR_MSG = 'GitHub token not found. Please sign in again.'

/**
 * Resolves the caller IP so repeated catalog actions retain the existing abuse guard.
 * @returns The forwarded client IP or localhost when the proxy header is unavailable.
 * @example
 * await getClientIp() // => '203.0.113.10'
 */
async function getClientIp(): Promise<string> {
  const clientIp = getForwardedClientIp(await headers())
  if (!clientIp) {
    log.warn('x-forwarded-for header missing — falling back to 127.0.0.1')
  }
  return clientIp ?? '127.0.0.1'
}

/**
 * Removes a rejected OAuth token after a cached loader returns a GitHub 401.
 * @param error - Error propagated out of the cache scope.
 * @returns Nothing; non-401 errors leave the cookie untouched.
 * @example
 * await clearTokenCookieAfterUnauthorized(error)
 */
async function clearTokenCookieAfterUnauthorized(
  error: unknown,
): Promise<void> {
  const errorStatus = isAxiosError(error)
    ? error.response?.status
    : getGitHubCatalogErrorStatus(error)
  if (errorStatus !== 401) return

  try {
    await deleteGitHubTokenCookie()
  } catch (cookieError) {
    log.warn(
      { error: cookieError },
      'Could not clear stale GitHub token cookie',
    )
  }
}

/**
 * Converts GitHub/Axios failures into the stable ActionResult message consumed by the picker.
 * @param error - Error thrown while building or revalidating the catalog.
 * @param context - Human-readable operation used in logs and Sentry context.
 * @returns A safe user-facing error message.
 * @example
 * handleGitHubError(error, 'fetch repository catalog') // => 'GitHub API error: 500'
 */
function handleGitHubError(error: unknown, context: string): string {
  if (isAxiosError(error)) {
    const errorStatus = error.response?.status
    log.warn(
      { status: errorStatus ?? null, context },
      'GitHub API request failed',
    )

    if (errorStatus === 401) {
      return 'GitHub token expired. Please sign in again.'
    }
    if (errorStatus === 404) {
      return 'Resource not found.'
    }
    const message = error.response?.data?.message
    if (message) {
      return message
    }

    // Axios config contains Authorization, so response-less errors must never be logged raw.
    return `GitHub API error: ${errorStatus ?? error.code ?? 'network failure'}`
  }

  const errorStatus = getGitHubCatalogErrorStatus(error)

  if (errorStatus !== null) {
    log.warn({ status: errorStatus, context }, 'GitHub catalog request failed')

    if (errorStatus === 401) {
      return 'GitHub token expired. Please sign in again.'
    }
    if (errorStatus === 404) {
      return 'Resource not found.'
    }
    return `GitHub API error: ${errorStatus}`
  }

  log.error({ error }, `Failed to ${context}`)
  Sentry.captureException(error, {
    extra: { context: `GitHub API: ${context}` },
  })
  return error instanceof Error ? error.message : `Failed to ${context}`
}

/**
 * Returns the authenticated user's complete picker catalog from a 24-hour user-isolated cache.
 * @returns A successful compact catalog, token error code, rate-limit error, or GitHub failure.
 * @example
 * const result = await getAuthenticatedRepositoryCatalog()
 * if (result.success) console.log(result.data.repositories.length)
 */
export async function getAuthenticatedRepositoryCatalog(): Promise<
  ActionResult<GitHubRepositoryCatalog>
> {
  const token = await getGitHubToken()
  if (!token) {
    return {
      success: false,
      error: TOKEN_MISSING_ERROR_MSG,
      errorCode: 'GITHUB_TOKEN_MISSING',
    }
  }

  // One catalog action replaces the former user/org/repository action fan-out.
  const clientIp = await getClientIp()
  const rateLimitResult = checkRateLimit('githubApi', clientIp)
  if (!rateLimitResult.allowed) {
    return { success: false, error: rateLimitResult.error! }
  }

  try {
    const catalog = await getCachedGitHubRepositoryCatalog(token)
    return { success: true, data: catalog }
  } catch (error) {
    // Cookie mutation must happen after leaving unstable_cache's request-free scope.
    await clearTokenCookieAfterUnauthorized(error)
    return {
      success: false,
      error: handleGitHubError(error, 'fetch repository catalog'),
    }
  }
}
