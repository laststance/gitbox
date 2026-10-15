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
 * {@link selectHydratedBoardId} is this board. {@link KanbanBoard} draws its
 * columns only after {@link useMounted} flips, and that render does not
 * replace the card list, so a card that is stored but not drawn yet is
 * watched until it appears. A card this board does not hold is given up, and
 * the parameter is removed.
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

    const isOnBoard = repoCards.some((card) => card.id === cardId)
    if (!isOnBoard) {
      attemptedCardId.current = cardId
      forgetLinkedCardSearchParam()
      return
    }

    const reveal = (): boolean => {
      if (attemptedCardId.current === cardId) return true
      if (!revealCardOnBoard(cardId)) return false
      attemptedCardId.current = cardId
      forgetLinkedCardSearchParam()
      return true
    }

    if (reveal()) return

    // The column appears without a new card list. Watch until the card is drawn.
    const observer = new MutationObserver((): void => {
      if (reveal()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return (): void => observer.disconnect()
  }, [boardId, cardId, hydratedBoardId, repoCards])
}
