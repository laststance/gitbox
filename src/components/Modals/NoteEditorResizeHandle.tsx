'use client'

import { memo, useRef } from 'react'

import {
  clampNoteEditorHeight,
  maxNoteEditorHeightPx,
  NOTE_EDITOR_HEIGHT_MIN_PX,
} from '@/lib/constants/note-editor'
import { setNoteEditorHeight } from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch } from '@/lib/redux/store'

/** Pixels the height moves per ArrowUp/ArrowDown on the handle. */
const KEYBOARD_STEP_PX = 16

interface NoteEditorResizeHandleProps {
  /** The editor's current height in px, already clamped to this window. */
  height: number
}

/**
 * Bottom-edge drag handle of the note editor in {@link NoteSection}.
 *
 * Exists because a fixed-height editor does not fit every note: short notes
 * want the room back, long notes want more of it. Dragging anywhere along
 * the strip — and ArrowUp/ArrowDown once it is focused — writes the new
 * height to the `settings` slice, so the storage middleware persists it.
 *
 * The strip sits on the editor box's bottom border, so the parent must be
 * `relative`. Pointer capture keeps the drag alive outside the strip.
 *
 * @param height - The height the editor renders at, in px.
 * @example
 * <div className="relative">
 *   <PlateEditor minHeight="400px" maxHeight="400px" />
 *   <NoteEditorResizeHandle height={400} />
 * </div>
 */
export const NoteEditorResizeHandle = memo(function NoteEditorResizeHandle({
  height,
}: NoteEditorResizeHandleProps) {
  const dispatch = useAppDispatch()
  // The gesture's origin: the new height is start + how far the pointer moved
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    // Primary button only: a right-click drag must not resize
    if (event.button !== 0) return
    // Stop the drag from selecting text; focus so the arrow keys work next
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startHeight: height }
  }

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    if (!drag.current) return
    dispatch(
      setNoteEditorHeight(
        clampNoteEditorHeight(
          drag.current.startHeight + (event.clientY - drag.current.startY),
          window.innerHeight,
        ),
      ),
    )
  }

  const endDrag = (): void => {
    drag.current = null
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    // Arrow keys on a separator must not scroll the dialog
    event.preventDefault()
    const delta =
      event.key === 'ArrowDown' ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX
    dispatch(
      setNoteEditorHeight(
        clampNoteEditorHeight(height + delta, window.innerHeight),
      ),
    )
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize note editor"
      aria-valuenow={height}
      aria-valuemin={NOTE_EDITOR_HEIGHT_MIN_PX}
      aria-valuemax={maxNoteEditorHeightPx(window.innerHeight)}
      tabIndex={0}
      className="group absolute inset-x-0 -bottom-1.5 z-10 flex h-3 cursor-row-resize touch-none items-center justify-center outline-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={handleKeyDown}
      data-testid="note-editor-resize-handle"
    >
      <div className="bg-border group-hover:bg-muted-foreground group-focus-visible:bg-primary h-1 w-10 rounded-full transition-colors" />
    </div>
  )
})
