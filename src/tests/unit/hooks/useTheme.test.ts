/**
 * Unit Tests: useTheme Hook
 *
 * Tests for theme management hook including:
 * - Theme state management via Redux
 * - Theme application to DOM
 * - Light/dark theme detection
 * - System preference handling
 */

import { configureStore } from '@reduxjs/toolkit'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useTheme } from '@/hooks/use-theme'
import type { ThemeType } from '@/lib/constants/themes'
import settingsSlice from '@/lib/redux/slices/settingsSlice'

/**
 * Create a test store with initial theme
 */
const createTestStore = (theme: ThemeType = 'default') => {
  return configureStore({
    reducer: {
      settings: settingsSlice,
    },
    preloadedState: {
      settings: {
        theme,
        typography: { baseSize: 16, scale: 1.25 },
        compactMode: false,
        showCardMetadata: true,
        organizationFilter: 'all',
        sidebarCollapsed: false,
      },
    },
  })
}

/**
 * Wrapper component for Redux Provider
 */
const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    // Type assertion needed for React 19 compatibility
    return React.createElement(
      Provider,
      { store } as React.ComponentProps<typeof Provider>,
      children,
    )
  }
}

// Store original matchMedia to restore later
let originalMatchMedia: typeof window.matchMedia | undefined

describe('useTheme', () => {
  beforeEach(() => {
    // Guard against non-browser environment
    if (typeof window === 'undefined') return

    // Store original and mock matchMedia for system theme detection
    originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    // Reset document element state
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    // Guard against non-browser environment
    if (typeof window === 'undefined') return

    // Restore original matchMedia
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia,
      })
    }

    // Restore document state
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should return default theme from Redux', () => {
      const store = createTestStore('default')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.theme).toBe('default')
    })

    it('should detect light theme correctly', () => {
      const store = createTestStore('sunrise')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.theme).toBe('sunrise')
      expect(result.current.isDark).toBe(false)
    })

    it('should detect dark theme correctly', () => {
      const store = createTestStore('midnight')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.theme).toBe('midnight')
      expect(result.current.isDark).toBe(true)
    })
  })

  describe('setTheme()', () => {
    it('should update theme in Redux', () => {
      const store = createTestStore('default')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      act(() => {
        result.current.setTheme('midnight')
      })

      expect(result.current.theme).toBe('midnight')
      expect(store.getState().settings.theme).toBe('midnight')
    })

    it('should update isDark when switching to dark theme', () => {
      const store = createTestStore('default')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isDark).toBe(false)

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.isDark).toBe(true)
    })

    it('should update isDark when switching to light theme', () => {
      const store = createTestStore('midnight')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isDark).toBe(true)

      act(() => {
        result.current.setTheme('sunrise')
      })

      expect(result.current.isDark).toBe(false)
    })
  })

  describe('DOM Application', () => {
    it('should apply data-theme attribute for non-system themes', async () => {
      const store = createTestStore('mint')
      renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      // Wait for useEffect to run
      await vi.waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('mint')
      })
    })

    it('should add dark class for dark themes', async () => {
      const store = createTestStore('midnight')
      renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      await vi.waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.getAttribute('data-theme')).toBe(
          'midnight',
        )
      })
    })

    it('should remove dark class for light themes', async () => {
      // Start with dark class
      document.documentElement.classList.add('dark')

      const store = createTestStore('sunrise')
      renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      await vi.waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false)
      })
    })

    it('should handle system theme with dark preference', async () => {
      // Mock system dark preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes('dark'),
          media: query,
        })),
      })

      const store = createTestStore('system')
      renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      await vi.waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        // System theme should not set data-theme attribute
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
      })
    })

    it('should handle system theme with light preference', async () => {
      // Mock system light preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
        })),
      })

      const store = createTestStore('system')
      renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      await vi.waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false)
      })
    })
  })

  describe('Theme Categories', () => {
    const lightThemes: ThemeType[] = [
      'default',
      'sunrise',
      'sandstone',
      'mint',
      'sky',
      'lavender',
      'rose',
    ]
    const darkThemes: ThemeType[] = [
      'dark',
      'midnight',
      'graphite',
      'forest',
      'ocean',
      'plum',
      'rust',
    ]

    it.each(lightThemes)('should detect %s as light theme', (themeName) => {
      const store = createTestStore(themeName)
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isDark).toBe(false)
    })

    it.each(darkThemes)('should detect %s as dark theme', (themeName) => {
      const store = createTestStore(themeName)
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isDark).toBe(true)
    })
  })

  describe('mounted State', () => {
    it('should report mounted state correctly', () => {
      const store = createTestStore('default')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      // In browser environment, mounted should be true
      expect(result.current.mounted).toBe(true)
    })
  })

  describe('Memoization', () => {
    it('should maintain stable setTheme reference', () => {
      const store = createTestStore('default')
      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      const initialSetTheme = result.current.setTheme

      rerender()

      expect(result.current.setTheme).toBe(initialSetTheme)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid theme changes', async () => {
      const store = createTestStore('default')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      // Rapid theme changes
      act(() => {
        result.current.setTheme('midnight')
      })
      act(() => {
        result.current.setTheme('sunrise')
      })
      act(() => {
        result.current.setTheme('forest')
      })

      expect(result.current.theme).toBe('forest')
      expect(result.current.isDark).toBe(true)

      await vi.waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe(
          'forest',
        )
      })
    })

    it('should clean up previous theme when switching', async () => {
      const store = createTestStore('midnight')
      const { result } = renderHook(() => useTheme(), {
        wrapper: createWrapper(store),
      })

      await vi.waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.getAttribute('data-theme')).toBe(
          'midnight',
        )
      })

      act(() => {
        result.current.setTheme('sunrise')
      })

      await vi.waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false)
        expect(document.documentElement.getAttribute('data-theme')).toBe(
          'sunrise',
        )
      })
    })
  })
})
