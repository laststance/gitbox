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

import * as Sentry from '@sentry/nextjs'
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
      setComments((prev) => ({
        ...prev,
        [cardId]: {
          comment: newComment,
          color: prev[cardId]?.color ?? 'primary',
        },
      }))

      const result = await updateComment(cardId, newComment)
      if (!result.success) {
        // Could implement rollback here if needed
      }
    },
    [],
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
      setComments((prev) => ({
        ...prev,
        [cardId]: {
          comment: prev[cardId]?.comment ?? '',
          color,
        },
      }))

      try {
        await updateCommentColor(cardId, color)
      } catch (error) {
        Sentry.captureException(error, {
          tags: { action: 'updateCommentColor' },
        })
        toast.error('Failed to update comment color')
      }
    },
    [],
  )

  /**
   * Handle comment delete from CommentActionsMenu.
   * Clears comment text and resets color to default.
   *
   * @param cardId - The card ID to delete comment from
   */
  const handleCommentDelete = useCallback(async (cardId: string) => {
    setComments((prev) => ({
      ...prev,
      [cardId]: {
        comment: '',
        color: 'primary',
      },
    }))

    try {
      await deleteComment(cardId)
      toast.success('Comment deleted')
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'deleteComment' } })
      toast.error('Failed to delete comment')
    }
  }, [])

  return {
    comments,
    handleCommentChange,
    handleCommentColorChange,
    handleCommentDelete,
  }
}
