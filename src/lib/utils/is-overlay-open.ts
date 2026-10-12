/**
 * Is Overlay Open
 *
 * Tells a shortcut of the page whether a layer lies on top of the page.
 */

/**
 * Roles of the layers that open on top of a page: a dialog (Radix Dialog and
 * Popover), a confirmation (AlertDialog), a menu (DropdownMenu) and a list of
 * options (Select, the repository picker). Radix renders each of them only
 * while it is open.
 */
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/**
 * Tells whether a dialog, a menu or a list of options is open right now.
 * Exists so a shortcut that acts on the page stays quiet while the user works
 * in a layer on top of it: a key typed there belongs to the layer, and the
 * page behind it must not change. Called by {@link useKanbanUndo} before Z
 * undoes a drag.
 *
 * The whole document is asked, not the element the key was typed on: the
 * focus can rest on the page itself while a dialog is open.
 *
 * @returns
 * - `true` while at least one such layer is in the document
 * - `false` when the page is all there is
 * @example
 * // The Move to Another Board dialog is open
 * isOverlayOpen() // => true
 */
export function isOverlayOpen(): boolean {
  return document.querySelector(OVERLAY_SELECTOR) !== null
}
