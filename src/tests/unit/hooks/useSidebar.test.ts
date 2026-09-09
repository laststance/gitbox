/**
 * Unit Tests: useSidebar Hook
 *
 * Tests for sidebar collapse/expand functionality including:
 * - Collapse state management via Redux
 * - Toggle functionality
 * - setCollapsed callback (line 45 coverage)
 * - Mounted state detection
 */

import { configureStore } from '@reduxjs/toolkit'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

import { useSidebar } from '@/hooks/use-sidebar'
import type { ThemeType } from '@/lib/constants/themes'
import settingsSlice from '@/lib/redux/slices/settingsSlice'

/**
 * Create a test store with initial sidebar state
 */
const createTestStore = (sidebarCollapsed = false) => {
  return configureStore({
    reducer: {
      settings: settingsSlice,
    },
    preloadedState: {
      settings: {
        // Without the assertion 'default' widens to string and fails the reducer's
        // ThemeType. The lint rule disagrees with tsc on this one.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        theme: 'default' as ThemeType,
        typography: { baseSize: 16, scale: 1.25 },
        compactMode: false,
        showCardMetadata: true,
        organizationFilter: 'all',
        sidebarCollapsed,
      },
    },
  })
}

/**
 * Wrapper component for Redux Provider
 */
const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      Provider,
      { store } as React.ComponentProps<typeof Provider>,
      children,
    )
  }
}

describe('useSidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    test('should return isCollapsed false by default', () => {
      const store = createTestStore(false)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(false)
    })

    test('should return isCollapsed true when initialized collapsed', () => {
      const store = createTestStore(true)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(true)
    })

    test('should report mounted state correctly', () => {
      const store = createTestStore(false)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      // In browser environment, mounted should be true
      expect(result.current.mounted).toBe(true)
    })
  })

  describe('setCollapsed()', () => {
    test('should set sidebar to collapsed state', () => {
      const store = createTestStore(false)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(false)

      act(() => {
        result.current.setCollapsed(true)
      })

      expect(result.current.isCollapsed).toBe(true)
      expect(store.getState().settings.sidebarCollapsed).toBe(true)
    })

    test('should set sidebar to expanded state', () => {
      const store = createTestStore(true)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(true)

      act(() => {
        result.current.setCollapsed(false)
      })

      expect(result.current.isCollapsed).toBe(false)
      expect(store.getState().settings.sidebarCollapsed).toBe(false)
    })

    test('should handle setting same value (idempotent)', () => {
      const store = createTestStore(true)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      act(() => {
        result.current.setCollapsed(true)
      })

      expect(result.current.isCollapsed).toBe(true)
    })
  })

  describe('toggle()', () => {
    test('should toggle from expanded to collapsed', () => {
      const store = createTestStore(false)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(false)

      act(() => {
        result.current.toggle()
      })

      expect(result.current.isCollapsed).toBe(true)
    })

    test('should toggle from collapsed to expanded', () => {
      const store = createTestStore(true)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(true)

      act(() => {
        result.current.toggle()
      })

      expect(result.current.isCollapsed).toBe(false)
    })

    test('should handle multiple toggles', () => {
      const store = createTestStore(false)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      act(() => {
        result.current.toggle()
      })
      expect(result.current.isCollapsed).toBe(true)

      act(() => {
        result.current.toggle()
      })
      expect(result.current.isCollapsed).toBe(false)

      act(() => {
        result.current.toggle()
      })
      expect(result.current.isCollapsed).toBe(true)
    })
  })

  describe('Memoization', () => {
    test('should maintain stable setCollapsed reference', () => {
      const store = createTestStore(false)
      const { result, rerender } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      const initialSetCollapsed = result.current.setCollapsed

      rerender()

      expect(result.current.setCollapsed).toBe(initialSetCollapsed)
    })

    test('should maintain stable toggle reference', () => {
      const store = createTestStore(false)
      const { result, rerender } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      const initialToggle = result.current.toggle

      rerender()

      expect(result.current.toggle).toBe(initialToggle)
    })
  })

  describe('Integration with Redux Store', () => {
    test('should sync with external store changes', () => {
      const store = createTestStore(false)
      const { result } = renderHook(() => useSidebar(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isCollapsed).toBe(false)

      // Direct store dispatch (simulating external change)
      act(() => {
        store.dispatch({ type: 'settings/setSidebarCollapsed', payload: true })
      })

      expect(result.current.isCollapsed).toBe(true)
    })
  })
})
