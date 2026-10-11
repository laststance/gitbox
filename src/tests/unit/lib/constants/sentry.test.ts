/**
 * Unit Tests: the Sentry addresses built from the DSN
 *
 * The tunnel destination and the CSP report address are derived from the one
 * DSN constant. A slip in that derivation sends every browser error report,
 * or every CSP violation report, to an address Sentry does not answer on,
 * and nothing else in the app would notice.
 *
 * @see src/lib/constants/sentry.ts
 */

import { describe, expect, test } from 'vitest'

import {
  SENTRY_CSP_REPORT_URI,
  SENTRY_ENVELOPE_URL,
} from '@/lib/constants/sentry'

describe('Sentry addresses built from the DSN', () => {
  test("the tunnel forwards error reports to the envelope endpoint of this app's project", () => {
    // Arrange / Act: the constant is computed when the module loads
    const envelopeUrl = SENTRY_ENVELOPE_URL

    // Assert
    expect(envelopeUrl).toBe(
      'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
    )
  })

  test("the browser posts CSP violations to the security endpoint of this app's project", () => {
    // Arrange / Act: the constant is computed when the module loads
    const reportUri = SENTRY_CSP_REPORT_URI

    // Assert
    expect(reportUri).toBe(
      'https://o1245861.ingest.us.sentry.io/api/4510597804261376/security/?sentry_key=06b1775946774ab1527986b339ea85ed',
    )
  })
})
