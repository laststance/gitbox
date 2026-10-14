/**
 * Sidebar Hook
 *
 * Custom hook providing sidebar collapse/expand functionality
 * Uses Redux for state management (persisted via Storage Middleware)
 * On a narrow viewport the sidebar is the icon rail whatever was chosen, and
 * its toggle opens it over the page for as long as it is needed
 */

'use client'

import { useCallback, useState } from 'react'

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
 * @returns Sidebar state and controls.
 * - `isCollapsed`: on a wide viewport, what the user chose (kept for the next
 *   visit). On a viewport narrower than 768px, where the open sidebar leaves
 *   no room for the page, `true` until the sidebar is opened over the page.
 * - `isOverPage`: the sidebar is open on a narrow viewport and lies over the
 *   page instead of beside it. Never stored: a phone starts with the rail.
 * - `toggle`: collapses or expands. On a narrow viewport it opens and closes
 *   the sidebar over the page and leaves the stored choice alone.
 * - `closeOverPage`: closes the sidebar that lies over the page; does nothing
 *   otherwise.
 * - `setCollapsed`: stores the choice for a wide viewport.
 * - `mounted`: false until the client has hydrated.
 * @example
 * const { isCollapsed, isOverPage, toggle, closeOverPage, mounted } = useSidebar()
 * // 1440px window, sidebar left open  => isCollapsed false, isOverPage false
 * // 375px phone                       => isCollapsed true,  isOverPage false
 * // 375px phone after toggle()        => isCollapsed false, isOverPage true
 */
export function useSidebar() {
  const mounted = useMounted()

  const dispatch = useAppDispatch()
  const isCollapsedByChoice = useAppSelector(selectSidebarCollapsed)
  const isNarrowViewport = useMediaQuery(NARROW_VIEWPORT_MEDIA_QUERY)
  const [isOpenedOnNarrowViewport, setIsOpenedOnNarrowViewport] =
    useState(false)

  // A window that crosses the breakpoint starts over: wide, it shows the
  // sidebar as the user left it, and narrow again it is the rail, not the
  // sheet that lay over the page before. Reset while rendering, so no frame
  // shows the old state.
  const [wasNarrowViewport, setWasNarrowViewport] = useState(isNarrowViewport)
  if (wasNarrowViewport !== isNarrowViewport) {
    setWasNarrowViewport(isNarrowViewport)
    setIsOpenedOnNarrowViewport(false)
  }

  const isOverPage = isNarrowViewport && isOpenedOnNarrowViewport
  // The choice is kept as it is: a wide window shows the sidebar as it was left
  const isCollapsed = isNarrowViewport
    ? !isOpenedOnNarrowViewport
    : isCollapsedByChoice

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      dispatch(setSidebarCollapsedAction(collapsed))
    },
    [dispatch],
  )

  const toggle = useCallback(() => {
    // On a phone the sidebar opens for one look: nothing is stored
    if (isNarrowViewport) {
      setIsOpenedOnNarrowViewport((isOpened) => !isOpened)
      return
    }
    dispatch(toggleSidebarCollapsedAction())
  }, [dispatch, isNarrowViewport])

  const closeOverPage = useCallback(() => {
    setIsOpenedOnNarrowViewport(false)
  }, [])

  return {
    isCollapsed,
    isOverPage,
    setCollapsed,
    toggle,
    closeOverPage,
    mounted,
  }
}
