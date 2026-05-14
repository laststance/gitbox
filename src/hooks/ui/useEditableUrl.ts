'use client'

import debounce from 'lodash/debounce.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { type ProjectLink } from '@/components/ui/editable-url-item'
import { isValidUrl } from '@/lib/validations'

interface UseEditableUrlParams {
  /** The link data */
  link: ProjectLink
  /** Callback when URL changes */
  onUrlChange: (url: string) => void
  /** Callback when delete is clicked */
  onDelete: () => void
  /** Callback for undo delete (enables undo toast) */
  onUndoDelete?: () => void
  /** Auto-enter edit mode (for newly added items) */
  autoEdit?: boolean
  /** Callback when edit mode starts (for single-edit coordination) */
  onEditStart?: () => void
  /** Force exit edit mode (when another item starts editing) */
  forceExitEdit?: boolean
}

interface UseEditableUrlReturn {
  /** Whether currently in edit mode */
  isEditing: boolean
  /** Current edit value in the input */
  editValue: string
  /** Validation error message */
  error: string | null
  /** Whether save is in progress */
  isSaving: boolean
  /** Whether to show save success animation */
  showSaveSuccess: boolean
  /** Accessibility announcement text */
  announcement: string
  /** Ref for the URL input element */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Ref for the pen/edit button */
  penButtonRef: React.RefObject<HTMLButtonElement | null>
  /** Handle input value change */
  handleInputChange: (value: string) => void
  /** Handle save action */
  handleSave: () => void
  /** Handle cancel action */
  handleCancel: () => void
  /** Handle edit start (pen icon click) */
  handleEditStart: () => void
  /** Handle keyboard events on input */
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** Handle input blur */
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void
  /** Handle save button pointer down (blur race condition fix) */
  handleSavePointerDown: (e: React.PointerEvent) => void
  /** Handle delete action */
  handleDelete: () => void
}

/**
 * Hook for managing editable URL item state and behavior.
 *
 * Encapsulates all editing lifecycle: state management, validation,
 * focus coordination, accessibility announcements, and race condition prevention.
 *
 * @param params - Hook configuration matching EditableUrlItem's behavioral props
 * @returns State and handlers for rendering the editable URL item
 *
 * @example
 * const url = useEditableUrl({
 *   link: { type: 'vercel', url: 'https://example.com' },
 *   onUrlChange: (url) => updateLink(index, url),
 *   onDelete: () => removeLink(index),
 *   autoEdit: false,
 * })
 *
 * // Use url.isEditing to toggle between edit/display modes
 * // Use url.handleSave, url.handleCancel for actions
 */
export function useEditableUrl({
  link,
  onUrlChange,
  onDelete,
  onUndoDelete,
  autoEdit = false,
  onEditStart,
  forceExitEdit = false,
}: UseEditableUrlParams): UseEditableUrlReturn {
  // ----------------------------------------
  // State
  // ----------------------------------------
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- using props (autoEdit, link.url) as initial state is the standard React initialization pattern */
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [editValue, setEditValue] = useState(link.url)
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
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
  // Imperative focus management
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
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-derived-state */
  useEffect(() => {
    if (!isEditing) {
      setEditValue(link.url)
    }
  }, [link.url, isEditing])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-derived-state */

  // ----------------------------------------
  // Announce mode changes for screen readers
  // ----------------------------------------
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-derived-state -- Accessibility announcement requires effect */
  useEffect(() => {
    if (isEditing) {
      setAnnouncement(`Editing ${link.type || 'URL'}`)
    }
  }, [isEditing, link.type])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-derived-state */

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

    const result = isValidUrl(trimmedValue)
    if (!result.valid) {
      setError(result.error ?? 'Invalid URL')
      isSavingRef.current = false
      return
    }

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
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-pass-live-state-to-parent, react-you-might-not-need-an-effect/no-derived-state */
  useEffect(() => {
    if (!forceExitEdit || !isEditing) return

    const trimmedEdit = editValue.trim()
    const trimmedLink = link.url.trim()

    if (trimmedEdit !== trimmedLink && !isSavingRef.current) {
      // Validate synchronously — debounced error state may be stale
      const validation = isValidUrl(trimmedEdit)
      if (!validation.valid) {
        setEditValue(link.url)
        setError(null)
        setIsEditing(false)
        return
      }
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
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-pass-live-state-to-parent, react-you-might-not-need-an-effect/no-derived-state */

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
  // Blur handler
  // ----------------------------------------
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (isCancellingRef.current) {
        isCancellingRef.current = false
        return
      }
      const relatedTarget = e.relatedTarget as HTMLElement | null
      if (relatedTarget?.closest('[data-role="url-save-button"]')) {
        return
      }
      if (
        relatedTarget?.closest('[role="combobox"]') ||
        relatedTarget?.closest('[role="listbox"]') ||
        relatedTarget?.closest('[data-radix-popper-content-wrapper]')
      ) {
        return
      }
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
  // Input change handler
  // ----------------------------------------
  const handleInputChange = useCallback(
    (value: string) => {
      setEditValue(value)
      debouncedValidate(value)
    },
    [debouncedValidate],
  )

  return {
    isEditing,
    editValue,
    error,
    isSaving,
    showSaveSuccess,
    announcement,
    inputRef,
    penButtonRef,
    handleInputChange,
    handleSave,
    handleCancel,
    handleEditStart,
    handleKeyDown,
    handleBlur,
    handleSavePointerDown,
    handleDelete,
  }
}
