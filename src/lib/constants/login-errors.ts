/**
 * Codes the login page may receive in `?error=`.
 *
 * Sign-in, the OAuth callback, and silent refresh redirect here. The query
 * is one of these codes. A provider message or a rate-limit sentence stays
 * in the server log and is not copied into the URL.
 *
 * @example
 * redirect(`/login?error=${LOGIN_ERROR.rateLimited}`)
 */
export const LOGIN_ERROR = {
  authFailed: 'auth_failed',
  missingCode: 'missing_code',
  oauthFailed: 'oauth_failed',
  rateLimited: 'rate_limited',
  tokenRefreshFailed: 'token_refresh_failed',
  unexpectedError: 'unexpected_error',
} as const

export type LoginError = (typeof LOGIN_ERROR)[keyof typeof LOGIN_ERROR]
