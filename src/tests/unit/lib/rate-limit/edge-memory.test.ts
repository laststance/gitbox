/**
 * Unit Tests: the in-memory rate limiter the proxy uses
 *
 * The proxy counts sign-in callbacks and browser error reports per client
 * address with this limiter. The store lives for as long as the process, so
 * these tests also cover that it lets go of addresses it no longer needs.
 *
 * @see src/lib/rate-limit/edge-memory.ts
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('edgeRateLimit()', () => {
  beforeEach(() => {
    // Each test gets an empty store and a clock it moves by hand
    vi.resetModules()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('refuses the request that goes over the limit inside one window', async () => {
    // Arrange: two requests are allowed per minute, and both were made
    const { edgeRateLimit } = await import('@/lib/rate-limit/edge-memory')
    const isFirstRequestAllowed = edgeRateLimit('203.0.113.1', 2, 60_000)
    const isSecondRequestAllowed = edgeRateLimit('203.0.113.1', 2, 60_000)

    // Act
    const isThirdRequestAllowed = edgeRateLimit('203.0.113.1', 2, 60_000)

    // Assert
    expect(isFirstRequestAllowed).toBe(true)
    expect(isSecondRequestAllowed).toBe(true)
    expect(isThirdRequestAllowed).toBe(false)
  })

  test('allows an identifier again once its window has passed', async () => {
    // Arrange: the identifier used up its one request for the minute
    const { edgeRateLimit } = await import('@/lib/rate-limit/edge-memory')
    edgeRateLimit('203.0.113.1', 1, 60_000)
    expect(edgeRateLimit('203.0.113.1', 1, 60_000)).toBe(false)

    // Act: one millisecond after the minute is over
    vi.setSystemTime(new Date('2026-10-11T00:01:00.001Z'))
    const isAllowedInNextWindow = edgeRateLimit('203.0.113.1', 1, 60_000)

    // Assert
    expect(isAllowedInNextWindow).toBe(true)
  })

  test('counts each identifier on its own', async () => {
    // Arrange: one identifier is over its limit
    const { edgeRateLimit } = await import('@/lib/rate-limit/edge-memory')
    edgeRateLimit('sentry-tunnel:203.0.113.1', 1, 60_000)
    expect(edgeRateLimit('sentry-tunnel:203.0.113.1', 1, 60_000)).toBe(false)

    // Act: the same address under another key
    const isOtherKeyAllowed = edgeRateLimit('203.0.113.1', 1, 60_000)

    // Assert
    expect(isOtherKeyAllowed).toBe(true)
  })

  test('forgets identifiers whose window has passed instead of keeping every visitor for the life of the process', async () => {
    // Arrange: three visitors inside one minute
    const { edgeRateLimit, getEdgeRateLimitEntryCount } =
      await import('@/lib/rate-limit/edge-memory')
    edgeRateLimit('203.0.113.1', 10, 60_000)
    edgeRateLimit('203.0.113.2', 10, 60_000)
    edgeRateLimit('203.0.113.3', 10, 60_000)
    expect(getEdgeRateLimitEntryCount()).toBe(3)

    // Act: a fourth visitor arrives after their minute is over
    vi.setSystemTime(new Date('2026-10-11T00:01:00.001Z'))
    edgeRateLimit('203.0.113.4', 10, 60_000)

    // Assert: only the fourth visitor is remembered
    expect(getEdgeRateLimitEntryCount()).toBe(1)
  })

  test('keeps refusing an identifier whose longer window is still running when expired ones are forgotten', async () => {
    // Arrange: one identifier is limited for an hour, another for a minute
    const { edgeRateLimit, getEdgeRateLimitEntryCount } =
      await import('@/lib/rate-limit/edge-memory')
    edgeRateLimit('203.0.113.1', 1, 3_600_000)
    edgeRateLimit('203.0.113.2', 1, 60_000)

    // Act: the minute is over, the hour is not
    vi.setSystemTime(new Date('2026-10-11T00:01:00.001Z'))
    const isHourLimitedAllowed = edgeRateLimit('203.0.113.1', 1, 3_600_000)

    // Assert: the hour-long entry survived the sweep and still counts
    expect(isHourLimitedAllowed).toBe(false)
    expect(getEdgeRateLimitEntryCount()).toBe(1)
  })
})
