/**
 * Sidebar Hook
 *
 * Custom hook providing sidebar collapse/expand functionality
 * Uses Redux for state management (persisted via Storage Middleware)
 */

'use client'

import { useCallback, useSyncExternalStore } from 'react'

import {
  selectSidebarCollapsed,
  setSidebarCollapsed as setSidebarCollapsedAction,
  toggleSidebarCollapsed as toggleSidebarCollapsedAction,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

// Helper to detect if we're in a browser environment
const getSnapshot = () => true
const getServerSnapshot = () => false
const subscribe = () => () => {}

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
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

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
    mounted: isClient,
  }
}
