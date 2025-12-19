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

  it('executes immediately on the first call', () => {
    const fn = vi.fn()
    const { throttledFn } = throttle(fn, 100)

    throttledFn('arg1')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('executes calls within throttle period after the period ends', async () => {
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

  it('can execute immediately again after the throttle period', async () => {
    const fn = vi.fn()
    const { throttledFn } = throttle(fn, 100)

    throttledFn('arg1')

    await vi.advanceTimersByTimeAsync(100)

    throttledFn('arg2')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('arg2')
  })

  it('can cancel pending execution with cancel', async () => {
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

  it('falls back to setTimeout when requestIdleCallback is not available', async () => {
    const fn = vi.fn()
    const { scheduledFn } = scheduleIdleCallback(fn)

    scheduledFn('arg1')

    expect(fn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('uses the last argument when called consecutively', async () => {
    const fn = vi.fn()
    const { scheduledFn } = scheduleIdleCallback(fn)

    scheduledFn('arg1')
    scheduledFn('arg2')
    scheduledFn('arg3')

    await vi.advanceTimersByTimeAsync(1)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg3')
  })

  it('can cancel pending execution with cancel', async () => {
    const fn = vi.fn()
    const { scheduledFn, cancel } = scheduleIdleCallback(fn)

    scheduledFn('arg1')
    cancel()

    await vi.advanceTimersByTimeAsync(1)

    expect(fn).not.toHaveBeenCalled()
  })
})
