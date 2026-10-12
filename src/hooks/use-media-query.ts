import { useCallback, useSyncExternalStore } from 'react'

/**
 * Server snapshot: a page being rendered has no viewport, so no query matches.
 * @returns false
 */
const getServerSnapshot = () => false

/**
 * Tells whether a CSS media query matches, and re-renders when that changes
 * (a resized window, a turned phone). Exists so a component can pick what it
 * renders by viewport where CSS alone cannot, because the two layouts are
 * different elements. Called by {@link useSidebar}.
 *
 * @param mediaQuery - A media query as CSS writes it, for example
 * {@link NARROW_VIEWPORT_MEDIA_QUERY}. Pass the same string on every render.
 * @returns
 * - `true` while the query matches
 * - `false` while it does not, and during SSR and hydration
 * @example
 * const isNarrowViewport = useMediaQuery('(max-width: 767.98px)')
 * // 375px wide phone => true, 1440px wide window => false
 */
export function useMediaQuery(mediaQuery: string): boolean {
  const subscribeToQuery = useCallback(
    (onMatchChange: () => void) => {
      const mediaQueryList = window.matchMedia(mediaQuery)
      mediaQueryList.addEventListener('change', onMatchChange)
      return (): void => {
        mediaQueryList.removeEventListener('change', onMatchChange)
      }
    },
    [mediaQuery],
  )

  const getClientSnapshot = useCallback(
    () => window.matchMedia(mediaQuery).matches,
    [mediaQuery],
  )

  return useSyncExternalStore(
    subscribeToQuery,
    getClientSnapshot,
    getServerSnapshot,
  )
}
