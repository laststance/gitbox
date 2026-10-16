/**
 * Internal route paths.
 * Centralized to keep auth redirects and error-fallback targets consistent.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  BOARDS: '/boards',
  BOARDS_NEW: '/boards/new',
  FAVORITES: '/boards/favorites',
  ACCOUNT: '/account',
  SETTINGS: '/settings',
  TERMS: '/terms',
  PRIVACY: '/privacy',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/**
 * Path the browser posts Sentry events to (`tunnelRoute` in next.config.ts).
 * The proxy forwards what arrives there to this app's Sentry project, so both
 * must name the same path.
 */
export const SENTRY_TUNNEL_ROUTE = '/monitoring'
