import type { SyntheticEvent } from 'react'

import { startedOnOwnElement } from '@/lib/utils/started-on-own-element'

/**
 * What takes a press or a key of its own inside a draggable element: a
 * button, a link, a field, and an element that says so with `data-no-drag`.
 * The box of the comment editor says so: its counter and the space around its
 * field are neither a field nor a button.
 */
const NO_DRAG_SELECTOR =
  'button, a[href], input, select, textarea, [contenteditable]:not([contenteditable="false"]), [data-no-drag]'

/**
 * Tells whether a press or a key may pick up the element that listens for it.
 *
 * A card and a column header are dragged by a press or a key on themselves.
 * Both hold things that take presses and keys of their own: menus and dialogs,
 * which are drawn in a portal while React hands their events up to the element
 * that rendered them ({@link startedOnOwnElement}), and buttons inside the
 * element. Taken for the card's own, a mouse that slipped more than 8px on a
 * menu item or on a button, a finger that rested 200ms on it and Enter on the
 * button picked the card up, and the item or the button never answered. Called by the
 * activators of {@link OwnElementMouseSensor}, {@link OwnElementTouchSensor}
 * and {@link OwnElementKeyboardSensor}.
 *
 * A comment is not a control here although it opens its editor on a click: it
 * is a `div` with the role of a button and most of a card's surface, and a
 * card is picked up there as anywhere else. Its keys stay its own because it
 * prevents their default, which dnd-kit takes for "handled".
 *
 * @param event - The press or the key as React hands it to the element that has the drag listeners.
 * @returns
 * - `true`: it started on the listening element, on a plain part of it, or on a handle that is a button itself
 * - `false`: it started in a menu or a dialog drawn elsewhere, or on a button, a link, a field or a `data-no-drag` element inside the element
 * @example
 * mayStartDrag(pressOnTheTitleOfTheCard) // => true
 * mayStartDrag(pressOnTheOpenNoteButtonOfTheCard) // => false
 * mayStartDrag(pressOnAMenuItemOfTheCard) // => false
 * mayStartDrag(pressOnTheCounterOfTheCommentEditor) // => false
 */
export function mayStartDrag(event: SyntheticEvent): boolean {
  if (!startedOnOwnElement(event)) return false
  const { target, currentTarget } = event
  const noDragElement =
    target instanceof Element ? target.closest(NO_DRAG_SELECTOR) : null
  // A button that has the drag listeners is the handle itself, and a control
  // around the listening element is not one of its own
  return (
    noDragElement === null ||
    noDragElement === currentTarget ||
    !currentTarget.contains(noDragElement)
  )
}
