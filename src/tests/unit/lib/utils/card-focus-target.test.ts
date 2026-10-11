/**
 * Unit Tests: card focus targets
 *
 * Where the keyboard focus goes around a card on the board page: back to the
 * card, or to what takes over when the card is moved away or removed. A wrong
 * answer here drops a keyboard user at the top of the page after every move.
 *
 * @see src/lib/utils/card-focus-target.ts
 */

import { beforeEach, describe, expect, test } from 'vitest'

import { toRepoCardId } from '@/lib/types/brands'
import {
  findCardFocusSuccessor,
  findRepoCardElement,
} from '@/lib/utils/card-focus-target'

/**
 * A column the way the board renders one: its cards top to bottom, each in a
 * wrapper element, and optionally the "Add Repo" button below them.
 * @param columnId - Id of the column.
 * @param cardIds - Ids of its cards, top to bottom.
 * @param hasAddRepoButton - Whether the column ends with an "Add Repo" button.
 * @returns The column element.
 */
function buildColumn(
  columnId: string,
  cardIds: string[],
  hasAddRepoButton: boolean,
): HTMLElement {
  const columnElement = document.createElement('div')
  columnElement.setAttribute('data-status-column-id', columnId)

  for (const cardId of cardIds) {
    const cardElement = document.createElement('div')
    cardElement.tabIndex = 0
    cardElement.setAttribute('data-repo-card-id', cardId)
    cardElement.textContent = cardId

    const cardWrapper = document.createElement('div')
    cardWrapper.append(cardElement)
    columnElement.append(cardWrapper)
  }

  if (hasAddRepoButton) {
    const addRepoButton = document.createElement('button')
    addRepoButton.setAttribute('data-column-add-repo', '')
    addRepoButton.id = `${columnId}-add-repo`
    addRepoButton.textContent = 'Add Repo'
    columnElement.append(addRepoButton)
  }

  return columnElement
}

/**
 * Put two columns on the page: "planning" with the given cards and "done"
 * with card-9, each with an "Add Repo" button.
 * @param planningCardIds - Ids of the cards in planning, top to bottom.
 */
function renderBoard(planningCardIds: string[]): void {
  document.body.replaceChildren(
    buildColumn('planning', planningCardIds, true),
    buildColumn('done', ['card-9'], true),
  )
}

describe('findRepoCardElement()', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  test('finds the focusable element of a card that is on the page', () => {
    // Arrange
    renderBoard(['card-1', 'card-4', 'card-5'])

    // Act
    const cardElement = findRepoCardElement(toRepoCardId('card-4'))

    // Assert
    expect(cardElement?.textContent).toBe('card-4')
    expect(cardElement?.tabIndex).toBe(0)
  })

  test('answers null for a card that is not on the page', () => {
    // Arrange
    renderBoard(['card-1'])

    // Act
    const cardElement = findRepoCardElement(toRepoCardId('card-2'))

    // Assert
    expect(cardElement).toBeNull()
  })
})

describe('findCardFocusSuccessor()', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  test('hands the focus to the card below the one that leaves', () => {
    // Arrange
    renderBoard(['card-1', 'card-4', 'card-5'])

    // Act
    const successor = findCardFocusSuccessor(toRepoCardId('card-1'))

    // Assert
    expect(successor?.getAttribute('data-repo-card-id')).toBe('card-4')
  })

  test('hands the focus to the card above when the last card of a column leaves', () => {
    // Arrange
    renderBoard(['card-1', 'card-4', 'card-5'])

    // Act
    const successor = findCardFocusSuccessor(toRepoCardId('card-5'))

    // Assert
    expect(successor?.getAttribute('data-repo-card-id')).toBe('card-4')
  })

  test('hands the focus to the "Add Repo" button of the column when its only card leaves, not to a card of another column', () => {
    // Arrange
    renderBoard(['card-1'])

    // Act
    const successor = findCardFocusSuccessor(toRepoCardId('card-1'))

    // Assert
    expect(successor?.id).toBe('planning-add-repo')
  })

  test('answers null for a card that is not on the page', () => {
    // Arrange
    renderBoard(['card-1', 'card-4'])

    // Act
    const successor = findCardFocusSuccessor(toRepoCardId('card-2'))

    // Assert
    expect(successor).toBeNull()
  })

  test('answers null when the only card of a column without an "Add Repo" button leaves', () => {
    // Arrange
    document.body.replaceChildren(buildColumn('planning', ['card-1'], false))

    // Act
    const successor = findCardFocusSuccessor(toRepoCardId('card-1'))

    // Assert
    expect(successor).toBeNull()
  })
})
