/**
 * Toast Constants
 */

/**
 * How long a toast that carries an action stays, in milliseconds. Sonner
 * shows a toast for 4 seconds by default, which is too short to read it and
 * reach its button, by pointer or through Sonner's keyboard shortcut. Used by
 * the "Undo" toast of a deleted link ({@link useEditableUrl}) and the "Open
 * board" toast of a moved card ({@link MoveToAnotherBoardDialog}).
 */
export const TOAST_WITH_ACTION_DURATION_MS = 8_000

/**
 * How long a toast with a long text and no action stays, in milliseconds:
 * the list of keyboard shortcuts {@link CommandPalette} shows. The default 4
 * seconds are too short to read it.
 */
export const TOAST_WITH_LONG_TEXT_DURATION_MS = 8_000
