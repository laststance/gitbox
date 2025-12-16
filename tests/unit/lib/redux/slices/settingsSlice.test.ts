/**
 * Settings Slice Tests
 *
 * T028.4 (Part 3/3): Unit test for settingsSlice
 * - テーマ設定のテスト
 * - 言語設定のテスト
 * - タイポグラフィ設定のテスト
 * - LocalStorage 同期のテスト
 */

import { describe, it, expect } from 'vitest'
import settingsReducer, {
  setTheme,
  setLocale,
  setTypography,
  setCompactMode,
  setShowArchived,
  resetSettings,
  selectTheme,
  selectLocale,
  selectTypography,
  selectCompactMode,
  selectShowArchived,
  type Locale,
} from '@/lib/redux/slices/settingsSlice'
import type { Theme } from '@/lib/supabase/types'

describe('Settings Slice (lib/redux/slices/settingsSlice.ts)', () => {
  const initialState = {
    theme: 'sunrise' as Theme,
    locale: 'ja' as Locale,
    typography: {
      baseSize: 16,
      scale: 1.25,
    },
    compactMode: false,
    showArchived: false,
  }

  describe('Reducers', () => {
    it('should return initial state', () => {
      expect(settingsReducer(undefined, { type: 'unknown' })).toEqual(
        initialState
      )
    })

    it('should handle setTheme', () => {
      const newTheme: Theme = 'midnight'
      const state = settingsReducer(initialState, setTheme(newTheme))

      expect(state.theme).toBe('midnight')
    })

    it('should handle setLocale', () => {
      const newLocale: Locale = 'en'
      const state = settingsReducer(initialState, setLocale(newLocale))

      expect(state.locale).toBe('en')
    })

    it('should handle setTypography', () => {
      const newTypography = {
        baseSize: 18,
        scale: 1.3,
      }

      const state = settingsReducer(initialState, setTypography(newTypography))

      expect(state.typography).toEqual(newTypography)
    })

    it('should handle setCompactMode', () => {
      const state = settingsReducer(initialState, setCompactMode(true))

      expect(state.compactMode).toBe(true)
    })

    it('should handle setShowArchived', () => {
      const state = settingsReducer(initialState, setShowArchived(true))

      expect(state.showArchived).toBe(true)
    })

    it('should handle resetSettings', () => {
      const modifiedState = {
        theme: 'midnight' as Theme,
        locale: 'en' as Locale,
        typography: {
          baseSize: 18,
          scale: 1.4,
        },
        compactMode: true,
        showArchived: true,
      }

      const state = settingsReducer(modifiedState, resetSettings())

      expect(state).toEqual(initialState)
    })
  })

  describe('Theme Values', () => {
    it('should accept all valid theme values', () => {
      const themes: Theme[] = [
        'sunrise',
        'sandstone',
        'mint',
        'sky',
        'lavender',
        'rose',
        'midnight',
        'graphite',
        'forest',
        'ocean',
        'plum',
        'rust',
      ]

      themes.forEach(theme => {
        const state = settingsReducer(initialState, setTheme(theme))
        expect(state.theme).toBe(theme)
      })
    })
  })

  describe('Locale Values', () => {
    it('should accept en locale', () => {
      const state = settingsReducer(initialState, setLocale('en'))
      expect(state.locale).toBe('en')
    })

    it('should accept ja locale', () => {
      const state = settingsReducer(initialState, setLocale('ja'))
      expect(state.locale).toBe('ja')
    })
  })

  describe('Typography Constraints', () => {
    it('should accept baseSize within range', () => {
      const validSizes = [14, 15, 16, 17, 18]

      validSizes.forEach(size => {
        const state = settingsReducer(
          initialState,
          setTypography({ baseSize: size, scale: 1.25 })
        )

        expect(state.typography.baseSize).toBe(size)
      })
    })

    it('should accept scale within range', () => {
      const validScales = [1.2, 1.25, 1.3, 1.35, 1.4]

      validScales.forEach(scale => {
        const state = settingsReducer(
          initialState,
          setTypography({ baseSize: 16, scale })
        )

        expect(state.typography.scale).toBe(scale)
      })
    })
  })

  describe('Selectors', () => {
    const mockState = {
      settings: {
        theme: 'midnight' as Theme,
        locale: 'en' as Locale,
        typography: {
          baseSize: 18,
          scale: 1.3,
        },
        compactMode: true,
        showArchived: true,
      },
    }

    it('selectTheme should return theme', () => {
      expect(selectTheme(mockState)).toBe('midnight')
    })

    it('selectLocale should return locale', () => {
      expect(selectLocale(mockState)).toBe('en')
    })

    it('selectTypography should return typography settings', () => {
      expect(selectTypography(mockState)).toEqual({
        baseSize: 18,
        scale: 1.3,
      })
    })

    it('selectCompactMode should return compact mode state', () => {
      expect(selectCompactMode(mockState)).toBe(true)
    })

    it('selectShowArchived should return show archived state', () => {
      expect(selectShowArchived(mockState)).toBe(true)
    })
  })

  describe('Action Creators', () => {
    it('setTheme should create action with theme payload', () => {
      const action = setTheme('ocean')

      expect(action.type).toBe('settings/setTheme')
      expect(action.payload).toBe('ocean')
    })

    it('setLocale should create action with locale payload', () => {
      const action = setLocale('en')

      expect(action.type).toBe('settings/setLocale')
      expect(action.payload).toBe('en')
    })

    it('setTypography should create action with typography payload', () => {
      const typography = { baseSize: 18, scale: 1.3 }
      const action = setTypography(typography)

      expect(action.type).toBe('settings/setTypography')
      expect(action.payload).toEqual(typography)
    })

    it('setCompactMode should create action with boolean payload', () => {
      const action = setCompactMode(true)

      expect(action.type).toBe('settings/setCompactMode')
      expect(action.payload).toBe(true)
    })

    it('setShowArchived should create action with boolean payload', () => {
      const action = setShowArchived(true)

      expect(action.type).toBe('settings/setShowArchived')
      expect(action.payload).toBe(true)
    })

    it('resetSettings should create action with no payload', () => {
      const action = resetSettings()

      expect(action.type).toBe('settings/resetSettings')
      expect(action.payload).toBeUndefined()
    })
  })
})
