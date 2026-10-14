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

const DEFAULT_COMMENT: CommentData = { comment: '', color: 'primary' }

interface UseCommentStateParams {
  /**
   * Comments fetched by the Server Component, plus the comments that
   * repositories added on this page brought back (issue #216). A card id that
   * appears here later is adopted; entries already in the state keep their
   * local edits. A new object is compared by identity during render, so pass
   * the same object until it changes (a fresh `{}` each render never settles).
   */
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
  const [adoptedComments, setAdoptedComments] = useState(initialComments)

  // The prop changed (a repository was added again): adopt the cards this
  // state has not seen, during render, as React recommends for state that
  // follows a prop. A card already here keeps what the user did to it.
  if (initialComments !== adoptedComments) {
    setAdoptedComments(initialComments)
    setComments((previous) => addUnseenComments(previous, initialComments))
  }

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

      // Rollback helper — used both on `{success:false}` and thrown errors so
      // a network rejection doesn't leave the UI showing un-persisted state.
      const rollback = (): void => {
        setComments((prev) => ({
          ...prev,
          [cardId]: previous ?? DEFAULT_COMMENT,
        }))
        toast.error(errorMessage)
      }

      try {
        const result = await persist()
        if (!result.success) {
          rollback()
          return
        }
        if (successMessage) toast.success(successMessage)
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: 'useCommentState.applyOptimisticUpdate', cardId },
        })
        rollback()
      }
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

/**
 * Add the comments of cards that a comment map does not hold yet.
 *
 * @param current - The comments the board shows now.
 * @param incoming - Comments from the server or from an add.
 * @returns `current` with every card id of `incoming` it lacked; `current`
 *   itself when nothing is new, so React skips the re-render.
 * @example
 * addUnseenComments({ a: x }, { a: y, b: z }) // => { a: x, b: z }
 */
function addUnseenComments(
  current: Record<string, CommentData>,
  incoming: Record<string, CommentData>,
): Record<string, CommentData> {
  const unseenEntries = Object.entries(incoming).filter(
    ([cardId]) => !(cardId in current),
  )
  if (unseenEntries.length === 0) return current
  return { ...current, ...Object.fromEntries(unseenEntries) }
}
