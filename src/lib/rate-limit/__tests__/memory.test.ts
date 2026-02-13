import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SlidingWindowLimiter } from '../memory'

describe('SlidingWindowLimiter', () => {
  let limiter: SlidingWindowLimiter

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    limiter?.destroy()
    vi.useRealTimers()
  })

  it('allows requests within the limit', () => {
    limiter = new SlidingWindowLimiter(3, 60_000) // 3 req/min

    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(true)
  })

  it('blocks requests exceeding the limit', () => {
    limiter = new SlidingWindowLimiter(2, 60_000) // 2 req/min

    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(false) // 3rd request blocked
  })

  it('resets after the window expires', () => {
    limiter = new SlidingWindowLimiter(2, 60_000) // 2 req/min

    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(false) // blocked

    // Advance time past the window
    vi.advanceTimersByTime(61_000)

    expect(limiter.check('user-1')).toBe(true) // allowed again
  })

  it('tracks separate identifiers independently', () => {
    limiter = new SlidingWindowLimiter(1, 60_000) // 1 req/min

    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-1')).toBe(false) // user-1 blocked

    expect(limiter.check('user-2')).toBe(true) // user-2 independent
  })

  it('uses sliding window (partial expiry)', () => {
    limiter = new SlidingWindowLimiter(2, 60_000) // 2 req/min

    // t=0s: first request
    expect(limiter.check('user-1')).toBe(true)

    // t=30s: second request
    vi.advanceTimersByTime(30_000)
    expect(limiter.check('user-1')).toBe(true)

    // t=30s: blocked (2 requests in last 60s)
    expect(limiter.check('user-1')).toBe(false)

    // t=61s: first request expired, one slot opens
    vi.advanceTimersByTime(31_000)
    expect(limiter.check('user-1')).toBe(true)
  })

  it('cleans up expired entries', () => {
    limiter = new SlidingWindowLimiter(1, 1_000) // 1 req/sec

    limiter.check('user-1')
    limiter.check('user-2')

    // Advance past window expiry (2x windowMs)
    vi.advanceTimersByTime(3_000)

    // Trigger cleanup interval (60s)
    vi.advanceTimersByTime(60_000)

    // New requests should work (entries were cleaned up)
    expect(limiter.check('user-1')).toBe(true)
    expect(limiter.check('user-2')).toBe(true)
  })
})
