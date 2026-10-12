/**
 * Sidebar Hook
 *
 * Custom hook providing sidebar collapse/expand functionality
 * Uses Redux for state management (persisted via Storage Middleware)
 * On a narrow viewport the sidebar is collapsed whatever was chosen
 */

'use client'

import { useCallback } from 'react'

import { useMediaQuery } from '@/hooks/use-media-query'
import { useMounted } from '@/hooks/use-mounted'
import { NARROW_VIEWPORT_MEDIA_QUERY } from '@/lib/constants/breakpoints'
import {
  selectSidebarCollapsed,
  setSidebarCollapsed as setSidebarCollapsedAction,
  toggleSidebarCollapsed as toggleSidebarCollapsedAction,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

/**
 * Sidebar management hook using Redux
 * @returns Sidebar state and controls. `isCollapsed` is true when the user
 * collapsed the sidebar, and always on a viewport narrower than 768px, where
 * the open sidebar leaves no room for the page; `canExpand` is false there,
 * so no control offers what the screen cannot show.
 * @example
 * const { isCollapsed, canExpand, setCollapsed, toggle, mounted } = useSidebar()
 * // isCollapsed: boolean
 * // canExpand: false on a phone
 * // setCollapsed(true) - sets sidebar state
 * // toggle() - toggles sidebar state
 */
export function useSidebar() {
  const mounted = useMounted()

  const dispatch = useAppDispatch()
  const isCollapsedByChoice = useAppSelector(selectSidebarCollapsed)
  const isNarrowViewport = useMediaQuery(NARROW_VIEWPORT_MEDIA_QUERY)
  // The choice is kept as it is: a wide window shows the sidebar as it was left
  const isCollapsed = isNarrowViewport || isCollapsedByChoice

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      dispatch(setSidebarCollapsedAction(collapsed))
    },
    [dispatch],
  )

  const toggle = useCallback(() => {
    dispatch(toggleSidebarCollapsedAction())
  }, [dispatch])

  return {
    isCollapsed,
    canExpand: !isNarrowViewport,
    setCollapsed,
    toggle,
    mounted,
  }
}
