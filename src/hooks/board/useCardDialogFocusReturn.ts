/**
 * useCardDialogFocusReturn Hook
 *
 * Decides where the keyboard focus goes when a dialog that was opened from a
 * card's menu closes. Radix hands the focus back to the element that opened a
 * dialog, but these dialogs are opened from a menu item that is gone by then,
 * so the focus would be left on the page itself.
 */

import { useCallback, useRef } from 'react'

import type { RepoCardId } from '@/lib/types/brands'
import {
  findCardFocusSuccessor,
  findRepoCardElement,
} from '@/lib/utils/card-focus-target'

/**
 * Keeps a keyboard user's place on the board when a card dialog closes: on the
 * card when it stays, on its neighbor when it was moved away or removed.
 * Called by {@link MoveToAnotherBoardDialog} and by {@link OverflowMenu} for
 * the Remove from Board confirmation.
 *
 * @param cardId - Card the dialog was opened for.
 * @returns
 * - `rememberCardSuccessor`: call right before the card leaves the board. It
 *   picks the neighbor now, while the card still stands in its column.
 * - `handleCloseAutoFocus`: pass to the dialog content's `onCloseAutoFocus`.
 * @example
 * const { rememberCardSuccessor, handleCloseAutoFocus } =
 *   useCardDialogFocusReturn(cardId)
 * // confirm: rememberCardSuccessor(); onRemove(cardId)
 * // <AlertDialogContent onCloseAutoFocus={handleCloseAutoFocus}>
 */
export function useCardDialogFocusReturn(cardId: RepoCardId): {
  rememberCardSuccessor: () => void
  handleCloseAutoFocus: (event: Event) => void
} {
  // Set while the card is leaving: what takes the focus in its place.
  // `element` is `null` when the page offers nothing (the card was not found).
  const leavingCardSuccessorRef = useRef<{
    element: HTMLElement | null
  } | null>(null)

  const rememberCardSuccessor = useCallback(() => {
    leavingCardSuccessorRef.current = {
      element: findCardFocusSuccessor(cardId),
    }
  }, [cardId])

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      // Radix would look for a trigger element and find none
      event.preventDefault()

      const leavingCardSuccessor = leavingCardSuccessorRef.current
      // A refused removal brings the card back; its next dialog starts fresh
      leavingCardSuccessorRef.current = null

      const focusTarget = leavingCardSuccessor
        ? leavingCardSuccessor.element
        : findRepoCardElement(cardId)
      focusTarget?.focus()
    },
    [cardId],
  )

  return { rememberCardSuccessor, handleCloseAutoFocus }
}
