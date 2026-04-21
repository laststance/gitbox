/**
 * useNoteModal Hook
 *
 * Manages NoteModal state including:
 * - Modal open/close state
 * - Note card ID and title
 * - Initial note content and links
 * - Save operation for note and links
 */

import { useState, useCallback } from 'react'

import {
  getProjectInfo,
  upsertProjectInfo,
  type ProjectLink,
} from '@/lib/actions/project-info'
import type { RepoCardForRedux } from '@/lib/models/domain'
import type { RepoCardId } from '@/lib/types/brands'

interface UseNoteModalParams {
  /** Repository cards from Redux store (for looking up card titles) */
  repoCards: RepoCardForRedux[]
}

interface UseNoteModalReturn {
  /** Whether the modal is open */
  isOpen: boolean
  /** Currently selected card ID */
  cardId: RepoCardId | null
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
  const [cardTitle, setCardTitle] = useState('')
  const [initialNote, setInitialNote] = useState('')
  const [initialLinks, setInitialLinks] = useState<ProjectLink[]>([])

  /**
   * Open NoteModal for a card
   * Fetches current note and links from Supabase
   */
  const open = useCallback(
    async (targetCardId: RepoCardId) => {
      const card = repoCards.find((c) => c.id === targetCardId)
      if (!card) return

      setCardId(targetCardId)
      setCardTitle(card.title)

      const result = await getProjectInfo(targetCardId)
      if (result.success && result.data) {
        setInitialNote(result.data.note || '')
        setInitialLinks(result.data.links || [])
      } else {
        setInitialNote('')
        setInitialLinks([])
      }

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
    setCardTitle('')
    setInitialNote('')
    setInitialLinks([])
  }, [])

  /**
   * Save note and links to Supabase
   * Called by NoteModal with optimistic update
   */
  const save = useCallback(
    async (note: string, links: ProjectLink[]) => {
      if (!cardId) return

      await upsertProjectInfo(cardId, {
        note,
        links,
      })
    },
    [cardId],
  )

  return {
    isOpen,
    cardId,
    cardTitle,
    initialNote,
    initialLinks,
    open,
    close,
    save,
  }
}
