/**
 * GitHub API Axios Instance
 *
 * Configured axios instance for GitHub REST API calls in Server Actions.
 * Handles authentication via request interceptor and provides consistent
 * error handling across all GitHub API operations.
 *
 * @see https://docs.github.com/en/rest
 */

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { cookies } from 'next/headers'

import {
  deleteGitHubTokenCookie,
  getGitHubTokenCookieName,
} from '@/lib/constants/cookies'
import {
  GITHUB_API_ACCEPT_HEADER,
  GITHUB_API_BASE_URL,
  GITHUB_API_TIMEOUT_MS,
  GITHUB_API_USER_AGENT,
  GITHUB_API_VERSION,
  GITHUB_E2E_MOCK_TOKEN,
} from '@/lib/constants/github'

interface CreateGitHubAxiosOptions {
  token?: string
  clearTokenCookieOnUnauthorized?: boolean
}

/**
 * Detects the explicit E2E environment so only MSW-backed runs receive a mock token.
 * @returns Whether both MSW and APP_ENV test flags are enabled.
 * @example
 * isE2ETestMode() // => true when NEXT_PUBLIC_ENABLE_MSW_MOCK=true and APP_ENV=test
 */
function isE2ETestMode(): boolean {
  // Require BOTH flags to be set explicitly. NODE_ENV is not a reliable
  // signal — Vitest/Jest default NODE_ENV to 'test' and would otherwise
  // turn on the mock-token path unintentionally.
  return (
    process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true' &&
    process.env.APP_ENV === 'test'
  )
}

/**
 * Reads the GitHub token before cached loaders run so request APIs never execute inside a cache scope.
 * @returns The real cookie token, the E2E mock token, or null when unauthenticated.
 * @example
 * const token = await getGitHubToken() // => 'gho_…' | null
 */
export async function getGitHubToken(): Promise<string | null> {
  if (isE2ETestMode()) return GITHUB_E2E_MOCK_TOKEN

  const cookieStore = await cookies()
  const cookieName = getGitHubTokenCookieName()
  return cookieStore.get(cookieName)?.value || null
}

/**
 * Creates an axios instance configured for GitHub API requests.
 *
 * Features:
 * - Base URL set to GitHub API
 * - Common headers for GitHub API v3
 * - 10s timeout to prevent hanging requests
 * - Request interceptor for automatic auth token injection
 * - E2E test mode support with mock token
 *
 * @param options - Optional explicit token and 401 cookie-cleanup behavior.
 * @returns Configured AxiosInstance for GitHub API.
 *
 * @example
 * const api = createGitHubAxios({ token, clearTokenCookieOnUnauthorized: false })
 * const { data } = await api.get<GitHubUser>('/user')
 */
export function createGitHubAxios(
  options: CreateGitHubAxiosOptions = {},
): AxiosInstance {
  const { token, clearTokenCookieOnUnauthorized = true } = options
  const instance = axios.create({
    baseURL: GITHUB_API_BASE_URL,
    timeout: GITHUB_API_TIMEOUT_MS,
    headers: {
      Accept: GITHUB_API_ACCEPT_HEADER,
      'User-Agent': GITHUB_API_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  /**
   * Request interceptor: Injects GitHub auth token into requests.
   *
   * In E2E test mode (MSW enabled), returns a mock token since:
   * 1. Cookie reading in Server Actions has known issues with Next.js + Playwright
   * 2. MSW handlers will intercept the actual API calls anyway
   *
   * @see https://github.com/mswjs/msw/issues/1644
   */
  instance.interceptors.request.use(
    async (
      config: InternalAxiosRequestConfig,
    ): Promise<InternalAxiosRequestConfig> => {
      // Explicit tokens keep cached loaders independent from request cookies.
      if (config.headers.Authorization) {
        return config
      }

      const resolvedToken = await getGitHubToken()

      if (resolvedToken) {
        config.headers.Authorization = `Bearer ${resolvedToken}`
      }

      return config
    },
  )

  /**
   * Response interceptor: Clears stale GitHub token cookie on 401.
   *
   * When the GitHub token has expired (default 8h for fine-grained tokens),
   * the API returns 401. This interceptor proactively deletes the cookie
   * so subsequent hasGitHubToken() checks correctly return false, prompting
   * re-authentication instead of repeated 401 failures.
   */
  instance.interceptors.response.use(undefined, async (error) => {
    if (
      clearTokenCookieOnUnauthorized &&
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      try {
        await deleteGitHubTokenCookie()
      } catch {
        // Cookie deletion may fail in certain Next.js contexts (e.g., static
        // generation). Silently ignore — the token will expire naturally.
      }
    }
    return Promise.reject(error)
  })

  return instance
}

/**
 * Checks if the GitHub auth token is available.
 *
 * Used for early validation before making API calls.
 * In test mode, always returns true since mock token is used.
 *
 * @returns true if token is available, false otherwise
 *
 * @example
 * if (!(await hasGitHubToken())) {
 *   return { data: null, error: 'GitHub token not found' }
 * }
 */
export async function hasGitHubToken(): Promise<boolean> {
  return Boolean(await getGitHubToken())
}
