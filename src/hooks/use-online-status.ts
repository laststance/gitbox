import { useSyncExternalStore } from 'react'

/**
 * Subscribes to the browser going online or offline.
 * @param onConnectionChange - Called on every `online` and `offline` event.
 * @returns Cleanup function that removes both listeners.
 */
const subscribeToConnection = (onConnectionChange: () => void) => {
  window.addEventListener('online', onConnectionChange)
  window.addEventListener('offline', onConnectionChange)
  return (): void => {
    window.removeEventListener('online', onConnectionChange)
    window.removeEventListener('offline', onConnectionChange)
  }
}

/**
 * Client snapshot: what the browser reports right now.
 * @returns false only when the browser knows it has no network
 */
const getClientSnapshot = () => navigator.onLine

/**
 * Server snapshot: a page being rendered was requested over a network.
 * @returns true
 */
const getServerSnapshot = () => true

/**
 * Tells whether the browser has a network connection, and re-renders when
 * that changes. Exists so work that needs the server can wait while offline
 * and run by itself once the connection is back. Called by
 * {@link useBoardServerSync}.
 *
 * @returns
 * - `true` while the browser reports a connection (and during SSR)
 * - `false` while the browser reports it is offline
 * @example
 * const isOnline = useOnlineStatus()
 * if (!isOnline) return <p>Waiting for the connection</p>
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    getClientSnapshot,
    getServerSnapshot,
  )
}
