/**
 * Unit Tests: the proxy's shared rate limit
 *
 * Production asks the Vercel Firewall for one count across instances. These
 * tests pin the decision and the fallback. They do not prove two instances
 * share a counter: {@link checkRateLimit} is mocked.
 *
 * @see src/lib/rate-limit/shared-edge-limit.ts
 */

import { checkRateLimit } from '@vercel/firewall'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { edgeRateLimit } from '@/lib/rate-limit/edge-memory'
import {
  allowSharedEdgeRequest,
  SHARED_EDGE_RATE_LIMIT_WAIT_MS,
  sharedRateLimitDecision,
} from '@/lib/rate-limit/shared-edge-limit'

vi.mock('@vercel/firewall', () => ({
  checkRateLimit: vi.fn(),
}))

const RATE_LIMIT_ID = 'gitbox-sentry-tunnel'

const reportRequest = (address: string): Request =>
  new Request('https://gitbox.example/monitoring', {
    method: 'POST',
    headers: { 'x-forwarded-for': address },
  })

const useProductionCounter = (): void => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('APP_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_ENABLE_MSW_MOCK', 'false')
}

describe('sharedRateLimitDecision()', () => {
  // Value: protects=a process that did not ask still counts locally
  //   fails_when=skipped is treated as an allow
  //   no_claim=the firewall was reachable
  test('sends a skipped ask to the in-process counter', () => {
    // Arrange
    const decision = sharedRateLimitDecision('skipped')

    // Act
    // Assert
    expect(decision).toBe('use-memory')
  })

  // Value: protects=a shared allow is not also stored locally
  //   fails_when=an allow falls through to memory
  //   no_claim=the live firewall returned 204
  test('accepts an answer that is under the shared limit', () => {
    // Arrange
    const decision = sharedRateLimitDecision({ rateLimited: false })

    // Act
    // Assert
    expect(decision).toBe('allow')
  })

  // Value: protects=a shared refusal is final
  //   fails_when=rateLimited true still counts in memory
  //   no_claim=the live firewall returned 429
  test('refuses an answer that is over the shared limit', () => {
    // Arrange
    const decision = sharedRateLimitDecision({ rateLimited: true })

    // Act
    // Assert
    expect(decision).toBe('refuse')
  })

  // Value: protects=a firewall block is a refusal
  //   fails_when=error blocked is counted locally and then forwarded
  //   no_claim=the live firewall returned 403
  test('refuses an answer the firewall blocked', () => {
    // Arrange
    const decision = sharedRateLimitDecision({
      rateLimited: true,
      error: 'blocked',
    })

    // Act
    // Assert
    expect(decision).toBe('refuse')
  })

  // Value: protects=a missing rule keeps today's limit
  //   fails_when=not-found is treated as an allow and the limit disappears
  //   no_claim=the rule is published
  test('counts locally when the rule is not published', () => {
    // Arrange
    const decision = sharedRateLimitDecision({
      rateLimited: false,
      error: 'not-found',
    })

    // Act
    // Assert
    expect(decision).toBe('use-memory')
  })
})

