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
 *   picks the neighbor now, while the card still stands in its column, and
 *   the neighbor takes the focus when the dialog closes.
 * - `rememberCardMayLeave`: call when the card may be gone by the time the
 *   dialog closes without the dialog knowing (a move whose outcome is
 *   unknown, before the board is fetched again). The card keeps the focus
 *   when it is still on the page then; its neighbor takes it otherwise.
 * - `handleCloseAutoFocus`: pass to the dialog content's `onCloseAutoFocus`.
 * @example
 * const { rememberCardSuccessor, handleCloseAutoFocus } =
 *   useCardDialogFocusReturn(cardId)
 * // confirm: rememberCardSuccessor(); onRemove(cardId)
 * // <AlertDialogContent onCloseAutoFocus={handleCloseAutoFocus}>
 */
export function useCardDialogFocusReturn(cardId: RepoCardId): {
  rememberCardSuccessor: () => void
  rememberCardMayLeave: () => void
  handleCloseAutoFocus: (event: Event) => void
} {
  // What takes the focus in the card's place, picked while the card stood in
  // its column. `null` until one was picked, or when the page offered nothing.
  const cardSuccessorRef = useRef<HTMLElement | null>(null)
  // Set while the card is leaving for sure. Its element can still be on the
  // page then (it plays its exit animation) and must not take the focus.
  const isCardLeavingRef = useRef(false)

  const rememberCardMayLeave = useCallback(() => {
    // A card that is gone already has no neighbors: keep the earlier pick
    cardSuccessorRef.current =
      findCardFocusSuccessor(cardId) ?? cardSuccessorRef.current
  }, [cardId])

  const rememberCardSuccessor = useCallback(() => {
    rememberCardMayLeave()
    isCardLeavingRef.current = true
  }, [rememberCardMayLeave])

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      // Radix would look for a trigger element and find none
      event.preventDefault()

      const isCardLeaving = isCardLeavingRef.current
      const cardSuccessor = cardSuccessorRef.current
      // A refused removal brings the card back; its next dialog starts fresh
      isCardLeavingRef.current = false
      cardSuccessorRef.current = null

      const cardElement = isCardLeaving ? null : findRepoCardElement(cardId)
      // The successor may have left the page since it was picked
      const focusTarget =
        cardElement ?? (cardSuccessor?.isConnected ? cardSuccessor : null)
      focusTarget?.focus()
    },
    [cardId],
  )

  return { rememberCardSuccessor, rememberCardMayLeave, handleCloseAutoFocus }
}
