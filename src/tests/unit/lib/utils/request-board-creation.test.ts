/**
 * Unit Tests: requestBoardCreation()
 *
 * The one place that tells "not created" (send the name again) from "may
 * exist" (look at your boards first) for both callers, the form of
 * `/boards/new` and the Move to Another Board dialog. Its rules are pinned
 * here once; the suites of the two callers check what each of them shows for
 * an attempt.
 *
 * @see src/lib/utils/request-board-creation.ts
 */

import * as Sentry from '@sentry/nextjs'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createBoard } from '@/lib/actions/board'
import { requestBoardCreation } from '@/lib/utils/request-board-creation'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/actions/board', () => ({
  createBoard: vi.fn(),
}))

describe('requestBoardCreation()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // One test switches to fake timers to let 15 seconds pass
    vi.useRealTimers()
  })

  test('hands over the board the server created, with its columns', async () => {
    // Arrange
    vi.mocked(createBoard).mockResolvedValue({
      success: true,
      data: {
        id: 'board-7',
        name: 'Side Projects',
        isPublic: false,
        statusLists: [
          { id: 'status-1', name: 'Repositories', color: '#6B7280' },
        ],
      },
    })

    // Act
    const attempt = await requestBoardCreation('Side Projects', 'single-column')

    // Assert
    expect(attempt).toEqual({
      status: 'created',
      board: {
        id: 'board-7',
        name: 'Side Projects',
        isPublic: false,
        statusLists: [
          { id: 'status-1', name: 'Repositories', color: '#6B7280' },
        ],
      },
    })
    expect(createBoard).toHaveBeenCalledWith('Side Projects', 'single-column')
  })

  test('says a refusal of the server was not created, so the same name can be sent again', async () => {
    // Arrange
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error: 'The board was not created. Try again.',
    })

    // Act
    const attempt = await requestBoardCreation('Side Projects', 'single-column')

    // Assert
    expect(attempt).toEqual({
      status: 'not-created',
      message: 'The board was not created. Try again.',
    })
    // The server answered: nothing for the browser to report
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  test('tells a creation that may have happened by the code of the answer, whatever its text says', async () => {
    // Arrange: the code under another sentence
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error: 'We are not sure the board exists.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })

    // Act
    const attempt = await requestBoardCreation('Side Projects', 'single-column')

    // Assert: the request has ended, so the next request waits for nothing
    expect(attempt).toEqual({
      status: 'unconfirmed',
      message: 'We are not sure the board exists.',
      isRequestStillRunning: false,
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('takes a refusal that only reads like an unconfirmed creation as a refusal, because it carries no code', async () => {
    // Arrange: the sentence without the code
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
    })

    // Act
    const attempt = await requestBoardCreation('Side Projects', 'single-column')

    // Assert
    expect(attempt).toEqual({
      status: 'not-created',
      message:
        'Could not confirm that the board was created. Check your boards before trying again.',
    })
  })

  test('says the board may exist when the request fails on the way, and reports the failure', async () => {
    // Arrange: the connection broke, perhaps after the board was written
    const networkError = new TypeError('Failed to fetch')
    vi.mocked(createBoard).mockRejectedValue(networkError)

    // Act
    const attempt = await requestBoardCreation('Side Projects', 'single-column')

    // Assert
    expect(attempt).toEqual({
      status: 'unconfirmed',
      message:
        'Could not confirm that the board was created. Check your boards before trying again.',
      isRequestStillRunning: false,
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError, {
      tags: { action: 'createBoard' },
    })
  })

  test('stops waiting after 15 seconds without an answer, says the request is still running and leaves a warning', async () => {
    // Arrange: a creation the server never answers
    vi.useFakeTimers()
    vi.mocked(createBoard).mockReturnValue(new Promise(() => {}))

    // Act
    const pendingAttempt = requestBoardCreation('Side Projects', 'web-app')
    await vi.advanceTimersByTimeAsync(15_000)

    // Assert: whatever is sent next would wait behind this request
    await expect(pendingAttempt).resolves.toEqual({
      status: 'unconfirmed',
      message:
        'Could not confirm that the board was created. Check your boards before trying again.',
      isRequestStillRunning: true,
    })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'createBoard got no answer in time',
      { level: 'warning', tags: { action: 'createBoard' } },
    )
  })
})
