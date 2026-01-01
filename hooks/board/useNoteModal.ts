/**
 * useNoteModal Hook
 *
 * Manages NoteModal state including:
 * - Modal open/close state
 * - Note card ID and title
 * - Initial note content
 * - Save operation
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback } from 'react'

import { getProjectInfo, upsertProjectInfo } from '@/lib/actions/project-info'
import type { RepoCardForRedux } from '@/lib/models/domain'

interface UseNoteModalParams {
  /** Repository cards from Redux store (for looking up card titles) */
  repoCards: RepoCardForRedux[]
}

interface UseNoteModalReturn {
  /** Whether the modal is open */
  isOpen: boolean
  /** Currently selected card ID */
  cardId: string | null
  /** Card title for display */
  cardTitle: string
  /** Initial note content */
  initialNote: string
  /** Open modal for a specific card */
  open: (cardId: string) => Promise<void>
  /** Close modal and reset state */
  close: () => void
  /** Save note to database */
  save: (note: string) => Promise<void>
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
 *     cardTitle={noteModal.cardTitle}
 *   />
 * )}
 */
export function useNoteModal({
  repoCards,
}: UseNoteModalParams): UseNoteModalReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [cardId, setCardId] = useState<string | null>(null)
  const [cardTitle, setCardTitle] = useState('')
  const [initialNote, setInitialNote] = useState('')

  /**
   * Open NoteModal for a card
   * Fetches current note from Supabase
   */
  const open = useCallback(
    async (targetCardId: string) => {
      const card = repoCards.find((c) => c.id === targetCardId)
      if (!card) return

      setCardId(targetCardId)
      setCardTitle(card.title)

      try {
        const data = await getProjectInfo(targetCardId)
        setInitialNote(data?.note || '')
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'loadNote' } })
        setInitialNote('')
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
  }, [])

  /**
   * Save note to Supabase
   * Called by NoteModal with optimistic update
   */
  const save = useCallback(
    async (note: string) => {
      if (!cardId) return

      await upsertProjectInfo(cardId, {
        note: note,
        comment: '',
        links: [],
      })
    },
    [cardId],
  )

  return {
    isOpen,
    cardId,
    cardTitle,
    initialNote,
    open,
    close,
    save,
  }
}
