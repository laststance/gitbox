import type { SyntheticEvent } from 'react'

/**
 * Tells whether an event started on the element that listens for it, or inside it on the page.
 *
 * React hands an event up through the component that rendered its target,
 * and a menu or a dialog that is drawn in a portal elsewhere on the page is
 * still rendered by the element that holds it. A card and a column header
 * each hold such menus and answer clicks, keys or presses themselves, so
 * each has to tell the events of its menus from its own. Called by
 * {@link mayStartDrag}, which the drag sensors of the board ask.
 *
 * @param event - The event as React hands it to the listening element.
 * @returns
 * - `true`: the target is the listening element or lies inside it on the page
 * - `false`: the target lies elsewhere on the page (a menu or a dialog in a portal)
 * @example
 * startedOnOwnElement(clickOnTheTitleOfTheCard) // => true
 * startedOnOwnElement(clickOnAMenuItemOfTheCard) // => false
 */
export function startedOnOwnElement(event: SyntheticEvent): boolean {
  return (
    event.target instanceof Node && event.currentTarget.contains(event.target)
  )
}
