/**
 * EditableUrlItem Component
 *
 * Inline editable URL item with pen icon trigger, following Comment-style UX.
 *
 * Features:
 * - Display mode: Clickable URL link with tooltip
 * - Edit mode: Input field with save/delete buttons
 * - Pen icon triggers edit (URL click opens link in new tab)
 * - Single-edit coordination via forceExitEdit prop
 * - Delete with undo toast (8s duration)
 * - Save success animation
 * - Protocol whitelist (http/https only)
 * - WCAG 2.1 AA compliant (44px touch targets, aria-live)
 *
 * @see Spec: spec_project_info_url_list (Serena memory)
 */

'use client'

import debounce from 'lodash/debounce.js'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LinkTypeCombobox,
  type UserPresetOption,
} from '@/components/ui/link-type-combobox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { isValidUrl } from '@/lib/validations'

// ============================================
// Types
// ============================================

export interface ProjectLink {
  type: string
  url: string
}

export interface EditableUrlItemProps {
  /** The link data */
  link: ProjectLink
  /** Index for unique IDs and test selectors */
  index: number
  /** Callback when URL changes */
  onUrlChange: (url: string) => void
  /** Callback when type changes */
  onTypeChange: (type: string) => void
  /** Callback when delete is clicked */
  onDelete: () => void
  /** Callback for undo delete (enables undo toast) */
  onUndoDelete?: () => void
  /** User-defined presets for LinkTypeCombobox */
  userPresets: UserPresetOption[]
  /** Callback when "Add Custom" is clicked in combobox */
  onAddCustomClick: () => void
  /** Disable all interactions */
  disabled?: boolean
  /** Auto-enter edit mode (for newly added items) */
  autoEdit?: boolean
  /** Callback when edit mode starts (for single-edit coordination) */
  onEditStart?: () => void
  /** Force exit edit mode (when another item starts editing) */
  forceExitEdit?: boolean
}

// ============================================
// Component
// ============================================

