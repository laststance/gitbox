/**
 * Debounce Utility
 *
 * Debounce function that combines consecutive calls into the last single call
 */

/**
 * Debounces a function
 *
 * @param fn - Function to debounce
 * @param ms - Debounce time (milliseconds)
 * @returns Debounced function and cancel function
 *
 * @example
 * ```ts
 * const { debouncedFn, cancel } = debounce(saveToStorage, 300)
 * debouncedFn(state) // Executes after 300ms
 * debouncedFn(state) // Cancels previous and executes after 300ms
 * cancel() // Cancels pending execution
 * ```
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): { debouncedFn: (...args: Args) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debouncedFn = (...args: Args): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, ms)
  }

  const cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return { debouncedFn, cancel }
}

/**
 * Debounce with immediate execution (leading edge)
 *
 * Executes immediately on first call, subsequent calls execute after debounce period
 *
 * @param fn - Function to debounce
 * @param ms - Debounce time (milliseconds)
 * @returns Debounced function and cancel function
 */
export function debounceLeading<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): { debouncedFn: (...args: Args) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let isWaiting = false

  const debouncedFn = (...args: Args): void => {
    if (!isWaiting) {
      fn(...args)
      isWaiting = true
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      isWaiting = false
      timeoutId = null
    }, ms)
  }

  const cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    isWaiting = false
  }

  return { debouncedFn, cancel }
}
