/**
 * Comments Hook for Maintenance Page
 *
 * Manages comment CRUD operations with optimistic updates.
 * Comments arrive already loaded from the server (see maintenance/page.tsx).
 *
 * @example
 * const { comments, editingCommentId, handleCommentSave, handleColorChange } =
 *   useMaintenanceComments({ initialComments })
 */

import { useState, useCallback } from 'react'

import { type CommentSaveOptions } from '@/components/Board/CommentInlineEdit'
import {
  updateMaintenanceComment,
  updateMaintenanceCommentColor,
  deleteMaintenanceComment,
  type CommentData,
} from '@/lib/actions/maintenance-project-info'
import type { CommentColor } from '@/lib/supabase/types'

interface UseMaintenanceCommentsProps {
  initialComments: Record<string, CommentData>
}

/**
 * Hook for managing maintenance item comments
 *
 * @param props.initialComments - Server-fetched comments, keyed by maintenance id
 * @returns Comment state, editing state, and CRUD handlers
 */
export function useMaintenanceComments({
  initialComments,
}: UseMaintenanceCommentsProps) {
  const [comments, setComments] =
    useState<Record<string, CommentData>>(initialComments)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)

  /**
   * Handle click on comment area to start editing
   */
  const handleCommentClick = useCallback((repoId: string) => {
    setEditingCommentId(repoId)
  }, [])

  const handleCommentSave = useCallback(
    async (repoId: string, newComment: string, options: CommentSaveOptions) => {
      setComments((prev) => ({
        ...prev,
        [repoId]: {
          comment: newComment,
          color: prev[repoId]?.color ?? 'neutral',
        },
      }))
      await updateMaintenanceComment(repoId, newComment)
      if (options.closeOnSave) {
        setEditingCommentId(null)
      }
    },
    [],
  )

  const handleCommentCancel = useCallback(() => {
    setEditingCommentId(null)
  }, [])

  const handleColorChange = useCallback(
    async (repoId: string, color: CommentColor) => {
      setComments((prev) => ({
        ...prev,
        [repoId]: { color, comment: prev[repoId]?.comment ?? '' },
      }))
      await updateMaintenanceCommentColor(repoId, color)
    },
    [],
  )

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
