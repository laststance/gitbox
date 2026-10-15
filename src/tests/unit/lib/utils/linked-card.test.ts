/**
 * The held-row link names the card, and the board scrolls to that card.
 *
 * @see src/lib/utils/linked-card.ts
 */

import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  forgetLinkedCardSearchParam,
  linkedCardHref,
  revealCardOnBoard,
} from '@/lib/utils/linked-card'

const CARD_ID = '00000000-0000-4000-8000-0000000000c2'

describe('linkedCardHref', () => {
  test('names the card on the board address', () => {
    // Arrange
    const boardId = '00000000-0000-4000-8000-0000000000b1'

    // Act
    const href = linkedCardHref(boardId, CARD_ID)

    // Assert
    expect(href).toBe(
      '/board/00000000-0000-4000-8000-0000000000b1?card=00000000-0000-4000-8000-0000000000c2',
    )
  })

  test('encodes a board id that would break the path', () => {
    // Arrange
    const boardId = 'board/with a space'

    // Act
    const href = linkedCardHref(boardId, CARD_ID)

    // Assert
    expect(href).toBe(
      '/board/board%2Fwith%20a%20space?card=00000000-0000-4000-8000-0000000000c2',
    )
  })
})

describe('revealCardOnBoard', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  test('scrolls the card to the center and focuses it', () => {
    // Arrange
    const card = document.createElement('div')
    card.tabIndex = 0
    card.setAttribute('data-repo-card-id', CARD_ID)
    const scrollIntoView = vi.fn()
    card.scrollIntoView = scrollIntoView
    document.body.append(card)

    // Act
    const revealed = revealCardOnBoard(CARD_ID)

    // Assert
    expect(revealed).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'auto',
    })
    expect(document.activeElement).toBe(card)
  })

  test('ignores a card id that is not a UUID', () => {
    // Arrange
    const card = document.createElement('div')
    card.tabIndex = 0
    card.setAttribute('data-repo-card-id', 'not-a-uuid')
    card.scrollIntoView = vi.fn()
    document.body.append(card)

    // Act
    const revealed = revealCardOnBoard('not-a-uuid"]')

    // Assert
    expect(revealed).toBe(false)
    expect(card.scrollIntoView).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(card)
  })
})

describe('forgetLinkedCardSearchParam', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/board/board-1')
  })

  test('drops the card parameter and leaves the rest of the address', () => {
    // Arrange
    window.history.replaceState(
      {},
      '',
      `/board/board-1?card=${CARD_ID}&addRepositoryTo=status-1#notes`,
    )

    // Act
    forgetLinkedCardSearchParam()

    // Assert
    expect(window.location.pathname).toBe('/board/board-1')
    expect(window.location.search).toBe('?addRepositoryTo=status-1')
    expect(window.location.hash).toBe('#notes')
  })
})
