/**
 * Unit Tests: settingsSlice Redux Actions
 *
 * Tests for user settings state management including:
 * - setTheme action
 * - setTypography action
 * - setCompactMode action
 * - setShowCardMetadata action
 * - setOrganizationFilter action
 * - setSidebarCollapsed action
 * - toggleSidebarCollapsed action
 * - resetSettings action
 * - All selectors with hydration safety
 */

import { describe, it, expect } from 'vitest'

import type { ThemeType } from '@/lib/constants/themes'
import settingsSlice, {
  setTheme,
  setTypography,
  setCompactMode,
  setShowCardMetadata,
  setOrganizationFilter,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  resetSettings,
  selectTheme,
  selectTypography,
  selectCompactMode,
  selectShowCardMetadata,
  selectOrganizationFilter,
  selectSidebarCollapsed,
} from '@/lib/redux/slices/settingsSlice'

describe('settingsSlice', () => {
  // Type for settings slice state (matches the slice's internal state)
  interface SettingsState {
    theme: ThemeType
    typography: { baseSize: number; scale: number }
    compactMode: boolean
    showCardMetadata: boolean
    organizationFilter: string
    sidebarCollapsed: boolean
  }

  const initialState: SettingsState = {
    theme: 'system',
    typography: {
      baseSize: 16,
      scale: 1.25,
    },
    compactMode: false,
    showCardMetadata: true,
    organizationFilter: 'all',
    sidebarCollapsed: false,
  }

  describe('setTheme action', () => {
    it('should set theme to dark', () => {
      const action = setTheme('dark')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('dark')
    })

    it('should set theme to light', () => {
      const action = setTheme('default')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('default')
    })

    it('should set theme to a named theme', () => {
      const action = setTheme('midnight')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('midnight')
    })

    it('should set theme to sunrise', () => {
      const action = setTheme('sunrise')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('sunrise')
    })

    it('should not affect other settings when changing theme', () => {
      const modifiedState = {
        ...initialState,
        compactMode: true,
        sidebarCollapsed: true,
      }

      const action = setTheme('ocean')
      const nextState = settingsSlice(modifiedState, action)

      expect(nextState.theme).toBe('ocean')
      expect(nextState.compactMode).toBe(true)
      expect(nextState.sidebarCollapsed).toBe(true)
    })
  })

  describe('setTypography action', () => {
    it('should set typography settings', () => {
      const newTypography = { baseSize: 18, scale: 1.3 }
      const action = setTypography(newTypography)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.typography).toEqual(newTypography)
    })

    it('should handle minimum values', () => {
      const minTypography = { baseSize: 14, scale: 1.2 }
      const action = setTypography(minTypography)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.typography).toEqual(minTypography)
    })

    it('should handle maximum values', () => {
      const maxTypography = { baseSize: 18, scale: 1.4 }
      const action = setTypography(maxTypography)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.typography).toEqual(maxTypography)
    })
  })

  describe('setCompactMode action', () => {
    it('should enable compact mode', () => {
      const action = setCompactMode(true)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.compactMode).toBe(true)
    })

    it('should disable compact mode', () => {
      const enabledState = { ...initialState, compactMode: true }
      const action = setCompactMode(false)

      const nextState = settingsSlice(enabledState, action)

      expect(nextState.compactMode).toBe(false)
    })
  })

  describe('setShowCardMetadata action', () => {
    it('should hide card metadata', () => {
      const action = setShowCardMetadata(false)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.showCardMetadata).toBe(false)
    })

    it('should show card metadata', () => {
      const hiddenState = { ...initialState, showCardMetadata: false }
      const action = setShowCardMetadata(true)

      const nextState = settingsSlice(hiddenState, action)

      expect(nextState.showCardMetadata).toBe(true)
    })
  })

  describe('setOrganizationFilter action', () => {
    it('should set organization filter to specific org', () => {
      const action = setOrganizationFilter('laststance')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.organizationFilter).toBe('laststance')
    })

    it('should reset organization filter to all', () => {
      const filteredState = {
        ...initialState,
        organizationFilter: 'laststance',
      }
      const action = setOrganizationFilter('all')

      const nextState = settingsSlice(filteredState, action)

      expect(nextState.organizationFilter).toBe('all')
    })

    it('should handle personal username', () => {
      const action = setOrganizationFilter('ryotamurakami')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.organizationFilter).toBe('ryotamurakami')
    })
  })

  describe('setSidebarCollapsed action', () => {
    it('should collapse sidebar', () => {
      const action = setSidebarCollapsed(true)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.sidebarCollapsed).toBe(true)
    })

    it('should expand sidebar', () => {
      const collapsedState = { ...initialState, sidebarCollapsed: true }
      const action = setSidebarCollapsed(false)

      const nextState = settingsSlice(collapsedState, action)

      expect(nextState.sidebarCollapsed).toBe(false)
    })
  })

  describe('toggleSidebarCollapsed action', () => {
    it('should toggle sidebar from expanded to collapsed', () => {
      const action = toggleSidebarCollapsed()

      const nextState = settingsSlice(initialState, action)

      expect(nextState.sidebarCollapsed).toBe(true)
    })

    it('should toggle sidebar from collapsed to expanded', () => {
      const collapsedState = { ...initialState, sidebarCollapsed: true }
      const action = toggleSidebarCollapsed()

      const nextState = settingsSlice(collapsedState, action)

      expect(nextState.sidebarCollapsed).toBe(false)
    })

    it('should toggle multiple times correctly', () => {
      let state: SettingsState = initialState

      state = settingsSlice(state, toggleSidebarCollapsed())
      expect(state.sidebarCollapsed).toBe(true)

      state = settingsSlice(state, toggleSidebarCollapsed())
      expect(state.sidebarCollapsed).toBe(false)

      state = settingsSlice(state, toggleSidebarCollapsed())
      expect(state.sidebarCollapsed).toBe(true)
    })
  })

  describe('resetSettings action', () => {
    it('should reset all settings to initial values', () => {
      const modifiedState = {
        theme: 'midnight' as const,
        typography: { baseSize: 18, scale: 1.4 },
        compactMode: true,
        showCardMetadata: false,
        organizationFilter: 'laststance',
        sidebarCollapsed: true,
      }

      const action = resetSettings()

      const nextState = settingsSlice(modifiedState, action)

      expect(nextState).toEqual(initialState)
    })

    it('should be idempotent on initial state', () => {
      const action = resetSettings()

      const nextState = settingsSlice(initialState, action)

      expect(nextState).toEqual(initialState)
    })
  })

  describe('Selectors', () => {
    describe('selectTheme', () => {
      it('should return theme value', () => {
        const rootState = {
          settings: { ...initialState, theme: 'dark' as const },
        }

        const result = selectTheme(rootState)

        expect(result).toBe('dark')
      })

      it('should return system as default during hydration', () => {
        // Simulating state during hydration where settings might be undefined
        const rootState = { settings: undefined } as any

        const result = selectTheme(rootState)

        expect(result).toBe('system')
      })
    })

    describe('selectTypography', () => {
      it('should return typography settings', () => {
        const rootState = { settings: initialState }

        const result = selectTypography(rootState)

        expect(result).toEqual({ baseSize: 16, scale: 1.25 })
      })
    })

    describe('selectCompactMode', () => {
      it('should return compact mode setting', () => {
        const rootState = { settings: { ...initialState, compactMode: true } }

        const result = selectCompactMode(rootState)

        expect(result).toBe(true)
      })
    })

    describe('selectShowCardMetadata', () => {
      it('should return show card metadata setting', () => {
        const rootState = {
          settings: { ...initialState, showCardMetadata: false },
        }

        const result = selectShowCardMetadata(rootState)

        expect(result).toBe(false)
      })
    })

    describe('selectOrganizationFilter', () => {
      it('should return organization filter', () => {
        const rootState = {
          settings: { ...initialState, organizationFilter: 'laststance' },
        }

        const result = selectOrganizationFilter(rootState)

        expect(result).toBe('laststance')
      })

      it('should return all as default during hydration', () => {
        const rootState = { settings: undefined } as any

        const result = selectOrganizationFilter(rootState)

        expect(result).toBe('all')
      })
    })

    describe('selectSidebarCollapsed', () => {
      it('should return sidebar collapsed state', () => {
        const rootState = {
          settings: { ...initialState, sidebarCollapsed: true },
        }

        const result = selectSidebarCollapsed(rootState)

        expect(result).toBe(true)
      })

      it('should return false as default during hydration', () => {
        const rootState = { settings: undefined } as any

        const result = selectSidebarCollapsed(rootState)

        expect(result).toBe(false)
      })
    })
  })
})
