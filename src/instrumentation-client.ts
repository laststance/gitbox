// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import { SENTRY_DSN as dsn } from '@/lib/constants/sentry'
import { holdBrowserRequestsUntil } from '@/lib/utils/hold-browser-requests-until-msw'
import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'

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

// The page is in the server HTML. Hold GitHub requests, then start the
// worker. Same-origin calls are not held: they are answered by the server,
// and waiting on them left the page on screen before it could be used.
// The gate is synchronous; the start is not, and Next does not wait for it.
if (isMSWEnabled()) {
  let openGate: () => void = () => {}
  const workerReady = new Promise<void>((resolve) => {
    openGate = resolve
  })
  holdBrowserRequestsUntil(workerReady)
  void import('../mocks/browser')
    .then(async ({ worker }) => {
      await worker.start({
        // MSW 3 names this onUnhandledFrame. The same-origin calls of the
        // app are not GitHub, so they go out once the worker is up.
        onUnhandledFrame: 'bypass',
      })
    })
    .catch(() => {
      // The gate opens in finally. A failed worker leaves the request
      // unmocked, and the suite fails on the response.
    })
    .finally(() => {
      openGate()
    })
}

Sentry.init({
  dsn,

  // Only enable Sentry in production environment (not localhost)
  enabled: isSentryEnabled(),

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Preserve message grouping and release health from Sentry 10.
  attachStacktrace: false,
  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  ignoreErrors: [
    'Hydration failed',
    /server rendered HTML didn't match/,
    /Text content does not match/,
    /There was an error while hydrating/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
