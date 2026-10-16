'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { type ProjectLink } from '@/components/ui/editable-url-item'
import { ActionUserError } from '@/lib/actions/types'
import { NEAR_LIMIT_COUNTER_TEXT_CLASS } from '@/lib/constants/character-counter'
import {
  deleteDraftNote,
  noteDraftKey,
  selectDraftNote,
  updateDraftNote,
} from '@/lib/redux/slices/draftSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { RepoCardId } from '@/lib/types/brands'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'
import { isValidUrl } from '@/lib/validations'

/** Maximum character limit for notes */
export const NOTE_MAX_LENGTH = 20000
/** Warning threshold for character count display */
export const NOTE_WARNING_THRESHOLD = 18000

interface UseNoteModalDraftParams {
  /** Card that is open. A draft from an older version is stored under this id. */
  cardId: RepoCardId
  /** The signed-in account. Drafts of two accounts stay apart in localStorage. */
  userId: string
  /**
   * Lowercase `owner/name`. The draft is kept here, so a new card of the same
   * repository finds the text after the old card is gone.
   */
  repoKey: RepoIdentifier
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
 * and handles save/close: the dialog closes at once and a toast reports the
 * server's answer.
 *
 * @param params - Hook configuration
 * @returns State and handlers for NoteModal
 *
 * @example
 * const draft = useNoteModalDraft({
 *   cardId: card.id, // RepoCardId from RepoCardForRedux
 *   userId: board.user_id,
 *   repoKey: 'laststance/gitbox',
 *   initialNote: '',
 *   initialLinks: [],
 *   isOpen: true,
 *   onSave: async (note, links) => await saveProjectInfo(cardId, note, links),
 *   onClose: () => setIsOpen(false),
 *   cardTitle: 'laststance/gitbox',
 * })
 */
export function useNoteModalDraft({
  cardId,
  userId,
  repoKey,
  initialNote,
  initialLinks,
  isOpen,
  onSave,
  onClose,
  cardTitle,
}: UseNoteModalDraftParams): UseNoteModalDraftReturn {
  const dispatch = useAppDispatch()
  const draftKey = noteDraftKey(userId, repoKey)
  const draft = useAppSelector(selectDraftNote(draftKey, cardId))

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
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- one-shot init on modal open is a valid effect, not a derived event handler */
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
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

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
          dispatch(
            updateDraftNote({
              repoKey: draftKey,
              legacyCardId: cardId,
              content: value,
              links,
            }),
          )
        }
      } catch {
        setNote(value)
        dispatch(
          updateDraftNote({
            repoKey: draftKey,
            legacyCardId: cardId,
            content: value,
            links,
          }),
        )
      }
    },
    [cardId, dispatch, draftKey, links],
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
      dispatch(
        updateDraftNote({
          repoKey: draftKey,
          legacyCardId: cardId,
          content: note,
          links: newLinks,
        }),
      )
    },
    [cardId, dispatch, draftKey, note],
  )

  /**
   * Handle save button click.
   *
   * The modal closes at once; "saved" is said only after the server answered.
   * A refused or failed save keeps the draft, so the typed text is still there
   * when the note is opened again.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true)

    const validLinks = links.filter((link) => link.url)
    // The version Save is sending. An edit that lands while the save is in
    // flight stores a newer lastModified, and that draft has to stay.
    const savedVersion = draft?.lastModified ?? null

    onClose()

    try {
      await onSave(note, validLinks)
      dispatch(
        deleteDraftNote({
          repoKey: draftKey,
          legacyCardId: cardId,
          savedVersion,
        }),
      )
      toast.success('Project info saved', {
        description: `Note and links for ${cardTitle} have been saved.`,
      })
    } catch (error) {
      toast.error('Failed to save project info', {
        description: keptDraftMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    note,
    links,
    onSave,
    onClose,
    cardId,
    cardTitle,
    dispatch,
    draft?.lastModified,
    draftKey,
  ])

  /**
   * Handle modal close without saving.
   * Draft is preserved in Redux for later.
   */
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const isNearLimit = charCount >= NOTE_WARNING_THRESHOLD
  const charCountClass = isNearLimit
    ? `text-sm text-right ${NEAR_LIMIT_COUNTER_TEXT_CLASS}`
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

/**
 * Says where the typed text went after a save the server did not confirm.
 *
 * A missing card cannot be opened again. The draft is under the repository,
 * so the toast says to add the repository and open its note. Any other
 * failure still says to open the note of the card that is on the board.
 * The client tells the two apart by {@link ActionUserError}'s code, never
 * by the message.
 *
 * @param error - What {@link useNoteModal}'s save threw.
 * @returns The toast description.
 * @example
 * keptDraftMessage(new ActionUserError('Card not found', 'CARD_NOT_FOUND'))
 * // => 'Your text is kept. Add the repository again and open its note to save it.'
 */
function keptDraftMessage(error: unknown): string {
  if (
    error instanceof ActionUserError &&
    error.errorCode === 'CARD_NOT_FOUND'
  ) {
    return 'Your text is kept. Add the repository again and open its note to save it.'
  }
  const message = error instanceof Error ? error.message : 'Please try again.'
  return `${endWithFullStop(message)} Your text is kept: open the note again to save it.`
}

/**
 * Closes a server message with a full stop when it has no final punctuation.
 *
 * Server messages such as "Failed to save project information" end without
 * one, and the toast puts a sentence of its own after them.
 *
 * @param message - A message from the server or a fallback sentence.
 * @returns The message, ending in `.`, `!` or `?`.
 * @example
 * endWithFullStop('Card not found') // => 'Card not found.'
 * endWithFullStop('Please try again.') // => 'Please try again.'
 */
function endWithFullStop(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`
}
