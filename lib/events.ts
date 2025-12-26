/**
 * Custom Event Names for cross-component communication
 *
 * This module provides a type-safe way to dispatch and listen for
 * custom events across React components without prop drilling.
 */

/**
 * Event name for opening the ShortcutsHelp modal.
 * Dispatched from Sidebar, listened by ShortcutsHelp component.
 */
export const OPEN_SHORTCUTS_HELP = 'gitbox:open-shortcuts-help' as const

/**
 * Dispatch event to open ShortcutsHelp modal.
 *
 * @example
 * // In Sidebar component
 * import { openShortcutsHelp } from '@/lib/events'
 *
 * <button onClick={openShortcutsHelp}>Shortcuts</button>
 */
export function openShortcutsHelp(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_HELP))
}
