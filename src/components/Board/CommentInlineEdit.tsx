/**
 * CommentInlineEdit Component
 *
 * Inline editor for RepoCard comments with onBlur auto-save.
 * Phase 4: Inline Edit implementation
 *
 * Features:
 * - Auto-growing textarea
 * - Character counter that warns near the limit and turns red over it
 * - Save/Cancel buttons
 * - Keyboard shortcuts (Enter=save, Esc=cancel)
 * - Auto-save on blur (when focus is lost)
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

'use client'

import { Check } from 'lucide-react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NEAR_LIMIT_COUNTER_TEXT_CLASS } from '@/lib/constants/character-counter'
import { cn } from '@/lib/utils'
import { COMMENT_MAX_LENGTH } from '@/lib/validations/project-info'

import {
  COMMENT_CARD_COLORS,
  type CommentStyleSettings,
  DEFAULT_COMMENT_STYLE,
} from './CommentDisplay'

/** Maximum character limit for inline comments (from shared validation) */
const MAX_LENGTH = COMMENT_MAX_LENGTH

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
    // Ties the counter to the field, so a screen reader reads it with the field
    const counterId = useId()
    // Track if cancel is in progress to prevent blur from auto-saving
    const isCancellingRef = useRef(false)

    // Merge with default styles
    const mergedStyle = { ...DEFAULT_COMMENT_STYLE, ...style }
    const cardColorClass = COMMENT_CARD_COLORS[mergedStyle.borderColor]

    // Character count helpers
    const charCount = editValue.length
    const warningThreshold = Math.floor(maxLength * 0.9)
    const isOverLimit = charCount > maxLength
    const isWarning = charCount >= warningThreshold && !isOverLimit

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
          // Show toast only on explicit save (Enter/button), not on blur auto-save
          if (closeOnSave) {
            toast.success('Comment saved')
          }
        } catch {
          toast.error('Failed to save comment')
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
    /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- focusing imperatively on mount is a valid effect, not a derived event handler */
    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus()
        // Place cursor at end
        textareaRef.current.selectionStart = textareaRef.current.value.length
        textareaRef.current.selectionEnd = textareaRef.current.value.length
      }
    }, [autoFocus])
    /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

    return (
      <div
        data-testid="comment-inline-edit"
        // Read by may-start-drag.ts: no press in the editor picks the card up,
        // on its field and its button as on its counter and the space around them
        data-no-drag
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
          aria-invalid={isOverLimit}
          aria-describedby={counterId}
          data-testid="comment-textarea"
          // The text keeps its color over the limit: the destructive red
          // drops to 3.0:1 on the tinted box (Dark). The counter says it.
          className={cn(
            'min-h-[60px] w-full resize-none border-0 bg-transparent p-0',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'text-sm leading-relaxed',
          )}
        />

        {/* Controls row */}
        <div className="mt-2 flex items-center justify-between">
          {/* Character counter. It stands on the comment's tinted box: one
              of eight colors at 20% over the card, 25% under the pointer.
              70% of the foreground passes 4.5:1 on every tint of every
              theme. No warning color does: orange 800 drops to 4.2:1 on the
              hovered primary tint (default theme) and the destructive red to
              3.0:1 (Dark). So the two warning states paint their own
              surface. The padding is there in every state and the negative
              margin takes it back, so the digits stay where they are when
              the state changes. Checked in
              comment-counter-contrast.test.ts. */}
          <span
            id={counterId}
            data-testid="character-counter"
            className={cn(
              '-ml-1.5 rounded px-1.5 py-0.5 text-xs transition-colors',
              isOverLimit &&
                'bg-destructive text-destructive-foreground font-medium',
              isWarning && `bg-background ${NEAR_LIMIT_COUNTER_TEXT_CLASS}`,
              !isOverLimit && !isWarning && 'text-foreground/70',
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
