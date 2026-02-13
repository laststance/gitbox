/**
 * Comments Hook for Maintenance Page
 *
 * Manages comment CRUD operations with optimistic updates.
 * Batch loads comments on mount for all maintenance items.
 *
 * @example
 * const { comments, editingCommentId, handleCommentSave, handleColorChange } =
 *   useMaintenanceComments({ initialRepos })
 */

import { useState, useCallback, useEffect } from 'react'

import { type CommentSaveOptions } from '@/components/Board/CommentInlineEdit'
import {
  getCommentsForMaintenanceItems,
  updateMaintenanceComment,
  updateMaintenanceCommentColor,
  deleteMaintenanceComment,
  type CommentData,
} from '@/lib/actions/maintenance-project-info'
import type { CommentColor } from '@/lib/supabase/types'

import type { MaintenanceRepo } from '../MaintenanceClient'

interface UseMaintenanceCommentsProps {
  initialRepos: MaintenanceRepo[]
}

/**
 * Hook for managing maintenance item comments
 *
 * @param props.initialRepos - Initial repos for batch comment loading
 * @returns Comment state, editing state, and CRUD handlers
 */
export function useMaintenanceComments({
  initialRepos,
}: UseMaintenanceCommentsProps) {
  const [comments, setComments] = useState<Record<string, CommentData>>({})
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)

  // Load comments on mount (data fetching, not parent data passing)
  /* eslint-disable react-you-might-not-need-an-effect/no-pass-data-to-parent */
  useEffect(() => {
    if (initialRepos.length === 0) return
    const ids = initialRepos.map((r) => r.id)
    getCommentsForMaintenanceItems(ids).then(setComments)
  }, [initialRepos])
  /* eslint-enable react-you-might-not-need-an-effect/no-pass-data-to-parent */

  /**
   * Handle click on comment area to start editing
   */
  const handleCommentClick = useCallback((repoId: string) => {
    setEditingCommentId(repoId)
  }, [])

  /**
   * Handle saving a comment with optimistic update
   */
  const handleCommentSave = useCallback(
    async (repoId: string, newComment: string, options: CommentSaveOptions) => {
      setComments((prev) => {
        const existing = prev[repoId]
        return {
          ...prev,
          [repoId]: {
            comment: newComment,
            color: existing?.color ?? 'neutral',
          },
        }
      })
      await updateMaintenanceComment(repoId, newComment)
      if (options.closeOnSave) {
        setEditingCommentId(null)
      }
    },
    [],
  )

  /**
   * Handle cancelling comment edit
   */
  const handleCommentCancel = useCallback(() => {
    setEditingCommentId(null)
  }, [])

  /**
   * Handle color change with optimistic update
   */
  const handleColorChange = useCallback(
    async (repoId: string, color: CommentColor) => {
      setComments((prev) => {
        const existing = prev[repoId]
        return {
          ...prev,
          [repoId]: { color, comment: existing?.comment ?? '' },
        }
      })
      await updateMaintenanceCommentColor(repoId, color)
    },
    [],
  )

  /**
   * Handle delete with optimistic update
   */
  const handleCommentDelete = useCallback(async (repoId: string) => {
    setComments((prev) => ({
      ...prev,
      [repoId]: { comment: '', color: 'primary' },
    }))
    await deleteMaintenanceComment(repoId)
  }, [])

  return {
    comments,
    editingCommentId,
    handleCommentClick,
    handleCommentSave,
    handleCommentCancel,
    handleColorChange,
    handleCommentDelete,
  }
}
