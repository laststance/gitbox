'use client'

import { StickyNote } from 'lucide-react'
import { memo } from 'react'

import { LinkManager } from '@/components/Modals/LinkManager'
import { NoteSection } from '@/components/Modals/NoteSection'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type ProjectLink } from '@/components/ui/editable-url-item'
import { useNoteModalDraft } from '@/hooks/board/useNoteModalDraft'
import type { RepoCardId } from '@/lib/types/brands'

interface NoteModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback to save note and links to Supabase */
  onSave: (note: string, links: ProjectLink[]) => Promise<void>
  /** Card ID for draft state management */
  cardId: RepoCardId
  /** Initial note value from Supabase */
  initialNote: string
  /** Initial links value from Supabase */
  initialLinks: ProjectLink[]
  /** Card title for display */
  cardTitle: string
}

/**
 * Note Modal Component
 *
 * A unified modal for editing project notes and links with:
 * - Rich text editor with PlateJS (NoteSection)
 * - Links section with 55 built-in presets + user-defined custom presets (LinkManager)
 * - Redux draft state persistence (useNoteModalDraft hook)
 * - Optimistic UI feedback with Sonner toast notifications
 *
 * @example
 * <NoteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={async (note, links) => await saveProjectInfo(cardId, note, links)}
 *   cardId="abc-123"
 *   initialNote="Current note content"
 *   initialLinks={[{ type: 'vercel', url: 'https://...' }]}
 *   cardTitle="laststance/gitbox"
 * />
 */
export const NoteModal = memo(function NoteModal({
  isOpen,
  onClose,
  onSave,
  cardId,
  initialNote,
  initialLinks,
  cardTitle,
}: NoteModalProps) {
  const {
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
  } = useNoteModalDraft({
    cardId,
    initialNote,
    initialLinks,
    isOpen,
    onSave,
    onClose,
    cardTitle,
  })

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[90vh] max-w-7xl overflow-y-auto"
        data-testid="note-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Project Note
          </DialogTitle>
          <DialogDescription>
            Add notes and links for {cardTitle}. Your draft is automatically
            saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <NoteSection
            note={note}
            onNoteChange={handleNoteChange}
            charCount={charCount}
            charCountClass={charCountClass}
            draft={draft}
          />

          <LinkManager links={links} onLinksChange={handleLinksChange} />
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {hasChanges && !draft && (
              <p className="text-muted-foreground text-xs">
                You have unsaved changes
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !isFormValid}
              data-testid="save-button"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
