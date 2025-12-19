/**
 * Throttle Utility
 *
 * Throttle function that allows execution only once per time period
 */

/**
 * Delay (milliseconds) for setTimeout fallback
 * when requestIdleCallback is not available
 *
 * 1ms is the minimum value to execute immediately while delaying to next event loop
 */
const IDLE_CALLBACK_FALLBACK_MS = 1

/**
 * Throttles a function
 *
 * @param fn - Function to throttle
 * @param ms - Throttle time (milliseconds)
 * @returns Throttled function and cancel function
 *
 * @example
 * ```ts
 * const { throttledFn, cancel } = throttle(saveToStorage, 1000)
 * throttledFn(state) // Executes immediately
 * throttledFn(state) // Ignored (before 1000ms elapsed)
 * // After 1000ms elapsed
 * throttledFn(state) // Executes
 * ```
 */
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): { throttledFn: (...args: Args) => void; cancel: () => void } {
  let lastCall = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Args | null = null

  const throttledFn = (...args: Args): void => {
    const now = Date.now()
    const remaining = ms - (now - lastCall)

    if (remaining <= 0) {
      // Throttle period elapsed - execute immediately
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastCall = now
      fn(...args)
    } else {
      // Within throttle period - save last arguments and execute after period
      lastArgs = args
      if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now()
          timeoutId = null
          if (lastArgs !== null) {
            fn(...lastArgs)
            lastArgs = null
          }
        }, remaining)
      }
    }
  }

  const cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  return { throttledFn, cancel }
}

/**
 * Idle-time execution throttle using requestIdleCallback
 *
 * Minimizes impact on UI performance by executing
 * when browser is in idle state
 *
 * @param fn - Function to execute
 * @param options - requestIdleCallback options
 * @returns Scheduled function and cancel function
 */
export function scheduleIdleCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  options?: IdleRequestOptions,
): { scheduledFn: (...args: Args) => void; cancel: () => void } {
  let idleId: number | null = null
  let pendingArgs: Args | null = null

  // Fall back to setTimeout if requestIdleCallback is not available
  const requestIdle =
    typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void, _opts?: IdleRequestOptions) =>
          setTimeout(cb, IDLE_CALLBACK_FALLBACK_MS) as unknown as number

  const cancelIdle =
    typeof cancelIdleCallback !== 'undefined'
      ? cancelIdleCallback
      : (id: number) => clearTimeout(id)

  const scheduledFn = (...args: Args): void => {
    pendingArgs = args

    if (idleId !== null) {
      cancelIdle(idleId)
    }

    idleId = requestIdle(() => {
      if (pendingArgs !== null) {
        fn(...pendingArgs)
        pendingArgs = null
      }
      idleId = null
    }, options)
  }

  const cancel = (): void => {
    if (idleId !== null) {
      cancelIdle(idleId)
      idleId = null
    }
    pendingArgs = null
  }

  return { scheduledFn, cancel }
}
