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
  MAINTENANCE: '/maintenance',
  SETTINGS: '/settings',
  TERMS: '/terms',
  PRIVACY: '/privacy',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
