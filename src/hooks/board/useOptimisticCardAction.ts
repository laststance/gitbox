/**
 * useOptimisticCardAction Hook
 *
 * Runs the optimistic remove + revert pattern of Remove from Board
 * (handleRemoveFromBoard in BoardPageClient), its one caller. Optimistic
 * removal, rollback and the counted board write stay together in one hook.
 *
 * Pattern: dispatch optimistic remove → await server action → revert on error.
 */

import * as Sentry from '@sentry/nextjs'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { setRepoCards, selectRepoCards } from '@/lib/redux/slices/boardSlice'
import { trackBoardWrite } from '@/lib/redux/slices/boardSyncSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { RepoCardId } from '@/lib/types/brands'
import {
  notifyFailedBoardSave,
  reportThrownBoardSave,
} from '@/lib/utils/notify-failed-board-save'
import { reportUnconfirmedBoardSave } from '@/lib/utils/report-unconfirmed-board-save'

import { useBoardRollback } from './useBoardRollback'

/**
 * Server action result shape (matches deleteRepoCard)
 */
interface CardActionResult {
  success: boolean
  error?: string
}

/**
 * Options for a card action execution
 *
 * @param actionName - Sentry tag for error tracking (e.g., 'removeFromBoard')
 * @param errorMessage - User-facing toast title on failure
 * @param successMessage - Optional toast on success (omit for silent success)
 */
interface CardActionOptions {
  actionName: string
  errorMessage: string
  successMessage?: string
}

/**
 * Hook that provides a function to execute a card action with an optimistic
 * Redux update. Called by {@link BoardPageClient} for Remove from Board.
 *
 * @returns executeCardAction - Call with cardId, serverAction, and display options
 *
 * @example
 * const executeCardAction = useOptimisticCardAction()
 *
 * const handleRemove = useCallback(
 *   (cardId: RepoCardId) => executeCardAction(cardId, deleteRepoCard, {
 *     actionName: 'removeFromBoard',
 *     errorMessage: 'Failed to remove from board',
 *     successMessage: 'Repository removed',
 *   }),
 *   [executeCardAction],
 * )
 */
export function useOptimisticCardAction() {
  const dispatch = useAppDispatch()
  const repoCards = useAppSelector(selectRepoCards)
  const { rollbackRepoCards } = useBoardRollback()

  const executeCardAction = useCallback(
    async (
      cardId: RepoCardId,
      serverAction: (id: string) => Promise<CardActionResult>,
      options: CardActionOptions,
    ) => {
      const cardExists = repoCards.some((c) => c.id === cardId)
      if (!cardExists) return

      // Snapshot for rollback
      const previousCards = repoCards

      // Optimistic remove (instant UI feedback). The array is kept so a failed
      // save can tell whether the board still shows this removal.
      const cardsWithoutCard = repoCards.filter((card) => card.id !== cardId)
      dispatch(setRepoCards(cardsWithoutCard))

      try {
        const result = await trackBoardWrite(
          dispatch,
          serverAction(cardId),
          () => reportUnconfirmedBoardSave(options.actionName),
        )
        if (!result.success) {
          const rollbackOutcome = rollbackRepoCards(
            cardsWithoutCard,
            previousCards,
          )
          Sentry.captureMessage(`${options.actionName} failed`, {
            level: 'error',
            tags: { action: options.actionName },
            extra: { error: result.error },
          })
          // The server answered, so the removal was not saved. Its sentence
          // is the second line only when the card is back on the board.
          notifyFailedBoardSave(
            options.errorMessage,
            rollbackOutcome,
            undefined,
            rollbackOutcome === 'restored' ? result.error : undefined,
          )
        } else if (options.successMessage) {
          toast.success(options.successMessage)
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { action: options.actionName },
        })
        reportThrownBoardSave(
          dispatch,
          options.errorMessage,
          rollbackRepoCards(cardsWithoutCard, previousCards),
        )
      }
    },
    [repoCards, dispatch, rollbackRepoCards],
  )

  return executeCardAction
}
