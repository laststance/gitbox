/**
 * Card Focus Targets
 *
 * Finds the elements the keyboard focus can go to around a card on the board
 * page: the card itself, and what takes over when the card leaves its column.
 * Both read the page, because the order of the cards on screen is what a
 * keyboard user moves through.
 */

import type { RepoCardId } from '@/lib/types/brands'

import { isHTMLElement } from './dom'

/** On the focusable element of a card ({@link RepoCard}); the value is the card id. */
const REPO_CARD_ID_ATTRIBUTE = 'data-repo-card-id'
/** On the root element of a column ({@link StatusColumn}); the value is the column id. */
const STATUS_COLUMN_ID_ATTRIBUTE = 'data-status-column-id'
/** On the "Add Repo" button at the bottom of a column ({@link StatusColumn}). */
const COLUMN_ADD_REPO_ATTRIBUTE = 'data-column-add-repo'

/**
 * Finds the focusable element of a card on the board page. Called by
 * {@link useCardDialogFocusReturn} to put the focus back on a card whose
 * dialog was closed without the card leaving.
 *
 * @param cardId - Id of the card.
 * @returns The card's focusable element, or `null` when the card is not on the page.
 * @example
 * findRepoCardElement(toRepoCardId('card-1'))?.focus()
 */
export function findRepoCardElement(cardId: RepoCardId): HTMLElement | null {
  // Compared in code, not in the selector, so an id never has to be escaped
  const cardElement = Array.from(
    document.querySelectorAll(`[${REPO_CARD_ID_ATTRIBUTE}]`),
  ).find((element) => element.getAttribute(REPO_CARD_ID_ATTRIBUTE) === cardId)

  return isHTMLElement(cardElement) ? cardElement : null
}

/**
 * Finds what takes the keyboard focus when a card leaves its column. Exists
 * because a card that is moved to another board or removed takes the focus
 * with it: the browser then puts the focus on the page itself, and a keyboard
 * user starts again from the top. Called by {@link useCardDialogFocusReturn}
 * right before the card leaves, while its neighbors are still known.
 *
 * @param cardId - Id of the card that is about to leave.
 * @returns
 * - The card below it in the same column
 * - The card above it, when it is the last card of the column
 * - The column's "Add Repo" button, when it is the only card
 * - `null` when the card is not on the page, or nothing of the above exists
 * @example
 * // Column "Planning" shows card-1, card-4, card-5
 * findCardFocusSuccessor(toRepoCardId('card-1')) // => element of card-4
 * findCardFocusSuccessor(toRepoCardId('card-5')) // => element of card-4
 */
export function findCardFocusSuccessor(cardId: RepoCardId): HTMLElement | null {
  const cardElement = findRepoCardElement(cardId)
  const columnElement = cardElement?.closest(`[${STATUS_COLUMN_ID_ATTRIBUTE}]`)
  if (!cardElement || !columnElement) return null

  const columnCardElements = Array.from(
    columnElement.querySelectorAll(`[${REPO_CARD_ID_ATTRIBUTE}]`),
  )
  const cardIndex = columnCardElements.indexOf(cardElement)
  const neighborElement =
    columnCardElements[cardIndex + 1] ?? columnCardElements[cardIndex - 1]
  if (isHTMLElement(neighborElement)) return neighborElement

  // The column is empty once this card is gone
  const addRepoButton = columnElement.querySelector(
    `[${COLUMN_ADD_REPO_ATTRIBUTE}]`,
  )
  return isHTMLElement(addRepoButton) ? addRepoButton : null
}
