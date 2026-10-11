/**
 * DSN of this app's Sentry project. Sentry ships it to every browser, so it
 * is a public value. Everything that addresses the project is built from this
 * one copy: the three Sentry init files read it, and the tunnel destination
 * and the CSP report address below are derived from it. A second copy that
 * drifted would send part of the reports to another project.
 */
export const SENTRY_DSN =
  'https://06b1775946774ab1527986b339ea85ed@o1245861.ingest.us.sentry.io/4510597804261376'

const sentryDsnUrl = new URL(SENTRY_DSN)

/** `https://<ingest host>/api/<project id>`: where the project's ingest endpoints live. */
const sentryIngestBaseUrl = `https://${sentryDsnUrl.host}/api${sentryDsnUrl.pathname}`

/**
 * Where the proxy forwards the browser error reports that arrive on the
 * tunnel route: the envelope endpoint of this app's own Sentry project.
 * `hsts=0` is the query Sentry's own tunnel rewrite sends along.
 */
export const SENTRY_ENVELOPE_URL = `${sentryIngestBaseUrl}/envelope/?hsts=0`

/**
 * `report-uri` of the Content-Security-Policy header in next.config.ts: the
 * browser posts this app's CSP violations straight to its Sentry project.
 */
export const SENTRY_CSP_REPORT_URI = `${sentryIngestBaseUrl}/security/?sentry_key=${sentryDsnUrl.username}`
