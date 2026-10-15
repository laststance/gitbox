import { useSearchParams } from 'next/navigation'
import { useLayoutEffect, useRef } from 'react'

import { selectRepoCards } from '@/lib/redux/slices/boardSlice'
import { selectHydratedBoardId } from '@/lib/redux/slices/boardSyncSlice'
import { useAppSelector } from '@/lib/redux/store'
import type { BoardId } from '@/lib/types/brands'
import {
  forgetLinkedCardSearchParam,
  LINKED_CARD_SEARCH_PARAM,
  revealCardOnBoard,
} from '@/lib/utils/linked-card'

/**
 * Scrolls to and focuses the card named by the held-row link.
 *
 * Called once by {@link BoardPageClient}. The store can still hold another
 * board's cards when this page mounts, so the reveal waits until
 * {@link selectHydratedBoardId} is this board. A card that is on the board
 * but not in the document yet (the column has not drawn it) is tried again
 * on the next cards update. A card this board does not hold is given up, and
 * the parameter is removed either way.
 *
 * @param boardId - Board this page is showing.
 * @example
 * useRevealLinkedCard(boardId)
 */
export function useRevealLinkedCard(boardId: BoardId): void {
  const searchParams = useSearchParams()
  const cardId = searchParams.get(LINKED_CARD_SEARCH_PARAM)
  const hydratedBoardId = useAppSelector(selectHydratedBoardId)
  const repoCards = useAppSelector(selectRepoCards)
  const attemptedCardId = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (cardId === null || cardId.length === 0) return
    // Another board's cards may still be what the store and the page show.
    if (hydratedBoardId !== boardId) return
    if (attemptedCardId.current === cardId) return

    const revealed = revealCardOnBoard(cardId)
    const isOnBoard = repoCards.some((card) => card.id === cardId)
    // The card belongs here and the column has not drawn it yet.
    if (!revealed && isOnBoard) return

    attemptedCardId.current = cardId
    forgetLinkedCardSearchParam()
  }, [boardId, cardId, hydratedBoardId, repoCards])
}
