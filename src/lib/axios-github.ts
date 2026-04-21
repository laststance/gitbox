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

import { getGitHubTokenCookieName } from '@/lib/constants/cookies'

const GITHUB_API_BASE_URL = 'https://api.github.com'

function isE2ETestMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true' &&
    (process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test')
  )
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
 * @returns Configured AxiosInstance for GitHub API
 *
 * @example
 * const api = createGitHubAxios()
 * const { data } = await api.get<GitHubUser>('/user')
 */
export function createGitHubAxios(): AxiosInstance {
  const instance = axios.create({
    baseURL: GITHUB_API_BASE_URL,
    timeout: 10000,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitBox-App',
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
      // E2E test mode: Use mock token for MSW interception
      if (isE2ETestMode()) {
        config.headers.Authorization =
          'Bearer mock-github-provider-token-for-testing'
        return config
      }

      // Production: Read token from httpOnly cookie
      const cookieStore = await cookies()
      const cookieName = getGitHubTokenCookieName()
      const token = cookieStore.get(cookieName)?.value

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
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
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      try {
        const cookieStore = await cookies()
        const cookieName = getGitHubTokenCookieName()
        cookieStore.delete(cookieName)
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
  // E2E test mode: Always has token (mock)
  if (isE2ETestMode()) return true

  const cookieStore = await cookies()
  const cookieName = getGitHubTokenCookieName()
  return !!cookieStore.get(cookieName)?.value
}
