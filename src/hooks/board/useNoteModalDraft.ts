'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { type ProjectLink } from '@/components/ui/editable-url-item'
import {
  deleteDraftNote,
  selectDraftNote,
  updateDraftNote,
} from '@/lib/redux/slices/draftSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { CardIdentifier, RepoCardId } from '@/lib/types/brands'
import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'
import { isValidUrl } from '@/lib/validations'

/** Maximum character limit for notes */
export const NOTE_MAX_LENGTH = 20000
/** Warning threshold for character count display */
export const NOTE_WARNING_THRESHOLD = 18000

interface UseNoteModalDraftParams<TId extends CardIdentifier = RepoCardId> {
  /** Card ID for draft state management */
  cardId: TId
  /** Initial note value from Supabase */
  initialNote: string
  /** Initial links value from Supabase */
  initialLinks: ProjectLink[]
  /** Whether the modal is currently open */
  isOpen: boolean
  /** Callback to save note and links to Supabase */
  onSave: (note: string, links: ProjectLink[]) => Promise<void>
  /** Callback when modal is closed */
  onClose: () => void
  /** Card title for toast display */
  cardTitle: string
}

interface UseNoteModalDraftReturn {
  /** Current note content (JSON string) */
  note: string
  /** Current links array */
  links: ProjectLink[]
  /** Whether save is in progress */
  isSaving: boolean
  /** Current character count */
  charCount: number
  /** CSS class for character count text */
  charCountClass: string
  /** Whether there are unsaved changes */
  hasChanges: boolean
  /** Whether all link URLs are valid */
  isFormValid: boolean
  /** Redux draft state (for timestamp display) */
  draft: ReturnType<ReturnType<typeof selectDraftNote>>
  /** Handle note change from PlateEditor */
  handleNoteChange: (value: string) => void
  /** Update links array (used by LinkManager) */
  handleLinksChange: (newLinks: ProjectLink[]) => void
  /** Handle save button click */
  handleSave: () => Promise<void>
  /** Handle modal close without saving */
  handleClose: () => void
}

/**
 * Hook for managing NoteModal draft persistence with Redux.
 *
 * Owns note and links state, syncs drafts to Redux/localStorage,
 * and handles save/close with optimistic UI feedback.
 *
 * @param params - Hook configuration
 * @returns State and handlers for NoteModal
 *
 * @example
 * const draft = useNoteModalDraft({
 *   cardId: card.id, // RepoCardId from RepoCardForRedux
 *   initialNote: '',
 *   initialLinks: [],
 *   isOpen: true,
 *   onSave: async (note, links) => await saveProjectInfo(cardId, note, links),
 *   onClose: () => setIsOpen(false),
 *   cardTitle: 'laststance/gitbox',
 * })
 */
export function useNoteModalDraft<TId extends CardIdentifier = RepoCardId>({
  cardId,
  initialNote,
  initialLinks,
  isOpen,
  onSave,
  onClose,
  cardTitle,
}: UseNoteModalDraftParams<TId>): UseNoteModalDraftReturn {
  const dispatch = useAppDispatch()
  const draft = useAppSelector(selectDraftNote(cardId))

  // Use draft if exists, otherwise initial values
  const [note, setNote] = useState(draft?.content ?? initialNote)
  const [links, setLinks] = useState<ProjectLink[]>(
    draft?.links ?? initialLinks,
  )
  const [isSaving, setIsSaving] = useState(false)

  // Track initialization to prevent re-init on every draft update
  const didInitRef = useRef(false)

  // Sync state when modal opens (not on every draft update).
  // Note: setNote/setLinks are this hook's own state — not "passing data to parents".
  useEffect(() => {
    if (!isOpen) {
      didInitRef.current = false
      return
    }
    if (didInitRef.current) return
    didInitRef.current = true
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setNote(draft?.content ?? initialNote)
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setLinks(draft?.links ?? initialLinks)
  }, [isOpen, initialNote, initialLinks, draft?.content, draft?.links])

  /**
   * Calculate text length from the current note (JSON format).
   * Memoized to prevent recalculation on every render.
   */
  const charCount = useMemo(() => {
    try {
      const slateValue = parseSlateValue(note)
      return getSlateTextLength(slateValue)
    } catch {
      return 0
    }
  }, [note])

  /**
   * Handle note change from PlateEditor.
   * Saves to Redux draft state for persistence.
   *
   * @param value - JSON string (Slate format) from PlateEditor
   */
  const handleNoteChange = useCallback(
    (value: string) => {
      try {
        const slateValue = parseSlateValue(value)
        const textLength = getSlateTextLength(slateValue)

        if (textLength <= NOTE_MAX_LENGTH) {
          setNote(value)
          dispatch(updateDraftNote({ cardId, content: value, links }))
        }
      } catch {
        setNote(value)
        dispatch(updateDraftNote({ cardId, content: value, links }))
      }
    },
    [cardId, dispatch, links],
  )

  /**
   * Handle links change from LinkManager.
   * Updates links state and syncs to Redux draft.
   *
   * @param newLinks - Updated links array
   */
  const handleLinksChange = useCallback(
    (newLinks: ProjectLink[]) => {
      setLinks(newLinks)
      dispatch(updateDraftNote({ cardId, content: note, links: newLinks }))
    },
    [cardId, dispatch, note],
  )

  /**
   * Handle save button click.
   * Uses optimistic update for instant feedback.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true)

    const validLinks = links.filter((link) => link.url)

    onClose()
    toast.success('Project info saved', {
      description: `Note and links for ${cardTitle} have been saved.`,
    })

    try {
      await onSave(note, validLinks)
      dispatch(deleteDraftNote(cardId))
    } catch (error) {
      toast.error('Failed to save project info', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }, [note, links, onSave, onClose, cardId, cardTitle, dispatch])

  /**
   * Handle modal close without saving.
   * Draft is preserved in Redux for later.
   */
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const isNearLimit = charCount >= NOTE_WARNING_THRESHOLD
  const charCountClass = isNearLimit
    ? 'text-sm text-right text-orange-500'
    : 'text-sm text-right text-muted-foreground'

  const isFormValid = links.every(
    (link) => !link.url || isValidUrl(link.url).valid,
  )

  const hasChanges =
    note !== initialNote ||
    JSON.stringify(links) !== JSON.stringify(initialLinks)

  return {
    note,
    links,
    isSaving,
    charCount,
    charCountClass,
    hasChanges,
    isFormValid,
    draft,
    handleNoteChange,
    handleLinksChange,
    handleSave,
    handleClose,
  }
}
