/**
 * InlineEditableText Component
 *
 * Click-to-edit single-line text input. Displays text as a static element,
 * switches to an input on click, saves on Enter/blur, cancels on Escape.
 *
 * Features:
 * - Polymorphic display element (h1/p/span) via `as` prop
 * - Auto-focus and select-all on edit mode entry (callback ref)
 * - IME composition handling (prevents Enter from saving mid-composition)
 * - Blur auto-save with race condition prevention
 * - Keyboard shortcuts (Enter=save, Escape=cancel)
 * - Placeholder text when value is empty
 *
 * @see CommentInlineEdit for similar textarea-based pattern
 */

'use client'

import { memo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type EditableElement = 'h1' | 'h2' | 'h3' | 'p' | 'span'

interface InlineEditableTextProps {
  /** Current display value */
  value: string
  /**
   * Async callback when value is committed.
   * Throw an error to signal failure and revert the value.
   *
   * @param newValue - The new text value to save
   * @returns Promise that resolves on success
   *
   * @example
   * onSave={async (v) => {
   *   const result = await renameBoardDirect(boardId, v)
   *   if (!result.success) throw new Error(result.error)
   * }}
   */
  onSave: (newValue: string) => Promise<void>
  /** Placeholder shown when value is empty (clickable to edit) */
  placeholder?: string
  /** Maximum character limit for the input */
  maxLength?: number
  /** HTML element for display mode */
  as?: EditableElement
  /** Class name for the display text element */
  className?: string
  /** Class name for the input element */
  inputClassName?: string
  /** Accessible label for the input */
  ariaLabel?: string
  /** Test ID for the component */
  'data-testid'?: string
}

/**
 * InlineEditableText Component
 *
 * Renders text that becomes an input field on click. Saves on Enter or blur,
 * cancels on Escape. Handles IME input and blur/Enter race conditions.
 *
 * @param value - Current text to display
 * @param onSave - Async callback to persist the new value (throw to revert)
 * @param placeholder - Text shown when value is empty
 * @param maxLength - Character limit for the input
 * @param as - HTML element type for display mode (default: 'span')
 * @param className - CSS classes for the display element
 * @param inputClassName - CSS classes for the input element
 * @param ariaLabel - Accessible label for the input field
 * @returns Inline editable text UI
 *
 * @example
 * <InlineEditableText
 *   value={boardName}
 *   onSave={async (v) => await renameBoardDirect(boardId, v)}
 *   maxLength={50}
 *   as="h1"
 *   className="text-xl font-bold"
 *   ariaLabel="Board title"
 * />
 */
export const InlineEditableText = memo<InlineEditableTextProps>(
  ({
    value,
    onSave,
    placeholder = 'Click to edit...',
    maxLength,
    as: Element = 'span',
    className,
    inputClassName,
    ariaLabel,
    'data-testid': testId,
  }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const isComposingRef = useRef(false)
    const isSavingRef = useRef(false)
    // Guard: only auto-focus once per edit session (prevents re-select on re-render)
    const hasFocusedRef = useRef(false)
    // Track the prop value to detect external changes
    const prevValueRef = useRef(value)

    // Sync editValue when prop changes externally (not from our own save)
    if (prevValueRef.current !== value) {
      prevValueRef.current = value
      if (!isEditing) {
        setEditValue(value)
      }
    }

    // Edit mode: render input
    if (isEditing) {
      // Plain async function — not useCallback because it's only called
      // from inline handlers on intrinsic <input> (useCallback would be pointless)
      const save = async () => {
        if (isSavingRef.current) return
        isSavingRef.current = true

        const trimmed = editValue.trim()

        // No change — just exit
        if (trimmed === value) {
          setEditValue(value)
          hasFocusedRef.current = false
          setIsEditing(false)
          isSavingRef.current = false
          return
        }

        try {
          await onSave(trimmed)
          // onSave succeeded — keep the new value
          setEditValue(trimmed)
          hasFocusedRef.current = false
          setIsEditing(false)
        } catch {
          // onSave failed — revert to original
          setEditValue(value)
          hasFocusedRef.current = false
          setIsEditing(false)
        } finally {
          isSavingRef.current = false
        }
      }

      return (
        <input
          ref={(node) => {
            if (node && !hasFocusedRef.current) {
              hasFocusedRef.current = true
              node.focus()
              node.select()
            }
          }}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()

            if (e.key === 'Enter') {
              // Guard against IME composition (JP/CN/KR input)
              if (isComposingRef.current || e.nativeEvent.isComposing) return
              e.preventDefault()
              save()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setEditValue(value)
              hasFocusedRef.current = false
              setIsEditing(false)
            }
          }}
          onBlur={() => {
            if (isSavingRef.current) return
            save()
          }}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
          }}
          maxLength={maxLength}
          aria-label={ariaLabel}
          data-testid={testId ? `${testId}-input` : undefined}
          className={cn(
            'w-full rounded-sm border-0 bg-transparent px-0 outline-none',
            'ring-ring focus:ring-2 focus:ring-offset-1',
            inputClassName,
          )}
        />
      )
    }

    // Display mode: render clickable text element
    const displayText = value || placeholder
    const isEmpty = !value

    return (
      <Element
        role="button"
        tabIndex={0}
        onClick={() => setIsEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsEditing(true)
          }
        }}
        aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Click to edit'}
        data-testid={testId}
        className={cn(
          'cursor-pointer rounded-sm transition-colors',
          'hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
          isEmpty && 'text-muted-foreground italic',
          className,
        )}
      >
        {displayText}
      </Element>
    )
  },
)

InlineEditableText.displayName = 'InlineEditableText'
