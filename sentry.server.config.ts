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
  // Vercel provides VERCEL_ENV: 'production' | 'preview' | 'development'
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production'
  }
  // Disable for local dev and E2E test builds (APP_ENV=test on production build)
  if (process.env.APP_ENV === 'test') return false
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
