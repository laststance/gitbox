/**
 * Unit Tests: toMoveFailure()
 *
 * The one place that tells a refused move from one that may have happened,
 * for both move dialogs. A call the server rejected without running it is
 * neither: the card is where it was, and the page has to be reloaded.
 *
 * @see src/lib/utils/move-failure.ts
 */

import { describe, expect, test } from 'vitest'

import { toMoveFailure } from '@/lib/utils/move-failure'

describe('toMoveFailure()', () => {
  test('says this page is out of date when the server does not have the action, and that the card did not move', () => {
    // Arrange: the server rejected the call without running it
    const stalePage = new Error(
      'Server Action "abc" was not found on the server.',
    )
    stalePage.name = 'UnrecognizedActionError'

    // Act
    const failure = toMoveFailure({ status: 'failed', error: stalePage })

    // Assert
    expect(failure).toEqual({
      message: 'This page is out of date. Reload the page and try again.',
      isOutcomeKnown: false,
      isPageOutOfDate: true,
    })
  })

  test('says the card may have moved when the request fails on the way', () => {
    // Arrange: the connection broke, perhaps after the card was moved
    const networkError = new TypeError('Failed to fetch')

    // Act
    const failure = toMoveFailure({ status: 'failed', error: networkError })

    // Assert
    expect(failure).toEqual({
      message:
        'Could not confirm that the card was moved. Check the board before trying again.',
      isOutcomeKnown: false,
    })
  })
})
