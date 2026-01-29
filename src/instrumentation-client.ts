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
 * - Local network addresses (192.168.x.x, 10.x.x.x)
 *
 * @returns {boolean} Whether Sentry should be enabled
 *
 * @example
 * // On localhost:3008 -> false
 * // On Vercel preview deployment -> false
 * // On gitbox-laststance.vercel.app (production) -> true
 */
const isSentryEnabled = (): boolean => {
  // Server-side rendering check
  if (typeof window === 'undefined') {
    return false
  }

  // Check Vercel environment first (most reliable)
  // NEXT_PUBLIC_VERCEL_ENV is automatically set by Vercel: 'production' | 'preview' | 'development'
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
  if (vercelEnv) {
    return vercelEnv === 'production'
  }

  const hostname = window.location.hostname

  // Disable on localhost and local IP addresses
  if (
    DISABLED_HOSTNAMES.includes(hostname as (typeof DISABLED_HOSTNAMES)[number])
  ) {
    return false
  }

  // Disable on any local network address (192.168.x.x, 10.x.x.x, etc.)
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
    return false
  }

  // Fallback: only enable for production-like domains
  return true
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
