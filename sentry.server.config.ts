// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

/**
 * Determines if Sentry should be enabled.
 * Only enables in production environment, NOT in:
 * - localhost development (NODE_ENV === 'development')
 * - E2E tests (APP_ENV === 'test')
 * - Vercel preview/development deployments
 *
 * @returns {boolean} Whether Sentry should be enabled
 */
function isSentryEnabled(): boolean {
  // Disable E2E/test builds before honoring deployment environment.
  // Must come before the VERCEL_ENV check so a production Vercel build
  // with APP_ENV=test (our E2E runner) never emits telemetry.
  if (process.env.APP_ENV === 'test') return false

  // Vercel provides VERCEL_ENV: 'production' | 'preview' | 'development'
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production'
  }
  return process.env.NODE_ENV === 'production'
}

Sentry.init({
  dsn: 'https://06b1775946774ab1527986b339ea85ed@o1245861.ingest.us.sentry.io/4510597804261376',

  // Only enable Sentry in production environment
  enabled: isSentryEnabled(),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
})
