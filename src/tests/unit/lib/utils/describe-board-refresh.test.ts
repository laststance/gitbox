/**
 * Unit tests: the sentence after a board is refreshed from GitHub.
 */

import { describe, expect, test } from 'vitest'

import { describeBoardRefresh } from '@/lib/utils/describe-board-refresh'

describe('describeBoardRefresh', () => {
  // Value: protects=an empty board says there was nothing to refresh; fails_when=the toast says zero cards were refreshed and looks like a failure; why_new=the board button; seam=none; no_claim=the button's disabled state
  test('says an empty board has no cards to refresh', () => {
    // Arrange
    const result = { updated: 0, failed: 0, remaining: 0 }

    // Act
    const sentence = describeBoardRefresh(result)

    // Assert
    expect(sentence).toBe('This board has no cards to refresh.')
  })

  // Value: protects=one refreshed card is named in the singular; fails_when=the toast says "1 cards"; why_new=the sentence; seam=none; no_claim=the card menu's own toast
  test('names a single refreshed card', () => {
    // Arrange
    const result = { updated: 1, failed: 0, remaining: 0 }

    // Act
    const sentence = describeBoardRefresh(result)

    // Assert
    expect(sentence).toBe('Refreshed 1 card from GitHub.')
  })

  // Value: protects=a board that was only partly read says how many were left unread and that another refresh continues; fails_when=the toast says every card was refreshed while some were not; why_new=one refresh stops at 100 cards; seam=none; no_claim=which cards were skipped
  test('says how many cards were unread and that the rest wait', () => {
    // Arrange
    const result = { updated: 98, failed: 2, remaining: 15 }

    // Act
    const sentence = describeBoardRefresh(result)

    // Assert
    expect(sentence).toBe(
      'Refreshed 98 cards from GitHub. 2 could not be read. Refresh again for the rest.',
    )
  })

  // Value: protects=a board whose cards GitHub would not return is not announced as a success; fails_when=the toast says the board was refreshed; why_new=every card in the batch can fail; seam=none; no_claim=which toast method the page calls
  test('says nothing could be read when every card failed', () => {
    // Arrange
    const result = { updated: 0, failed: 3, remaining: 0 }

    // Act
    const sentence = describeBoardRefresh(result)

    // Assert
    expect(sentence).toBe('No card could be read from GitHub.')
  })
})
