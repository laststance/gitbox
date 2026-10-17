/**
 * One count for every server instance of the two proxy limits.
 *
 * {@link edgeRateLimit} remembers an address only inside the process that
 * saw it, so a burst spread across instances walks past the number the app
 * chose. In production this asks the Vercel Firewall, which keeps one count
 * per client address for the region. Local, tests, a missing rule, a thrown
 * call, and a call that does not settle in time keep the in-process count.
 *
 * @see src/proxy.ts
 */

import { checkRateLimit } from '@vercel/firewall'

import { edgeRateLimit, getClientIp } from '@/lib/rate-limit/edge-memory'
import { isTestMode } from '@/tests/isTestMode'

/** Firewall id for browser error reports. 120 a minute, separate from sign-in. */
export const SENTRY_TUNNEL_RATE_LIMIT_ID = 'gitbox-sentry-tunnel'

/** Firewall id for the OAuth callback. 10 a minute. */
export const AUTH_CALLBACK_RATE_LIMIT_ID = 'gitbox-auth-callback'

/**
 * How long production waits for the shared count.
 *
 * The firewall client's fetch has no deadline of its own. Past this, the
 * request is counted in this process so a stuck count does not hold the tunnel.
 */
export const SHARED_EDGE_RATE_LIMIT_WAIT_MS = 2_000

/** What the firewall client answered, or the subset this app reads. */
export type SharedRateLimitResult = {
  rateLimited: boolean
  error?: 'not-found' | 'blocked'
}

/**
 * What the proxy should do with one request.
 *
 * `allow` and `refuse` are final: the in-process counter is not touched.
 * `use-memory` means the shared counter did not decide.
 */
export type SharedRateLimitDecision = 'allow' | 'refuse' | 'use-memory'

/**
 * Turns one firewall answer into allow, refuse, or the in-process counter.
 *
 * A development call that never left the machine returns the same shape as
 * a real allow, so that case must not reach this function. {@link allowSharedEdgeRequest}
 * sends `'skipped'` instead.
 *
 * @param result - The firewall answer, or `'skipped'` when this process did not ask.
 * @returns Which counter decides the request.
 */
export const sharedRateLimitDecision = (
  result: SharedRateLimitResult | 'skipped',
): SharedRateLimitDecision => {
  // Not asked. The in-process counter is the only one.
  if (result === 'skipped') return 'use-memory'
  // A block is a refusal even when the flag is also set.
  if (result.rateLimited || result.error === 'blocked') return 'refuse'
  // No rule published yet, or this host has none. Count here.
  if (result.error === 'not-found') return 'use-memory'
  return 'allow'
}

/**
 * Whether this process may ask the shared counter.
 *
 * Development returns an allow without counting, and that shape cannot be
 * told from a real allow. The E2E build is production with test mode on, so
 * both have to skip the question or Playwright would call the live counter.
 *
 * @returns True only for a production process that is not the E2E app.
 */
const asksSharedCounter = (): boolean =>
  process.env.NODE_ENV === 'production' && !isTestMode()

/**
 * Asks the shared counter, then the in-process one when the shared one did not decide.
 *
 * Called by the proxy for each tunnel POST and each `/auth/callback`. A true
 * result means the request is inside the limit.
 *
 * @param request - The incoming request. Its client address is the shared key.
 * @param memoryKey - Key for {@link edgeRateLimit} when the shared counter does not decide.
 * @param maxRequests - How many requests the memory window allows.
 * @param windowMs - Memory window length.
 * @param rateLimitId - Firewall rule id. The tunnel and the callback do not share one.
 * @returns True when the request is allowed.
 */
export const allowSharedEdgeRequest = async (
  request: Request,
  memoryKey: string,
  maxRequests: number,
  windowMs: number,
  rateLimitId: string,
): Promise<boolean> => {
  // Local and tests never ask. Their counter is the one the unit tests pin.
  if (!asksSharedCounter()) {
    return edgeRateLimit(memoryKey, maxRequests, windowMs)
  }

  const result = await askSharedCounter(request, rateLimitId)
  const decision = sharedRateLimitDecision(result)
  // The shared counter answered. Do not also spend the in-process budget.
  if (decision === 'allow') return true
  if (decision === 'refuse') return false
  return edgeRateLimit(memoryKey, maxRequests, windowMs)
}

/**
 * One attempt to read the shared counter, bounded by {@link SHARED_EDGE_RATE_LIMIT_WAIT_MS}.
 *
 * A throw and a timeout both come back as a skipped decision so the caller
 * uses memory. The rejection is handled here and is not reported onward:
 * the tunnel would otherwise file a Sentry event for every report it could
 * not count.
 *
 * @param request - Passed through so the firewall client can see the address.
 * @param rateLimitId - Which published rule to count against.
 * @returns The firewall answer, or `'skipped'` when none arrived in time.
 */
const askSharedCounter = async (
  request: Request,
  rateLimitId: string,
): Promise<SharedRateLimitResult | 'skipped'> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  // Both sides of the race settle. A late rejection must not surface after the winner.
  const answered = checkRateLimit(rateLimitId, {
    request,
    rateLimitKey: getClientIp(request),
  }).then(
    (result) => ({ kind: 'result' as const, result }),
    () => ({ kind: 'failed' as const }),
  )
  const timedOut = new Promise<{ kind: 'timeout' }>((resolve) => {
    timer = setTimeout(
      () => resolve({ kind: 'timeout' }),
      SHARED_EDGE_RATE_LIMIT_WAIT_MS,
    )
  })

  const raced = await Promise.race([answered, timedOut])
  if (timer !== undefined) clearTimeout(timer)
  if (raced.kind !== 'result') return 'skipped'
  return raced.result
}
