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

  // Note, links and comment. A person saving a note and editing comments
  // stays under this; a script cannot fill rows that outlive their cards.
  projectInfo: {
    maxRequests: 60,
    windowMs: 60_000,
    description: 'project info',
  },

  // One card or one board. A board refresh is one request and then asks
  // GitHub itself, so this stops a script from walking every board.
  refreshRepoMetadata: {
    maxRequests: 10,
    windowMs: 60_000,
    description: 'repository refresh',
  },

  // --- Low: User settings ---
  userSettings: {
    maxRequests: 20,
    windowMs: 60_000,
    description: 'user settings',
  },

  // --- Public: Unauthenticated endpoints ---
  // Browser error reports through the Sentry tunnel, per client address. One
  // tab sends at most 12 replay segments a minute (the SDK flushes every 5 s)
  // plus a transaction per navigation, so this leaves room for several tabs.
  sentryTunnel: {
    maxRequests: 120,
    windowMs: 60_000,
    description: 'error reporting',
  },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitKey = keyof typeof RATE_LIMIT_CONFIG
