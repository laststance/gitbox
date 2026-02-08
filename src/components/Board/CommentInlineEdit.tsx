/**
 * CommentInlineEdit Component
 *
 * Inline editor for RepoCard comments with onBlur auto-save.
 * Phase 4: Inline Edit implementation
 *
 * Features:
 * - Auto-growing textarea
 * - Character counter with warning color
 * - Save/Cancel buttons
 * - Keyboard shortcuts (Enter=save, Esc=cancel)
 * - Auto-save on blur (when focus is lost)
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

'use client'

import { Check } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  COMMENT_CARD_COLORS,
  type CommentStyleSettings,
  DEFAULT_COMMENT_STYLE,
} from './CommentDisplay'

/** Maximum character limit for inline comments */
const MAX_LENGTH = 300

/** Warning threshold (show orange counter) */
const WARNING_THRESHOLD = 270

/** Options for save callback */
export interface CommentSaveOptions {
  /** Whether to close edit mode after saving (false for auto-save) */
  closeOnSave: boolean
}

interface CommentInlineEditProps {
  /** Initial comment value */
  initialValue: string
  /** Callback when comment is saved */
  onSave: (value: string, options: CommentSaveOptions) => Promise<void>
  /** Callback when editing is cancelled */
  onCancel: () => void
  /** Maximum character limit */
  maxLength?: number
  /** Style configuration (uses same as CommentDisplay) */
  style?: Partial<CommentStyleSettings>
  /** Custom class name */
  className?: string
  /** Whether to auto-focus the textarea */
  autoFocus?: boolean
}

/**
 * CommentInlineEdit Component
 *
 * Renders an inline editor for comments with save/cancel functionality.
 * Saves automatically on blur (when focus is lost).
 *
 * @param initialValue - The starting comment value
 * @param onSave - Async callback to save the comment
 * @param onCancel - Callback when user cancels editing
 * @param maxLength - Character limit (default: 300)
 * @param style - Styling configuration
 * @param autoFocus - Auto-focus textarea on mount (default: true)
 * @returns Inline edit UI with textarea and controls
 *
 * @example
 * <CommentInlineEdit
 *   initialValue="Current comment"
 *   onSave={async (value) => await updateComment(cardId, value)}
 *   onCancel={() => setIsEditing(false)}
 * />
 */
export const CommentInlineEdit = memo<CommentInlineEditProps>(
  ({
    initialValue,
    onSave,
    onCancel,
    maxLength = MAX_LENGTH,
    style = {},
    className,
    autoFocus = true,
  }) => {
    const [editValue, setEditValue] = useState(initialValue)
    const [isSaving, setIsSaving] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    // Track if cancel is in progress to prevent blur from auto-saving
    const isCancellingRef = useRef(false)

    // Merge with default styles
    const mergedStyle = { ...DEFAULT_COMMENT_STYLE, ...style }
    const cardColorClass = COMMENT_CARD_COLORS[mergedStyle.borderColor]

    // Character count helpers
    const charCount = editValue.length
    const isOverLimit = charCount > maxLength
    const isWarning = charCount >= WARNING_THRESHOLD && !isOverLimit

    /**
     * Handle save action
     *
     * @param closeOnSave - Whether to close edit mode after saving
     * @returns Promise that resolves when save is complete
     */
    const handleSave = useCallback(
      async (closeOnSave: boolean) => {
        if (isSaving || isOverLimit) return

        // Don't save if value hasn't changed
        if (editValue === initialValue) {
          if (closeOnSave) {
            onCancel()
          }
          return
        }

        setIsSaving(true)
        try {
          await onSave(editValue, { closeOnSave })
        } finally {
          setIsSaving(false)
        }
      },
      [editValue, initialValue, isSaving, isOverLimit, onSave, onCancel],
    )

    /**
     * Handle cancel action
     * Sets isCancellingRef to prevent blur from auto-saving
     */
    const handleCancel = useCallback(() => {
      if (isSaving) return
      isCancellingRef.current = true
      onCancel()
    }, [isSaving, onCancel])

    /**
     * Handle keyboard shortcuts
     * - Enter (without Shift) = Save and close
     * - Escape = Cancel
     *
     * IMPORTANT: Stops propagation for ALL keys to prevent dnd-kit's
     * KeyboardSensor from capturing Space/Enter and triggering drag mode.
     * @see https://github.com/laststance/gitbox/issues/XX
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Stop propagation for all keys to prevent dnd-kit from intercepting
        // This is critical for Space key which dnd-kit uses to start drag
        e.stopPropagation()

        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          handleSave(true) // closeOnSave: true
        } else if (e.key === 'Escape') {
          e.preventDefault()
          handleCancel()
        }
      },
      [handleSave, handleCancel],
    )

    /**
     * Handle textarea change
     */
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditValue(e.target.value)
      },
      [],
    )

    /**
     * Handle blur event - auto-save when focus is lost
     * Skips save if:
     * - Focus moves to cancel/save buttons (they handle their own actions)
     * - Cancel is in progress (Escape key was pressed)
     */
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        // Skip auto-save if cancel is in progress (Escape key race condition)
        if (isCancellingRef.current) {
          return
        }

        const relatedTarget = e.relatedTarget as HTMLElement | null
        // Skip auto-save if focus is moving to the save button
        if (relatedTarget?.closest('[data-testid="comment-save-btn"]')) {
          return
        }
        // Auto-save on blur (don't close edit mode)
        handleSave(false)
      },
      [handleSave],
    )

    // Auto-focus on mount
    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus()
        // Place cursor at end
        textareaRef.current.selectionStart = textareaRef.current.value.length
        textareaRef.current.selectionEnd = textareaRef.current.value.length
      }
    }, [autoFocus])

    return (
      <div
        data-testid="comment-inline-edit"
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          // Container styles matching CommentDisplay - full rounded card
          'rounded-md p-3',
          // Card color from COMMENT_CARD_COLORS (bg + border)
          cardColorClass,
          className,
        )}
      >
        {/* Textarea - isolated from dnd-kit drag events */}
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Add a comment..."
          maxLength={maxLength + 50} // Allow slight overflow for better UX
          disabled={isSaving}
          data-testid="comment-textarea"
          className={cn(
            'min-h-[60px] w-full resize-none border-0 bg-transparent p-0',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'text-sm leading-relaxed',
            isOverLimit && 'text-destructive',
          )}
        />

        {/* Controls row */}
        <div className="mt-2 flex items-center justify-between">
          {/* Character counter */}
          <span
            data-testid="character-counter"
            className={cn(
              'text-xs transition-colors',
              isOverLimit && 'text-destructive font-medium',
              isWarning && 'text-orange-500',
              !isOverLimit && !isWarning && 'text-muted-foreground',
            )}
          >
            {charCount}/{maxLength}
          </span>

          {/* Save button */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={async () => handleSave(true)}
            disabled={isSaving || isOverLimit}
            data-testid="comment-save-btn"
            className="text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
            aria-label="Save comment"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  },
)

CommentInlineEdit.displayName = 'CommentInlineEdit'
