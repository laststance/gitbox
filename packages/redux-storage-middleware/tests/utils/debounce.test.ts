/**
 * Debounce Utility Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { debounce, debounceLeading } from '../../src/utils/debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('executes the function after the specified time', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounce(fn, 100)

    debouncedFn('arg1')

    expect(fn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('consolidates consecutive calls into the last one', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounce(fn, 100)

    debouncedFn('arg1')
    debouncedFn('arg2')
    debouncedFn('arg3')

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg3')
  })

  it('can cancel pending execution with cancel', async () => {
    const fn = vi.fn()
    const { debouncedFn, cancel } = debounce(fn, 100)

    debouncedFn('arg1')
    cancel()

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).not.toHaveBeenCalled()
  })

  it('does not throw error when calling cancel consecutively', () => {
    const fn = vi.fn()
    const { cancel } = debounce(fn, 100)

    cancel()
    cancel()
    cancel()

    expect(true).toBe(true)
  })
})

describe('debounceLeading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('executes immediately on the first call', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounceLeading(fn, 100)

    debouncedFn('arg1')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('ignores calls within the debounce period', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounceLeading(fn, 100)

    debouncedFn('arg1')
    debouncedFn('arg2')
    debouncedFn('arg3')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('can execute again after the debounce period', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounceLeading(fn, 100)

    debouncedFn('arg1')

    await vi.advanceTimersByTimeAsync(100)

    debouncedFn('arg2')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('arg2')
  })

  it('can reset timer and waiting state with cancel', async () => {
    const fn = vi.fn()
    const { debouncedFn, cancel } = debounceLeading(fn, 100)

    debouncedFn('arg1')
    cancel()
    debouncedFn('arg2')

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
