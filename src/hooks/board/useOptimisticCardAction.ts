/**
 * useOptimisticCardAction Hook
 *
 * Extracts the shared optimistic remove + revert pattern used by
 * handleMoveToMaintenance and handleRemoveFromBoard in BoardPageClient.
 *
 * Pattern: dispatch optimistic remove → await server action → revert on error.
 */

import * as Sentry from '@sentry/nextjs'
import { useCallback } from 'react'
import { toast } from 'sonner'

import {
  removeRepoCard,
  setRepoCards,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { RepoCardId } from '@/lib/types/brands'

/**
 * Server action result shape (matches moveToMaintenance / deleteRepoCard)
 */
interface CardActionResult {
  success: boolean
  error?: string
}

/**
 * Options for a card action execution
 *
 * @param actionName - Sentry tag for error tracking (e.g., 'moveToMaintenance')
 * @param errorMessage - User-facing toast title on failure
 * @param successMessage - Optional toast on success (omit for silent success)
 */
interface CardActionOptions {
  actionName: string
  errorMessage: string
  successMessage?: string
}

/**
 * Hook that provides a function to execute card actions with optimistic Redux updates.
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

      // Optimistic remove (instant UI feedback)
      dispatch(removeRepoCard(cardId))

      try {
        const result = await serverAction(cardId)
        if (!result.success) {
          dispatch(setRepoCards(previousCards))
          Sentry.captureMessage(`${options.actionName} failed`, {
            level: 'error',
            tags: { action: options.actionName },
            extra: { error: result.error },
          })
          toast.error(options.errorMessage, { description: result.error })
        } else if (options.successMessage) {
          toast.success(options.successMessage)
        }
      } catch (error) {
        dispatch(setRepoCards(previousCards))
        Sentry.captureException(error, {
          tags: { action: options.actionName },
        })
        toast.error(options.errorMessage, {
          description: 'Please try again.',
        })
      }
    },
    [repoCards, dispatch],
  )

  return executeCardAction
}
