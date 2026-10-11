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
 * Largest body the proxy forwards on the tunnel route. The biggest report the
 * browser SDK builds is a session replay segment, which it stops growing at
 * 20 MB before compression (`REPLAY_MAX_EVENT_BUFFER_SIZE` in
 * `@sentry/replay`). Sentry accepts less than that anyway: 1 MiB for an error
 * or a transaction and 10 MiB for a compressed replay. 20 MiB leaves room for
 * the envelope headers on top of the largest segment.
 */
export const SENTRY_TUNNEL_MAX_BODY_BYTES = 20 * 1024 * 1024

/**
 * `report-uri` of the Content-Security-Policy header in next.config.ts: the
 * browser posts this app's CSP violations straight to its Sentry project.
 */
export const SENTRY_CSP_REPORT_URI = `${sentryIngestBaseUrl}/security/?sentry_key=${sentryDsnUrl.username}`