export const EditableUrlItem = memo(function EditableUrlItem({
  link,
  index,
  onUrlChange,
  onTypeChange,
  onDelete,
  onUndoDelete,
  userPresets,
  onAddCustomClick,
  disabled = false,
  autoEdit = false,
  onEditStart,
  forceExitEdit = false,
}: EditableUrlItemProps) {
  // ----------------------------------------
  // State
  // ----------------------------------------
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [editValue, setEditValue] = useState(link.url)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  // Single announcement state for consolidated aria-live region
  const [announcement, setAnnouncement] = useState('')

  // ----------------------------------------
  // Refs for race condition prevention
  // ----------------------------------------
  const isCancellingRef = useRef(false)
  const isMountedRef = useRef(true)
  const isSavingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const penButtonRef = useRef<HTMLButtonElement>(null)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ----------------------------------------
  // Debounced validation
  // ----------------------------------------
  const debouncedValidate = useMemo(
    () =>
      debounce((value: string) => {
        if (!isMountedRef.current) return
        const result = isValidUrl(value)
        setError(result.error ?? null)
      }, 300),
    [],
  )

  // ----------------------------------------
  // Cleanup on unmount
  // ----------------------------------------
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      debouncedValidate.cancel()
      isCancellingRef.current = false
      isSavingRef.current = false
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [debouncedValidate])

  // ----------------------------------------
  // Imperative focus management (v3.2)
  // React 19+ pattern: useEffect for imperative focus is recommended
  // because autoFocus doesn't work on conditional renders
  // ----------------------------------------
  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- Imperative DOM focus requires effect
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // ----------------------------------------
  // Sync editValue when link.url changes externally
  // This is a controlled component pattern - sync internal state with props
  // ----------------------------------------
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates */
  useEffect(() => {
    if (!isEditing) {
      setEditValue(link.url)
    }
  }, [link.url, isEditing])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates */

  // ----------------------------------------
  // Announce mode changes for screen readers
  // This is intentional: sync aria-live announcement with state changes
  // ----------------------------------------
  useEffect(() => {
    /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates -- Accessibility announcement requires effect */
    if (isEditing) {
      setAnnouncement(`Editing ${link.type || 'URL'}`)
    }
    /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates */
  }, [isEditing, link.type])

  // ----------------------------------------
  // Focus restoration helper
  // ----------------------------------------
  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (isMountedRef.current && penButtonRef.current) {
        penButtonRef.current.focus()
      }
    })
  }, [])

  // ----------------------------------------
  // Save handler
  // ----------------------------------------
  const handleSave = useCallback(() => {
    if (error || isSaving || isSavingRef.current) return

    isSavingRef.current = true
    debouncedValidate.cancel()

    const trimmedValue = editValue.trim()

    // Final validation
    const result = isValidUrl(trimmedValue)
    if (!result.valid) {
      setError(result.error ?? 'Invalid URL')
      isSavingRef.current = false
      return
    }

    // Skip save if unchanged
    if (trimmedValue === link.url.trim()) {
      setIsEditing(false)
      restoreFocus()
      isSavingRef.current = false
      return
    }

    setIsSaving(true)
    setAnnouncement('Saving...')

    try {
      onUrlChange(trimmedValue)
      if (!isMountedRef.current) return

      setShowSaveSuccess(true)
      setAnnouncement('URL saved successfully')
      setIsEditing(false)
      restoreFocus()

      // Clean up previous timeout
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      successTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setShowSaveSuccess(false)
          setAnnouncement('')
        }
      }, 2000)
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
        isSavingRef.current = false
      }
    }
  }, [
    error,
    isSaving,
    editValue,
    link.url,
    onUrlChange,
    debouncedValidate,
    restoreFocus,
  ])

  // ----------------------------------------
  // Cancel handler
  // ----------------------------------------
  const handleCancel = useCallback(() => {
    debouncedValidate.cancel()
    setEditValue(link.url)
    setError(null)
    setIsEditing(false)
    setAnnouncement('Edit cancelled')
    restoreFocus()
  }, [link.url, debouncedValidate, restoreFocus])

  // ----------------------------------------
  // Force exit effect (for single-edit coordination)
  // This effect responds to prop changes for coordinating multiple editors
  // Uses try/finally pattern consistent with handleSave for ref cleanup
  // ----------------------------------------
  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- Prop-driven coordination requires effect
    if (!forceExitEdit || !isEditing) return

    const trimmedEdit = editValue.trim()
    const trimmedLink = link.url.trim()

    if (trimmedEdit !== trimmedLink && !error && !isSavingRef.current) {
      isSavingRef.current = true
      debouncedValidate.cancel()
      try {
        onUrlChange(trimmedEdit)
        if (!isMountedRef.current) return
        setIsEditing(false)
        setAnnouncement('URL saved')
      } finally {
        if (isMountedRef.current) {
          isSavingRef.current = false
        }
      }
    } else {
      setEditValue(link.url)
      setError(null)
      setIsEditing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExitEdit]) // Intentionally minimal - snapshot values when forceExitEdit triggers

  // ----------------------------------------
  // Edit start handler
  // ----------------------------------------
  const handleEditStart = useCallback(() => {
    setEditValue(link.url)
    setError(null)
    setShowSaveSuccess(false)
    setIsEditing(true)
    onEditStart?.()
  }, [link.url, onEditStart])

  // ----------------------------------------
  // Keyboard handler
  // ----------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation()

      if (e.key === 'Enter') {
        // Check IME composition
        if (e.nativeEvent.isComposing) return
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel],
  )

  // ----------------------------------------
  // Blur handler with relatedTarget check
  // Prevents auto-save when focus moves to other controls within the same item
  // ----------------------------------------
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (isCancellingRef.current) {
        isCancellingRef.current = false
        return
      }
      const relatedTarget = e.relatedTarget as HTMLElement | null
      // Check if focus moved to save button
      if (relatedTarget?.closest('[data-role="url-save-button"]')) {
        return
      }
      // Check if focus moved to combobox or its popover
      // This prevents exit when user clicks combobox to change link type
      if (
        relatedTarget?.closest('[role="combobox"]') ||
        relatedTarget?.closest('[role="listbox"]') ||
        relatedTarget?.closest('[data-radix-popper-content-wrapper]')
      ) {
        return
      }
      // Check if focus moved to other buttons in the same item (delete button)
      const itemContainer = e.currentTarget.closest(
        '[data-testid^="url-"]',
      )?.parentElement
      if (relatedTarget && itemContainer?.contains(relatedTarget)) {
        return
      }
      handleSave()
    },
    [handleSave],
  )

  // ----------------------------------------
  // Save button pointer down (for blur race condition)
  // ----------------------------------------
  const handleSavePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    isCancellingRef.current = true
  }, [])

  // ----------------------------------------
  // Delete handler with undo toast
  // ----------------------------------------
  const handleDelete = useCallback(() => {
    onDelete()

    if (onUndoDelete) {
      toast(`Link deleted`, {
        description: link.type ? `${link.type} link removed` : 'Link removed',
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            onUndoDelete()
          },
        },
      })
    }
  }, [onDelete, onUndoDelete, link.type])

  // ----------------------------------------
  // Render
  // ----------------------------------------
  return (
    <div className="space-y-1">
      {/* Single consolidated live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {isEditing ? (
        // EDIT MODE
        <div className="flex items-center gap-2">
          <LinkTypeCombobox
            value={link.type}
            onValueChange={onTypeChange}
            userPresets={userPresets}
            onAddCustomClick={onAddCustomClick}
            disabled={disabled || isSaving}
          />

          <Label htmlFor={`url-input-${index}`} className="sr-only">
            {link.type || 'Link'} URL
          </Label>

          <Input
            ref={inputRef}
            id={`url-input-${index}`}
            type="url"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              debouncedValidate(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="https://example.com"
            className={cn('min-w-0 flex-1', error && 'border-destructive')}
            disabled={disabled || isSaving}
            data-testid={`url-input-${index}`}
            aria-invalid={!!error}
            aria-describedby={error ? `url-error-${index}` : undefined}
          />

          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={handleSave}
            onPointerDown={handleSavePointerDown}
            disabled={!!error || isSaving}
            data-testid={`url-save-${index}`}
            data-role="url-save-button"
            aria-label="Save URL"
            aria-busy={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled || isSaving}
            data-testid={`url-delete-${index}`}
            aria-label={`Delete ${link.type || 'link'}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        // DISPLAY MODE
        <div className="flex items-center gap-2">
          <LinkTypeCombobox
            value={link.type}
            onValueChange={onTypeChange}
            userPresets={userPresets}
            onAddCustomClick={onAddCustomClick}
            disabled={disabled}
          />

          {link.url ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'min-w-0 flex-1 truncate text-base text-primary hover:underline',
                      'max-w-[300px] sm:max-w-[400px] lg:max-w-none',
                      showSaveSuccess && 'animate-pulse text-success',
                    )}
                    data-testid={`url-link-${index}`}
                  >
                    {link.url}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-lg">
                  <p className="break-all text-xs">{link.url}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <p className="flex-1 text-sm italic text-muted-foreground">
              No URL set
            </p>
          )}

          <Button
            ref={penButtonRef}
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={handleEditStart}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled}
            data-testid={`url-edit-${index}`}
            aria-label={`Edit ${link.type || 'link'} URL`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled}
            data-testid={`url-delete-${index}`}
            aria-label={`Delete ${link.type || 'link'}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {error && (
        <p
          id={`url-error-${index}`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
})

EditableUrlItem.displayName = 'EditableUrlItem'
