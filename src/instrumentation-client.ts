// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

/** Hostnames where Sentry should be disabled */
const DISABLED_HOSTNAMES = ['localhost', '127.0.0.1'] as const

/**
 * Determines if Sentry should be enabled on the client.
 * Only enables in Vercel production environment, NOT in:
 * - Vercel preview/development deployments
 * - localhost development
 * - 127.0.0.1 (local IP)
 * - All RFC 1918 private IPv4 ranges (10/8, 172.16/12, 192.168/16)
 * - Environments where NEXT_PUBLIC_VERCEL_ENV is missing (fail-closed)
 *
 * @returns {boolean} Whether Sentry should be enabled
 *
 * @example
 * // On localhost:3008 -> false
 * // On Vercel preview deployment -> false
 * // On gitbox-laststance.vercel.app (production) -> true
 */
function isSentryEnabled(): boolean {
  if (typeof window === 'undefined') return false

  // Hostname guards run before the Vercel env check so dev sessions on
  // localhost/private networks never emit telemetry even when
  // NEXT_PUBLIC_VERCEL_ENV is set to 'production'.
  const hostname = window.location.hostname
  if (
    DISABLED_HOSTNAMES.includes(hostname as (typeof DISABLED_HOSTNAMES)[number])
  ) {
    return false
  }
  // Disable on all RFC 1918 private IPv4 ranges. 172.16.0.0/12 covers
  // 172.16.* – 172.31.*, which is the default Docker bridge range.
  const isPrivateIpv4 =
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  if (isPrivateIpv4) {
    return false
  }

  // Fail closed: only enable when NEXT_PUBLIC_VERCEL_ENV is explicitly
  // 'production'. If the variable is missing (misconfigured build, non-Vercel
  // host), we'd rather skip telemetry than leak events.
  return process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
}

Sentry.init({
  dsn: 'https://06b1775946774ab1527986b339ea85ed@o1245861.ingest.us.sentry.io/4510597804261376',

  // Only enable Sentry in production environment (not localhost)
  enabled: isSentryEnabled(),

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  ignoreErrors: [
    'Hydration failed',
    /server rendered HTML didn't match/,
    /Text content does not match/,
    /There was an error while hydrating/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
