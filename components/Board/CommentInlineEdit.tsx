/**
 * CommentInlineEdit Component
 *
 * Inline editor for RepoCard comments with auto-save capability.
 * Phase 4: Inline Edit implementation
 *
 * Features:
 * - Auto-growing textarea
 * - Character counter with warning color
 * - Save/Cancel buttons
 * - Keyboard shortcuts (Enter=save, Esc=cancel)
 * - Auto-save with debounce (1 second)
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

'use client'

import { Check, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

import {
  COMMENT_BORDER_COLORS,
  type CommentStyleSettings,
  DEFAULT_COMMENT_STYLE,
} from './CommentDisplay'

/** Maximum character limit for inline comments */
const MAX_LENGTH = 300

/** Warning threshold (show orange counter) */
const WARNING_THRESHOLD = 270

/** Auto-save debounce delay in ms */
const AUTO_SAVE_DELAY = 1000

interface CommentInlineEditProps {
  /** Initial comment value */
  initialValue: string
  /** Callback when comment is saved */
  onSave: (value: string) => Promise<void>
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
  /** Enable auto-save with debounce */
  enableAutoSave?: boolean
}

/**
 * CommentInlineEdit Component
 *
 * Renders an inline editor for comments with save/cancel functionality.
 *
 * @param initialValue - The starting comment value
 * @param onSave - Async callback to save the comment
 * @param onCancel - Callback when user cancels editing
 * @param maxLength - Character limit (default: 300)
 * @param style - Styling configuration
 * @param autoFocus - Auto-focus textarea on mount (default: true)
 * @param enableAutoSave - Enable auto-save after typing pause (default: true)
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
    enableAutoSave = true,
  }) => {
    const [editValue, setEditValue] = useState(initialValue)
    const [isSaving, setIsSaving] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const hasChangedRef = useRef(false)

    // Merge with default styles
    const mergedStyle = { ...DEFAULT_COMMENT_STYLE, ...style }
    const borderColorClass = COMMENT_BORDER_COLORS[mergedStyle.borderColor]

    // Debounced value for auto-save
    const debouncedValue = useDebounce(editValue, AUTO_SAVE_DELAY)

    // Character count helpers
    const charCount = editValue.length
    const isOverLimit = charCount > maxLength
    const isWarning = charCount > WARNING_THRESHOLD && !isOverLimit

    /**
     * Handle save action
     */
    const handleSave = useCallback(async () => {
      if (isSaving || isOverLimit) return

      // Don't save if value hasn't changed
      if (editValue === initialValue) {
        onCancel()
        return
      }

      setIsSaving(true)
      try {
        await onSave(editValue)
      } finally {
        setIsSaving(false)
      }
    }, [editValue, initialValue, isSaving, isOverLimit, onSave, onCancel])

    /**
     * Handle cancel action
     */
    const handleCancel = useCallback(() => {
      if (isSaving) return
      onCancel()
    }, [isSaving, onCancel])

    /**
     * Handle keyboard shortcuts
     * - Enter (without Shift) = Save
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

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSave()
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
        hasChangedRef.current = true
      },
      [],
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

    // Auto-save when debounced value changes
    // Note: This effect is intentionally used for debounced auto-save,
    // which is a valid pattern for user input with delayed persistence.
    /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-live-state-to-parent, react-you-might-not-need-an-effect/no-derived-state */
    useEffect(() => {
      if (!enableAutoSave) return
      if (!hasChangedRef.current) return
      if (debouncedValue === initialValue) return
      if (isSaving) return

      // Trigger save
      handleSave()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedValue, enableAutoSave])
    /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-pass-live-state-to-parent, react-you-might-not-need-an-effect/no-derived-state */

    return (
      <div
        data-testid="comment-inline-edit"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className={cn(
          // Container styles matching CommentDisplay edit mode
          'border-l-4 rounded-r-md p-3 bg-background',
          // Use only the static border color (no hover variant)
          borderColorClass.split(' ')[0],
          className,
        )}
      >
        {/* Textarea - isolated from dnd-kit drag events */}
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          maxLength={maxLength + 50} // Allow slight overflow for better UX
          disabled={isSaving}
          data-testid="comment-textarea"
          className={cn(
            'w-full min-h-[60px] resize-none bg-transparent border-0 p-0',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'text-sm leading-relaxed',
            isOverLimit && 'text-destructive',
          )}
        />

        {/* Controls row */}
        <div className="flex items-center justify-between mt-2">
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

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
              data-testid="comment-cancel-btn"
              className="h-7 px-2 hover:bg-muted"
              aria-label="Cancel editing"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving || isOverLimit}
              data-testid="comment-save-btn"
              className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
              aria-label="Save comment"
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

CommentInlineEdit.displayName = 'CommentInlineEdit'

export default CommentInlineEdit
