/**
 * Storage Hydration Hook
 *
 * Subscribes to the redux-storage-middleware hydration status so React
 * components can defer DOM effects until persisted state has been loaded
 * from localStorage. Without this, effects like `useTheme` would briefly
 * apply the initial Redux state (e.g. `theme: 'system'`) before
 * `ACTION_HYDRATE_COMPLETE` swaps in the user's saved value — causing a
 * visible flash on first render.
 *
 * Uses `useSyncExternalStore` so the value is correct on both SSR (always
 * `false`) and client (initial `false`, flips to `true` post-rehydrate).
 */

import { useSyncExternalStore } from 'react'

import { storageApi } from '@/lib/redux/store'

/**
 * Subscribes the React component to storage hydration completion.
 * Used by `useSyncExternalStore` — fires `onChange` exactly once when
 * hydration finishes. Returns a cleanup that removes the subscription.
 */
const subscribeToHydration = (onChange: () => void): (() => void) => {
  return storageApi.onFinishHydration(() => {
    onChange()
  })
}

const getClientSnapshot = (): boolean => storageApi.hasHydrated()

const getServerSnapshot = (): boolean => false

/**
 * Returns `true` once redux-storage-middleware has finished restoring
 * persisted slices from localStorage.
 *
 * @returns Hydration status — `false` during SSR and pre-hydrate client
 *   renders, `true` after `ACTION_HYDRATE_COMPLETE` fires.
 * @example
 * const hasHydrated = useStorageHydrated()
 * useEffect(() => {
 *   if (!hasHydrated) return
 *   // Safe to read persisted Redux state and apply to DOM
 * }, [hasHydrated, themeFromRedux])
 */
export function useStorageHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  )
}