describe('allowSharedEdgeRequest()', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.mocked(checkRateLimit).mockReset()
  })

  // Value: protects=an allow from the shared counter is not also stored in memory
  //   fails_when=a later memory fallback is already exhausted
  //   no_claim=the live firewall returned 204
  test('does not spend the in-process budget when the shared counter allows', async () => {
    // Arrange
    useProductionCounter()
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false })
    const memoryKey = 'sentry-tunnel:203.0.113.80'

    // Act
    const allowed = await allowSharedEdgeRequest(
      reportRequest('203.0.113.80'),
      memoryKey,
      1,
      60_000,
      RATE_LIMIT_ID,
    )

    // Assert
    expect(allowed).toBe(true)
    expect(edgeRateLimit(memoryKey, 1, 60_000)).toBe(true)
  })

  // Value: protects=a shared refusal does not consume the local budget
  //   fails_when=the next local fallback is already used up
  //   no_claim=the live firewall returned 429
  test('does not spend the in-process budget when the shared counter refuses', async () => {
    // Arrange
    useProductionCounter()
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: true })
    const memoryKey = 'sentry-tunnel:203.0.113.81'

    // Act
    const allowed = await allowSharedEdgeRequest(
      reportRequest('203.0.113.81'),
      memoryKey,
      1,
      60_000,
      RATE_LIMIT_ID,
    )

    // Assert
    expect(allowed).toBe(false)
    expect(edgeRateLimit(memoryKey, 1, 60_000)).toBe(true)
  })

  // Value: protects=a missing rule still refuses the second request
  //   fails_when=not-found allows every request
  //   no_claim=the rule is published
  test('uses the in-process counter when the rule is missing', async () => {
    // Arrange
    useProductionCounter()
    vi.mocked(checkRateLimit).mockResolvedValue({
      rateLimited: false,
      error: 'not-found',
    })
    const memoryKey = 'sentry-tunnel:203.0.113.82'
    const ask = async () =>
      allowSharedEdgeRequest(
        reportRequest('203.0.113.82'),
        memoryKey,
        1,
        60_000,
        RATE_LIMIT_ID,
      )

    // Act
    const first = await ask()
    const second = await ask()

    // Assert
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  // Value: protects=a thrown count still refuses the second request
  //   fails_when=a network error allows every request
  //   no_claim=the firewall host was unreachable in production
  test('uses the in-process counter when the shared count throws', async () => {
    // Arrange
    useProductionCounter()
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('network'))
    const memoryKey = 'sentry-tunnel:203.0.113.83'
    const ask = async () =>
      allowSharedEdgeRequest(
        reportRequest('203.0.113.83'),
        memoryKey,
        1,
        60_000,
        RATE_LIMIT_ID,
      )

    // Act
    const first = await ask()
    const second = await ask()

    // Assert
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  // Value: protects=development does not treat a silent allow as the shared counter
  //   fails_when=development calls the SDK and then skips the local limit
  //   no_claim=a production process was under test
  test('does not ask the shared counter in development', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('APP_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MSW_MOCK', 'false')
    const memoryKey = 'sentry-tunnel:203.0.113.84'

    // Act
    const first = await allowSharedEdgeRequest(
      reportRequest('203.0.113.84'),
      memoryKey,
      1,
      60_000,
      RATE_LIMIT_ID,
    )
    const second = await allowSharedEdgeRequest(
      reportRequest('203.0.113.84'),
      memoryKey,
      1,
      60_000,
      RATE_LIMIT_ID,
    )

    // Assert
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  // Value: protects=the E2E build does not call the live counter
  //   fails_when=Playwright posts to the tunnel and waits on the firewall
  //   no_claim=two production instances share a count
  test('does not ask the shared counter in test mode', async () => {
    // Arrange: the E2E server is a production build with the test flags on
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_ENV', 'test')
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MSW_MOCK', 'true')
    const memoryKey = 'sentry-tunnel:203.0.113.85'

    // Act
    await allowSharedEdgeRequest(
      reportRequest('203.0.113.85'),
      memoryKey,
      1,
      60_000,
      RATE_LIMIT_ID,
    )

    // Assert
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  // Value: protects=a stuck shared count does not hold the request
  //   fails_when=the caller waits forever for the firewall
  //   no_claim=the live host was slow
  test('counts locally when the shared counter does not answer in time', async () => {
    // Arrange
    vi.useFakeTimers()
    useProductionCounter()
    vi.mocked(checkRateLimit).mockImplementation(
      async () => new Promise(() => undefined),
    )
    const memoryKey = 'sentry-tunnel:203.0.113.86'

    // Act
    const pending = allowSharedEdgeRequest(
      reportRequest('203.0.113.86'),
      memoryKey,
      1,
      60_000,
      RATE_LIMIT_ID,
    )
    await vi.advanceTimersByTimeAsync(SHARED_EDGE_RATE_LIMIT_WAIT_MS)

    // Assert
    await expect(pending).resolves.toBe(true)
    expect(checkRateLimit).toHaveBeenCalledOnce()
  })
})

describe('proxy() shared counter', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(checkRateLimit).mockReset()
  })

  // Value: protects=a GET on the tunnel is not counted
  //   fails_when=a GET spends one of the 120 or is forwarded
  //   no_claim=the firewall rule matches every method
  test('does not ask the shared counter for a GET on the tunnel', async () => {
    // Arrange
    useProductionCounter()
    const { proxy } = await import('@/proxy')
    const getRequest = new NextRequest('https://gitbox.example/monitoring', {
      method: 'GET',
    })

    // Act
    const response = await proxy(getRequest)

    // Assert
    expect(response.status).toBe(404)
    expect(checkRateLimit).not.toHaveBeenCalled()
  })
})
