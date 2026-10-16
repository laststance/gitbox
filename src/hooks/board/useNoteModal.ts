/**
 * useNoteModal Hook
 *
 * Manages NoteModal state including:
 * - Modal open/close state
 * - Note card ID and title
 * - Initial note content and links
 * - Save operation for note and links
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import {
  getProjectInfo,
  upsertProjectInfo,
  type ProjectLink,
} from '@/lib/actions/project-info'
import { ActionUserError } from '@/lib/actions/types'
import type { RepoCardForRedux } from '@/lib/models/domain'
import type { RepoCardId } from '@/lib/types/brands'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

interface UseNoteModalParams {
  /** Repository cards from Redux store (for looking up card titles) */
  repoCards: RepoCardForRedux[]
}

interface UseNoteModalReturn {
  /** Whether the modal is open */
  isOpen: boolean
  /** Currently selected card ID */
  cardId: RepoCardId | null
  /** Lowercase `owner/name` of the card that is open, for the note draft. */
  repoKey: RepoIdentifier | null
  /** Card title for display */
  cardTitle: string
  /** Initial note content */
  initialNote: string
  /** Initial links from database */
  initialLinks: ProjectLink[]
  /** Open modal for a specific card */
  open: (cardId: RepoCardId) => Promise<void>
  /** Close modal and reset state */
  close: () => void
  /** Save note and links to database */
  save: (note: string, links: ProjectLink[]) => Promise<void>
}

/**
 * Hook for managing NoteModal state.
 *
 * @param params - Hook parameters including repoCards for title lookup
 * @returns State and action handlers for note modal
 *
 * @example
 * const noteModal = useNoteModal({ repoCards })
 *
 * // Open modal
 * <button onClick={() => noteModal.open(cardId)}>Add Note</button>
 *
 * // Render modal
 * {noteModal.cardId && (
 *   <NoteModal
 *     isOpen={noteModal.isOpen}
 *     onClose={noteModal.close}
 *     onSave={noteModal.save}
 *     cardId={noteModal.cardId}
 *     initialNote={noteModal.initialNote}
 *     initialLinks={noteModal.initialLinks}
 *     cardTitle={noteModal.cardTitle}
 *   />
 * )}
 */
export function useNoteModal({
  repoCards,
}: UseNoteModalParams): UseNoteModalReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [cardId, setCardId] = useState<RepoCardId | null>(null)
  const [repoKey, setRepoKey] = useState<RepoIdentifier | null>(null)
  const [cardTitle, setCardTitle] = useState('')
  const [initialNote, setInitialNote] = useState('')
  const [initialLinks, setInitialLinks] = useState<ProjectLink[]>([])
  // The card open() was last asked for. An answer for an earlier card is
  // dropped, so a slow read cannot open that card over the one asked for later.
  const requestedCardId = useRef<RepoCardId | null>(null)

  /**
   * Open NoteModal for a card
   * Fetches current note and links from Supabase. A failed read, refused or
   * lost on the way, shows a toast and leaves the modal closed, holding no
   * card. An answer for a card opened earlier is dropped.
   */
  const open = useCallback(
    async (targetCardId: RepoCardId) => {
      const card = repoCards.find((c) => c.id === targetCardId)
      if (!card) return
      requestedCardId.current = targetCardId

      let result: Awaited<ReturnType<typeof getProjectInfo>>
      try {
        result = await getProjectInfo(targetCardId)
      } catch (error) {
        // A newer open owns the dialog. This answer is for the card before it.
        if (requestedCardId.current !== targetCardId) return
        // The request never got an answer (offline, a deploy in between):
        // the menu that called open() has nobody to tell, so tell the user
        Sentry.captureException(error, {
          extra: { context: 'useNoteModal.open', cardId: targetCardId },
        })
        toast.error('Failed to load project info', {
          description: 'Please try again.',
        })
        return
      }
      if (requestedCardId.current !== targetCardId) return
      // An empty editor over a note that could not be read would let a save
      // overwrite the note with nothing: say so and stay closed
      if (!result.success) {
        toast.error('Failed to load project info', {
          description: result.error,
        })
        return
      }

      setCardId(targetCardId)
      setRepoKey(toRepoIdentifier(card.repoOwner, card.repoName))
      setCardTitle(card.title)
      setInitialNote(result.data?.note || '')
      setInitialLinks(result.data?.links || [])
      setIsOpen(true)
    },
    [repoCards],
  )

  /**
   * Close NoteModal and reset state
   */
  const close = useCallback(() => {
    setIsOpen(false)
    setCardId(null)
    setRepoKey(null)
    setCardTitle('')
    setInitialNote('')
    setInitialLinks([])
  }, [])

  /**
   * Save note and links to Supabase
   * Called by NoteModal after it has closed; NoteModal reports the outcome.
   * @throws Error with the server's message when the save is refused
   */
  const save = useCallback(
    async (note: string, links: ProjectLink[]) => {
      if (!cardId) return

      const result = await upsertProjectInfo(cardId, {
        note,
        links,
      })
      // A refused save has to reach the caller as an error, or the draft is
      // deleted with the typed text in it
      if (!result.success) {
        throw new ActionUserError(result.error, result.errorCode)
      }
    },
    [cardId],
  )

  return {
    isOpen,
    cardId,
    repoKey,
    cardTitle,
    initialNote,
    initialLinks,
    open,
    close,
    save,
  }
}
