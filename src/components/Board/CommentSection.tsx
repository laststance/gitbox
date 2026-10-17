'use client'

import { Activity, memo, useLayoutEffect, useRef } from 'react'

import type { CommentColor } from '@/lib/supabase/types'

import { CommentActionsMenu } from './CommentActionsMenu'
import { CommentDisplay, type CommentStyleSettings } from './CommentDisplay'
import { CommentInlineEdit, type CommentSaveOptions } from './CommentInlineEdit'

interface CommentSectionProps {
  /** Comment text */
  comment?: string | null
  /** Comment border color */
  color?: CommentColor
  /** Whether the comment is in edit mode */
  isEditing: boolean
  /** Callback to enter edit mode */
  onStartEdit: () => void
  /** Callback to save the comment */
  onSave: (newComment: string, options: CommentSaveOptions) => Promise<void>
  /** Callback to cancel editing */
  onCancel: () => void
  /** Callback to change comment color */
  onColorChange: (color: CommentColor) => void
  /** Callback to delete the comment */
  onDelete: () => void
  /** Optional style overrides for comment display */
  style?: Partial<CommentStyleSettings>
}

/**
 * Shared comment section with Activity-toggled inline edit / display.
 *
 * Encapsulates the CommentInlineEdit ↔ CommentDisplay toggle pattern
 * so RepoCard renders its comment through one component.
 *
 * @example
 * <CommentSection
 *   comment={commentData?.comment}
 *   color={commentData?.color}
 *   isEditing={isEditingComment}
 *   onStartEdit={handleCommentClick}
 *   onSave={handleCommentSave}
 *   onCancel={handleCommentCancel}
 *   onColorChange={handleColorChange}
 *   onDelete={handleCommentDelete}
 * />
 */
export const CommentSection = memo<CommentSectionProps>(
  function CommentSection({
    comment,
    color = 'neutral',
    isEditing,
    onStartEdit,
    onSave,
    onCancel,
    onColorChange,
    onDelete,
    style,
  }) {
    const mergedStyle: Partial<CommentStyleSettings> = {
      borderColor: color,
      ...style,
    }
    const commentRef = useRef<HTMLDivElement>(null)
    // The editor is open on the previous render. Closing it hides the
    // element that had the keyboard, and the comment takes it back.
    const wasEditingRef = useRef(isEditing)

    useLayoutEffect(() => {
      if (wasEditingRef.current && !isEditing) {
        commentRef.current?.focus()
      }
      wasEditingRef.current = isEditing
    }, [isEditing])

    return (
      <div>
        <Activity mode={isEditing ? 'visible' : 'hidden'}>
          <CommentInlineEdit
            initialValue={comment ?? ''}
            onSave={onSave}
            onCancel={onCancel}
            style={mergedStyle}
          />
        </Activity>
        <Activity mode={isEditing ? 'hidden' : 'visible'}>
          <CommentDisplay
            comment={comment}
            onClick={onStartEdit}
            style={mergedStyle}
            showEmptyState={true}
            focusRef={commentRef}
            renderActions={
              comment ? (
                <CommentActionsMenu
                  onEdit={onStartEdit}
                  onColorChange={onColorChange}
                  onDelete={onDelete}
                  currentColor={color}
                />
              ) : undefined
            }
          />
        </Activity>
      </div>
    )
  },
)
