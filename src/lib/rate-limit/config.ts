/**
 * Rate Limit Configuration
 *
 * Centralized rate limit definitions for all protected endpoints.
 * Each entry specifies the action name, max requests, and time window.
 *
 * @example
 * const config = RATE_LIMIT_CONFIG['deleteAccount']
 * // { maxRequests: 3, windowMs: 3_600_000, description: 'account deletion' }
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Human-readable description for error messages */
  description: string
}

export const RATE_LIMIT_CONFIG = {
  // --- Critical: Auth endpoints ---
  'auth/callback': {
    maxRequests: 10,
    windowMs: 60_000,
    description: 'authentication',
  },
  signInWithGitHub: {
    maxRequests: 10,
    windowMs: 3_600_000,
    description: 'sign-in',
  },
  deleteAccount: {
    maxRequests: 3,
    windowMs: 3_600_000,
    description: 'account deletion',
  },

  // --- High: GitHub API proxy ---
  githubApi: {
    maxRequests: 30,
    windowMs: 60_000,
    description: 'GitHub API',
  },
  addReposToBoard: {
    maxRequests: 10,
    windowMs: 60_000,
    description: 'add repository',
  },

  // --- Medium: DnD batch operations + Board CRUD ---
  batchDnD: {
    maxRequests: 60,
    windowMs: 60_000,
    description: 'drag-and-drop',
  },
  boardCrud: {
    maxRequests: 20,
    windowMs: 60_000,
    description: 'board operation',
  },

  // --- Low: User settings ---
  userSettings: {
    maxRequests: 20,
    windowMs: 60_000,
    description: 'user settings',
  },

  // --- Public: Unauthenticated endpoints ---
  publicBoardView: {
    maxRequests: 60,
    windowMs: 60_000,
    description: 'public board view',
  },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitKey = keyof typeof RATE_LIMIT_CONFIG
