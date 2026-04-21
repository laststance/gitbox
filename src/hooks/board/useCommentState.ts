/**
 * useCommentState Hook
 *
 * Manages comment CRUD operations for repo cards on the Kanban board.
 * All mutations use optimistic updates with database persistence.
 * Error handling includes Sentry reporting and toast feedback.
 *
 * @example
 * const { comments, handleCommentChange, handleCommentColorChange, handleCommentDelete } =
 *   useCommentState({ initialComments })
 * <SortableColumn comments={comments} onCommentChange={handleCommentChange} />
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import {
  updateComment,
  updateCommentColor,
  deleteComment,
  type CommentData,
} from '@/lib/actions/project-info'
import type { CommentColor } from '@/lib/supabase/types'

const DEFAULT_COMMENT: CommentData = { comment: '', color: 'primary' }

interface UseCommentStateParams {
  /** Initial comments fetched by Server Component (Phase 4) */
  initialComments: Record<string, CommentData>
}

interface UseCommentStateReturn {
  /** Current comments map: cardId → comment data (text + color) */
  comments: Record<string, CommentData>
  /** Update comment text with optimistic update + DB persist */
  handleCommentChange: (cardId: string, newComment: string) => Promise<void>
  /** Update comment color with optimistic update + DB persist + Sentry error tracking */
  handleCommentColorChange: (
    cardId: string,
    color: CommentColor,
  ) => Promise<void>
  /** Delete comment (clear text, reset color) with optimistic update + DB persist */
  handleCommentDelete: (cardId: string) => Promise<void>
}

/**
 * Hook for comment state management with optimistic updates.
 *
 * @param params - Initial comments from server
 * @returns Comment state and CRUD handlers
 *
 * @example
 * const { comments, handleCommentChange } = useCommentState({
 *   initialComments: serverFetchedComments,
 * })
 * // handleCommentChange('card-id', 'New comment text')
 */
export function useCommentState(
  params: UseCommentStateParams,
): UseCommentStateReturn {
  const { initialComments } = params

  const [comments, setComments] =
    useState<Record<string, CommentData>>(initialComments)

  const applyOptimisticUpdate = useCallback(
    async (
      cardId: string,
      optimistic: (prev: CommentData | undefined) => CommentData,
      persist: () => Promise<{ success: boolean }>,
      errorMessage: string,
      successMessage?: string,
    ) => {
      const previous = comments[cardId]
      setComments((prev) => ({ ...prev, [cardId]: optimistic(prev[cardId]) }))

      const result = await persist()
      if (!result.success) {
        setComments((prev) => ({
          ...prev,
          [cardId]: previous ?? DEFAULT_COMMENT,
        }))
        toast.error(errorMessage)
        return
      }
      if (successMessage) toast.success(successMessage)
    },
    [comments],
  )

  const handleCommentChange = useCallback(
    async (cardId: string, newComment: string) =>
      applyOptimisticUpdate(
        cardId,
        (prev) => ({ comment: newComment, color: prev?.color ?? 'primary' }),
        async () => updateComment(cardId, newComment),
        'Failed to save comment',
      ),
    [applyOptimisticUpdate],
  )

  const handleCommentColorChange = useCallback(
    async (cardId: string, color: CommentColor) =>
      applyOptimisticUpdate(
        cardId,
        (prev) => ({ comment: prev?.comment ?? '', color }),
        async () => updateCommentColor(cardId, color),
        'Failed to update comment color',
      ),
    [applyOptimisticUpdate],
  )

  const handleCommentDelete = useCallback(
    async (cardId: string) =>
      applyOptimisticUpdate(
        cardId,
        () => DEFAULT_COMMENT,
        async () => deleteComment(cardId),
        'Failed to delete comment',
        'Comment deleted',
      ),
    [applyOptimisticUpdate],
  )

  return {
    comments,
    handleCommentChange,
    handleCommentColorChange,
    handleCommentDelete,
  }
}
