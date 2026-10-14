/**
 * Unit Tests: waiting for a request for a limited time
 *
 * The move dialog keeps itself open while a move or a board creation runs. A
 * request that never settles would keep it locked, so the wait has an end:
 * these tests pin the three ways it can end.
 *
 * @see src/lib/utils/settle-within.ts
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { settleWithin } from '@/lib/utils/settle-within'

describe('settleWithin()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('hands back the answer of a request that resolves in time', async () => {
    // Arrange
    const request = Promise.resolve({ success: true })

    // Act
    const outcome = await settleWithin(request, 15_000)

    // Assert
    expect(outcome).toEqual({ status: 'answered', answer: { success: true } })
  })

  test('reports a request that rejects as failed instead of rejecting itself', async () => {
    // Arrange
    const networkError = new TypeError('Failed to fetch')
    const request = Promise.reject(networkError)

    // Act
    const outcome = await settleWithin(request, 15_000)

    // Assert
    expect(outcome).toEqual({ status: 'failed', error: networkError })
  })

  test('reports a request as overdue once the time limit passes without an answer', async () => {
    // Arrange: a request the server never answers
    const request = new Promise<{ success: boolean }>(() => {})
    const pendingOutcome = settleWithin(request, 15_000)

    // Act
    await vi.advanceTimersByTimeAsync(15_000)

    // Assert
    await expect(pendingOutcome).resolves.toEqual({ status: 'overdue' })
  })

  test('keeps waiting until the time limit: one millisecond before it nothing is reported', async () => {
    // Arrange
    const request = new Promise<{ success: boolean }>(() => {})
    const reportOutcome = vi.fn()
    settleWithin(request, 15_000).then(reportOutcome)

    // Act
    await vi.advanceTimersByTimeAsync(14_999)

    // Assert
    expect(reportOutcome).not.toHaveBeenCalled()
  })

  test('stays with "overdue" when the answer arrives after the time limit', async () => {
    // Arrange
    let answerRequest: (answer: { success: boolean }) => void = () => {}
    const request = new Promise<{ success: boolean }>((resolve) => {
      answerRequest = resolve
    })
    const pendingOutcome = settleWithin(request, 15_000)
    await vi.advanceTimersByTimeAsync(15_000)

    // Act
    answerRequest({ success: true })

    // Assert
    await expect(pendingOutcome).resolves.toEqual({ status: 'overdue' })
  })

  test('leaves no timer behind after an answer that came in time', async () => {
    // Arrange
    const request = Promise.resolve({ success: true })

    // Act
    await settleWithin(request, 15_000)

    // Assert
    expect(vi.getTimerCount()).toBe(0)
  })

  test('stays with "overdue" when the request fails after the time limit', async () => {
    // Arrange. A rejection nobody handles would fail this test run: Vitest
    // reports unhandled rejections as errors.
    let failRequest: (error: Error) => void = () => {}
    const request = new Promise<{ success: boolean }>((_resolve, reject) => {
      failRequest = reject
    })
    const pendingOutcome = settleWithin(request, 15_000)
    await vi.advanceTimersByTimeAsync(15_000)

    // Act
    failRequest(new Error('connection reset'))

    // Assert
    await expect(pendingOutcome).resolves.toEqual({ status: 'overdue' })
  })
})
