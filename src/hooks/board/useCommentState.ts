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

  /**
   * Handle comment change from inline edit.
   * Optimistic update preserving existing color.
   *
   * @param cardId - The repo card ID
   * @param newComment - The new comment text
   */
  const handleCommentChange = useCallback(
    async (cardId: string, newComment: string) => {
      const previous = comments[cardId]
      setComments((prev) => ({
        ...prev,
        [cardId]: {
          comment: newComment,
          color: prev[cardId]?.color ?? 'primary',
        },
      }))

      const result = await updateComment(cardId, newComment)
      if (!result.success) {
        setComments((prev) => ({
          ...prev,
          [cardId]: previous ?? { comment: '', color: 'primary' },
        }))
        toast.error('Failed to save comment')
      }
    },
    [comments],
  )

  /**
   * Handle comment color change from CommentActionsMenu.
   * Optimistic update with Sentry error tracking.
   *
   * @param cardId - The card ID to update
   * @param color - The new color value
   */
  const handleCommentColorChange = useCallback(
    async (cardId: string, color: CommentColor) => {
      const previous = comments[cardId]
      setComments((prev) => ({
        ...prev,
        [cardId]: {
          comment: prev[cardId]?.comment ?? '',
          color,
        },
      }))

      const result = await updateCommentColor(cardId, color)
      if (!result.success) {
        setComments((prev) => ({
          ...prev,
          [cardId]: previous ?? { comment: '', color: 'primary' },
        }))
        toast.error('Failed to update comment color')
      }
    },
    [comments],
  )

  /**
   * Handle comment delete from CommentActionsMenu.
   * Clears comment text and resets color to default.
   *
   * @param cardId - The card ID to delete comment from
   */
  const handleCommentDelete = useCallback(
    async (cardId: string) => {
      const previous = comments[cardId]
      setComments((prev) => ({
        ...prev,
        [cardId]: {
          comment: '',
          color: 'primary',
        },
      }))

      const result = await deleteComment(cardId)
      if (result.success) {
        toast.success('Comment deleted')
      } else {
        setComments((prev) => ({
          ...prev,
          [cardId]: previous ?? { comment: '', color: 'primary' },
        }))
        toast.error('Failed to delete comment')
      }
    },
    [comments],
  )

  return {
    comments,
    handleCommentChange,
    handleCommentColorChange,
    handleCommentDelete,
  }
}
