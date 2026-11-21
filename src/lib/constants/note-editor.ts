/**
 * Sizing of the note editor inside NoteModal.
 *
 * The height itself lives in the `settings` slice (`noteEditorHeight`) so the
 * storage middleware persists it; these constants are the default and the
 * bounds the slice's selector and the bottom-edge resize handle share.
 */
export const NOTE_EDITOR_HEIGHT_DEFAULT_PX = 400
/** Smallest height the resize handle allows: below this the toolbar and a few lines stop fitting. */
export const NOTE_EDITOR_HEIGHT_MIN_PX = 160
/**
 * Largest share of the viewport height the editor may take while dragging.
 * Keeps the dialog's header, links and footer reachable on short windows.
 */
export const NOTE_EDITOR_HEIGHT_MAX_VH_RATIO = 0.7

/**
 * The largest editor height the resize handle accepts on a window of the
 * given height. Never below the minimum, so the ARIA range on the handle
 * stays valid on a tiny window.
 *
 * @param viewportPx - `window.innerHeight` of the current window.
 * @returns The height ceiling in px.
 * @example
 * maxNoteEditorHeightPx(1000) // => 700
 */
export function maxNoteEditorHeightPx(viewportPx: number): number {
  return Math.max(
    NOTE_EDITOR_HEIGHT_MIN_PX,
    Math.round(viewportPx * NOTE_EDITOR_HEIGHT_MAX_VH_RATIO),
  )
}

/**
 * Clamps a candidate editor height to the handle's range. Used for the
 * rendered height too, so a height dragged on a tall window still fits a
 * shorter one.
 *
 * @param px - The height to clamp, in px.
 * @param viewportPx - `window.innerHeight` of the current window.
 * @returns `px` bounded to [MIN, `70vh`].
 * @example
 * clampNoteEditorHeight(2000, 1000) // => 700
 */
export function clampNoteEditorHeight(px: number, viewportPx: number): number {
  return Math.round(
    Math.min(
      Math.max(px, NOTE_EDITOR_HEIGHT_MIN_PX),
      maxNoteEditorHeightPx(viewportPx),
    ),
  )
}
