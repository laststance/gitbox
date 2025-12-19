/**
 * Debounce Utility
 *
 * 連続した呼び出しを最後の1回にまとめるデバウンス関数
 */

/**
 * 関数をデバウンス化
 *
 * @param fn - デバウンス化する関数
 * @param ms - デバウンス時間（ミリ秒）
 * @returns デバウンス化された関数とキャンセル関数
 *
 * @example
 * ```ts
 * const { debouncedFn, cancel } = debounce(saveToStorage, 300)
 * debouncedFn(state) // 300ms後に実行
 * debouncedFn(state) // 前回をキャンセルし、300ms後に実行
 * cancel() // 保留中の実行をキャンセル
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
 * 即時実行付きデバウンス（leading edge）
 *
 * 最初の呼び出しで即時実行し、以降の呼び出しはデバウンス期間後に実行
 *
 * @param fn - デバウンス化する関数
 * @param ms - デバウンス時間（ミリ秒）
 * @returns デバウンス化された関数とキャンセル関数
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
