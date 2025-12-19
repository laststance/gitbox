/**
 * Throttle Utility Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { throttle, scheduleIdleCallback } from '../../src/utils/throttle'

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('最初の呼び出しで即時実行する', () => {
    const fn = vi.fn()
    const { throttledFn } = throttle(fn, 100)

    throttledFn('arg1')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('スロットル期間内の呼び出しは期間後に実行される', async () => {
    const fn = vi.fn()
    const { throttledFn } = throttle(fn, 100)

    throttledFn('arg1')
    throttledFn('arg2')
    throttledFn('arg3')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('arg3')
  })

  it('スロットル期間後に再度即時実行できる', async () => {
    const fn = vi.fn()
    const { throttledFn } = throttle(fn, 100)

    throttledFn('arg1')

    await vi.advanceTimersByTimeAsync(100)

    throttledFn('arg2')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('arg2')
  })

  it('cancelで保留中の実行をキャンセルできる', async () => {
    const fn = vi.fn()
    const { throttledFn, cancel } = throttle(fn, 100)

    throttledFn('arg1')
    throttledFn('arg2')
    cancel()

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })
})

describe('scheduleIdleCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requestIdleCallbackが利用できない場合はsetTimeoutにフォールバック', async () => {
    const fn = vi.fn()
    const { scheduledFn } = scheduleIdleCallback(fn)

    scheduledFn('arg1')

    expect(fn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('連続した呼び出しで最後の引数が使われる', async () => {
    const fn = vi.fn()
    const { scheduledFn } = scheduleIdleCallback(fn)

    scheduledFn('arg1')
    scheduledFn('arg2')
    scheduledFn('arg3')

    await vi.advanceTimersByTimeAsync(1)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg3')
  })

  it('cancelで保留中の実行をキャンセルできる', async () => {
    const fn = vi.fn()
    const { scheduledFn, cancel } = scheduleIdleCallback(fn)

    scheduledFn('arg1')
    cancel()

    await vi.advanceTimersByTimeAsync(1)

    expect(fn).not.toHaveBeenCalled()
  })
})
