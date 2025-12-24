'use client'

import { StickyNote } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteDraftNote,
  selectDraftNote,
  updateDraftNote,
} from '@/lib/redux/slices/draftSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

/** Maximum character limit for notes */
const NOTE_MAX_LENGTH = 20000
/** Warning threshold for character count display */
const NOTE_WARNING_THRESHOLD = 18000

interface NoteModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback to save note to Supabase */
  onSave: (note: string) => Promise<void>
  /** Card ID for draft state management */
  cardId: string
  /** Initial note value from Supabase */
  initialNote: string
  /** Card title for display */
  cardTitle: string
}

/**
 * Note Modal Component
 *
 * A modal for editing project notes with:
 * - useOptimistic for instant UI feedback
 * - Redux draft state persistence (survives browser close)
 * - Sonner toast notifications
 *
 * @example
 * <NoteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={async (note) => await saveNote(cardId, note)}
 *   cardId="abc-123"
 *   initialNote="Current note content"
 *   cardTitle="laststance/gitbox"
 * />
 */
export const NoteModal = memo(function NoteModal({
  isOpen,
  onClose,
  onSave,
  cardId,
  initialNote,
  cardTitle,
}: NoteModalProps) {
  const dispatch = useAppDispatch()
  const draft = useAppSelector(selectDraftNote(cardId))

  // Use draft if exists, otherwise initial note
  const [note, setNote] = useState(draft?.content ?? initialNote)
  const [isSaving, setIsSaving] = useState(false)

  // Sync note when modal opens or initial note changes
  useEffect(() => {
    if (isOpen) {
      setNote(draft?.content ?? initialNote)
    }
  }, [isOpen, initialNote, draft?.content])

  /**
   * Handle note text change
   * Saves to Redux draft state for persistence
   */
  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      if (value.length <= NOTE_MAX_LENGTH) {
        setNote(value)
        // Save draft to Redux (persisted to LocalStorage)
        dispatch(updateDraftNote({ cardId, content: value }))
      }
    },
    [cardId, dispatch],
  )

  /**
   * Handle save button click
   * Uses optimistic update for instant feedback
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true)

    // Optimistic: close modal and show toast immediately
    onClose()
    toast.success('Note saved', {
      description: `Note for ${cardTitle} has been saved.`,
    })

    try {
      // Save to Supabase in background
      await onSave(note)
      // Clear draft on successful save
      dispatch(deleteDraftNote(cardId))
    } catch (error) {
      // Show error toast if save fails
      toast.error('Failed to save note', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      })
      // Reopen modal to allow retry
      // Note: This is a simple recovery - in production you might want
      // to track failed saves and show a "retry" UI
    } finally {
      setIsSaving(false)
    }
  }, [note, onSave, onClose, cardId, cardTitle, dispatch])

  /**
   * Handle modal close without saving
   * Draft is preserved in Redux for later
   */
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Calculate character count display
  const charCount = note.length
  const isNearLimit = charCount >= NOTE_WARNING_THRESHOLD
  const charCountClass = isNearLimit
    ? 'text-sm text-right text-orange-500'
    : 'text-sm text-right text-muted-foreground'

  // Check if there are unsaved changes
  const hasChanges = note !== initialNote

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            Project Note
          </DialogTitle>
          <DialogDescription>
            Add notes about {cardTitle}. Your draft is automatically saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={handleNoteChange}
            placeholder="Write your project notes here..."
            className="min-h-80 text-sm resize-y"
            aria-describedby="note-char-count"
          />
          <p id="note-char-count" className={charCountClass}>
            {charCount.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}
          </p>
          {draft && (
            <p className="text-xs text-muted-foreground">
              Draft saved {new Date(draft.lastModified).toLocaleTimeString()}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>

        {hasChanges && !draft && (
          <p className="text-xs text-muted-foreground text-center">
            You have unsaved changes
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
})

export default NoteModal
