'use client'

import { memo, useCallback, useState } from 'react'

import { PlateEditor } from '@/components/editor/PlateEditor'
import { NoteEditorResizeHandle } from '@/components/Modals/NoteEditorResizeHandle'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { NOTE_MAX_LENGTH } from '@/hooks/board/useNoteModalDraft'
import { useViewportHeight } from '@/hooks/use-viewport-height'
import { clampNoteEditorHeight } from '@/lib/constants/note-editor'
import {
  selectNoteEditorHeight,
  selectNoteEditorOpen,
  setNoteEditorOpen,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'

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
  /** Lowercase `owner/name`. The show/hide choice is remembered under it. */
  repoKey: RepoIdentifier
}

/**
 * Note editing section within NoteModal.
 *
 * The editor is shown when the note has content and hidden when it is
 * empty — until the switch next to the label is toggled, whose position is
 * remembered per repository in the `settings` slice. While the editor is
 * hidden but holds content, a small character count keeps the hidden text
 * discoverable. The editor's bottom edge drags to resize; the height is
 * remembered for every repository.
 *
 * @example
 * <NoteSection
 *   note={note}
 *   onNoteChange={handleNoteChange}
 *   charCount={150}
 *   charCountClass="text-sm text-right text-muted-foreground"
 *   draft={{ lastModified: Date.now() }}
 *   repoKey="laststance/gitbox"
 * />
 */
export const NoteSection = memo(function NoteSection({
  note,
  onNoteChange,
  charCount,
  charCountClass,
  draft,
  repoKey,
}: NoteSectionProps) {
  const dispatch = useAppDispatch()
  const rememberedOpen = useAppSelector((state) =>
    selectNoteEditorOpen(state, repoKey),
  )
  const storedHeight = useAppSelector(selectNoteEditorHeight)

  // Latched at mount so deleting all text mid-edit can't slam the editor
  // shut on the user who never touched the switch
  const [openedWithContent] = useState(() => charCount > 0)
  // The remembered position wins; before the first toggle the content decides
  const editorOpen = rememberedOpen ?? openedWithContent

  const viewportPx = useViewportHeight()
  // A height dragged on a taller window is clamped to this one at render,
  // though the stored value itself is left untouched
  const heightPx = clampNoteEditorHeight(storedHeight, viewportPx)

  const handleEditorOpenChange = useCallback(
    (open: boolean) => {
      dispatch(setNoteEditorOpen({ repoKey, open }))
    },
    [dispatch, repoKey],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="note-editor-toggle">Note</Label>
        <div className="flex items-center gap-2">
          {/* Hidden-but-written: keep the text's presence visible */}
          {!editorOpen && charCount > 0 && (
            <p
              data-testid="note-char-count-collapsed"
              className={charCountClass}
            >
              {charCount.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}
            </p>
          )}
          <Switch
            id="note-editor-toggle"
            checked={editorOpen}
            onCheckedChange={handleEditorOpenChange}
            data-testid="note-editor-toggle"
          />
        </div>
      </div>
      {editorOpen && (
        <>
          <div className="relative">
            <PlateEditor
              initialValue={note}
              onChange={onNoteChange}
              placeholder="Type / for commands, or start writing..."
              minHeight={`${heightPx}px`}
              maxHeight={`${heightPx}px`}
              data-testid="note-editor"
              autoFocus
            />
            <NoteEditorResizeHandle height={heightPx} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              {draft && (
                <p className="text-muted-foreground text-xs">
                  Draft saved{' '}
                  {new Date(draft.lastModified).toLocaleTimeString()}
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
        </>
      )}
    </div>
  )
})
