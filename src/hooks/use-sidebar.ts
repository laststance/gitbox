/**
 * Sidebar Hook
 *
 * Custom hook providing sidebar collapse/expand functionality
 * Uses Redux for state management (persisted via Storage Middleware)
 */

'use client'

import { useCallback } from 'react'

import { useMounted } from '@/hooks/use-mounted'
import {
  selectSidebarCollapsed,
  setSidebarCollapsed as setSidebarCollapsedAction,
  toggleSidebarCollapsed as toggleSidebarCollapsedAction,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

/**
 * Sidebar management hook using Redux
 * @returns Sidebar state and controls
 * @example
 * const { isCollapsed, setCollapsed, toggle, mounted } = useSidebar()
 * // isCollapsed: boolean
 * // setCollapsed(true) - sets sidebar state
 * // toggle() - toggles sidebar state
 */
export function useSidebar() {
  const mounted = useMounted()

  const dispatch = useAppDispatch()
  const isCollapsed = useAppSelector(selectSidebarCollapsed)

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
    setCollapsed,
    toggle,
    mounted,
  }
}
