/**
 * Security Event Logging
 *
 * Centralized security event logging using Sentry custom events.
 * Captures authentication, authorization, and account lifecycle events
 * for audit trail and anomaly detection.
 *
 * @example
 * logSecurityEvent('login_success', { userId: 'user-123' })
 * logSecurityEvent('unauthorized_access', { path: '/board/456' })
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Security event types for audit logging.
 *
 * - login_success: Successful OAuth authentication
 * - login_failure: Failed OAuth authentication (code exchange error)
 * - logout: User-initiated sign out
 * - account_deleted: User account permanently deleted
 * - unauthorized_access: Unauthenticated access to protected route
 * - rate_limited: Request blocked by rate limiter
 */
type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'account_deleted'
  | 'unauthorized_access'
  | 'rate_limited'

/**
 * Context data for security events.
 * All fields are optional — include what's relevant for each event type.
 */
interface SecurityEventContext {
  /** User ID (when known) */
  userId?: string
  /** Request path */
  path?: string
  /** Error message (for failure events) */
  error?: string
  /** IP address or other request metadata */
  ip?: string
}

/**
 * Log a security event via Sentry captureMessage.
 *
 * Events are tagged with `category: 'security'` and `security_event: type`
 * for easy filtering in Sentry dashboards.
 *
 * @param type - The security event type
 * @param context - Additional context data for the event
 *
 * @example
 * // Successful login
 * logSecurityEvent('login_success', { userId: user.id })
 *
 * // Failed login attempt
 * logSecurityEvent('login_failure', { error: 'Invalid code' })
 *
 * // Unauthorized access blocked by proxy
 * logSecurityEvent('unauthorized_access', { path: '/board/123' })
 */
export function logSecurityEvent(
  type: SecurityEventType,
  context: SecurityEventContext = {},
) {
  const level =
    type === 'login_failure' ||
    type === 'unauthorized_access' ||
    type === 'rate_limited'
      ? ('warning' as const)
      : ('info' as const)

  Sentry.captureMessage(`security: ${type}`, {
    level,
    tags: {
      category: 'security',
      security_event: type,
    },
    extra: context as Record<string, unknown>,
  })
}
