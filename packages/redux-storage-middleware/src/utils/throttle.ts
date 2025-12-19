/**
 * Throttle Utility
 *
 * 一定期間に1回だけ実行を許可するスロットル関数
 */

/**
 * 関数をスロットル化
 *
 * @param fn - スロットル化する関数
 * @param ms - スロットル時間（ミリ秒）
 * @returns スロットル化された関数とキャンセル関数
 *
 * @example
 * ```ts
 * const { throttledFn, cancel } = throttle(saveToStorage, 1000)
 * throttledFn(state) // 即時実行
 * throttledFn(state) // 無視（1000ms経過前）
 * // 1000ms経過後
 * throttledFn(state) // 実行
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
      // スロットル期間経過済み - 即時実行
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastCall = now
      fn(...args)
    } else {
      // スロットル期間内 - 最後の引数を保存し、期間後に実行
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
 * requestIdleCallback を使用したアイドル時実行スロットル
 *
 * ブラウザがアイドル状態の時に実行することで、
 * UIパフォーマンスへの影響を最小化
 *
 * @param fn - 実行する関数
 * @param options - requestIdleCallback のオプション
 * @returns スケジュールされた関数とキャンセル関数
 */
export function scheduleIdleCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  options?: IdleRequestOptions,
): { scheduledFn: (...args: Args) => void; cancel: () => void } {
  let idleId: number | null = null
  let pendingArgs: Args | null = null

  // requestIdleCallback が利用できない場合は setTimeout にフォールバック
  const requestIdle =
    typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void, _opts?: IdleRequestOptions) =>
          setTimeout(cb, 1) as unknown as number

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
