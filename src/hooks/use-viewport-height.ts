import { useSyncExternalStore } from 'react'

/**
 * Subscribes to window resize events.
 * @param onResize - Called on every viewport resize.
 * @returns Cleanup function that removes the listener.
 */
const subscribeToResize = (onResize: () => void) => {
  window.addEventListener('resize', onResize)
  return (): void => {
    window.removeEventListener('resize', onResize)
  }
}

/**
 * Client snapshot: the viewport's current height in px.
 * @returns `window.innerHeight`
 */
const getClientSnapshot = () => window.innerHeight

/**
 * Server snapshot: the note dialog never renders on the server, so a stable
 * placeholder satisfies `useSyncExternalStore`'s hydration contract.
 * @returns 0
 */
const getServerSnapshot = () => 0

/**
 * Tracks the viewport's height in px and re-renders when it changes. Exists
 * so UI derived from `window.innerHeight` — like the note editor's 70vh
 * height cap — stays correct after the window shrinks or grows instead of
 * keeping the value read at mount. Called by {@link NoteSection} and
 * {@link NoteEditorResizeHandle}.
 *
 * @returns `window.innerHeight`, live; `0` during SSR
 * @example
 * const viewportPx = useViewportHeight()
 * const heightPx = clampNoteEditorHeight(storedHeight, viewportPx)
 */
export function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeToResize,
    getClientSnapshot,
    getServerSnapshot,
  )
}
