'use client'

import { memo } from 'react'

import { PlateEditor } from '@/components/editor/PlateEditor'
import { Label } from '@/components/ui/label'
import { NOTE_MAX_LENGTH } from '@/hooks/board/useNoteModalDraft'

interface NoteSectionProps {
  /** Current note content (JSON string in Slate format) */
  note: string
  /** Callback when note content changes */
  onNoteChange: (value: string) => void
  /** Current character count */
  charCount: number
  /** CSS class for character count display */
  charCountClass: string
  /** Draft metadata for timestamp display (null if no draft exists) */
  draft: { lastModified: number } | null
}

/**
 * Note editing section within NoteModal.
 *
 * Renders a PlateJS rich text editor with character count
 * display and draft timestamp indicator.
 *
 * @example
 * <NoteSection
 *   note={note}
 *   onNoteChange={handleNoteChange}
 *   charCount={150}
 *   charCountClass="text-sm text-right text-muted-foreground"
 *   draft={{ lastModified: Date.now() }}
 * />
 */
export const NoteSection = memo(function NoteSection({
  note,
  onNoteChange,
  charCount,
  charCountClass,
  draft,
}: NoteSectionProps) {
  return (
    <div className="space-y-2">
      <Label id="note-label">Note</Label>
      <PlateEditor
        initialValue={note}
        onChange={onNoteChange}
        placeholder="Type / for commands, or start writing..."
        minHeight="400px"
        maxHeight="400px"
        data-testid="note-editor"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <div>
          {draft && (
            <p className="text-muted-foreground text-xs">
              Draft saved {new Date(draft.lastModified).toLocaleTimeString()}
            </p>
          )}
        </div>
        <p
          id="note-char-count"
          data-testid="char-count"
          className={charCountClass}
        >
          {charCount.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}
        </p>
      </div>
    </div>
  )
})
