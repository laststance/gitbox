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

  it('指定した時間後に関数を実行する', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounce(fn, 100)

    debouncedFn('arg1')

    expect(fn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('連続した呼び出しを最後の1回にまとめる', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounce(fn, 100)

    debouncedFn('arg1')
    debouncedFn('arg2')
    debouncedFn('arg3')

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg3')
  })

  it('cancelで保留中の実行をキャンセルできる', async () => {
    const fn = vi.fn()
    const { debouncedFn, cancel } = debounce(fn, 100)

    debouncedFn('arg1')
    cancel()

    await vi.advanceTimersByTimeAsync(100)

    expect(fn).not.toHaveBeenCalled()
  })

  it('連続したcancelを呼び出してもエラーにならない', () => {
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

  it('最初の呼び出しで即時実行する', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounceLeading(fn, 100)

    debouncedFn('arg1')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('デバウンス期間内の呼び出しは無視される', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounceLeading(fn, 100)

    debouncedFn('arg1')
    debouncedFn('arg2')
    debouncedFn('arg3')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('デバウンス期間後に再度実行できる', async () => {
    const fn = vi.fn()
    const { debouncedFn } = debounceLeading(fn, 100)

    debouncedFn('arg1')

    await vi.advanceTimersByTimeAsync(100)

    debouncedFn('arg2')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('arg2')
  })

  it('cancelでタイマーと待機状態をリセットできる', async () => {
    const fn = vi.fn()
    const { debouncedFn, cancel } = debounceLeading(fn, 100)

    debouncedFn('arg1')
    cancel()
    debouncedFn('arg2')

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
