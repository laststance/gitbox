/**
 * Unit Tests: Theme Constants
 *
 * Tests for theme constants and helper functions
 */

import { describe, it, expect } from 'vitest'

import {
  LIGHT_THEME_IDS,
  DARK_THEME_IDS,
  ALL_THEME_IDS,
  THEME_METADATA,
  THEME_INFO,
  isDarkTheme,
  isValidThemeId,
  LIGHT_THEMES,
  DARK_THEMES,
  ALL_THEMES,
} from '@/lib/constants/themes'

describe('Theme Constants', () => {
  describe('Theme ID Arrays', () => {
    it('should have 7 light themes', () => {
      expect(LIGHT_THEME_IDS).toHaveLength(7)
      expect(LIGHT_THEME_IDS).toContain('default')
      expect(LIGHT_THEME_IDS).toContain('sunrise')
      expect(LIGHT_THEME_IDS).toContain('sandstone')
      expect(LIGHT_THEME_IDS).toContain('mint')
      expect(LIGHT_THEME_IDS).toContain('sky')
      expect(LIGHT_THEME_IDS).toContain('lavender')
      expect(LIGHT_THEME_IDS).toContain('rose')
    })

    it('should have 7 dark themes', () => {
      expect(DARK_THEME_IDS).toHaveLength(7)
      expect(DARK_THEME_IDS).toContain('dark')
      expect(DARK_THEME_IDS).toContain('midnight')
      expect(DARK_THEME_IDS).toContain('graphite')
      expect(DARK_THEME_IDS).toContain('forest')
      expect(DARK_THEME_IDS).toContain('ocean')
      expect(DARK_THEME_IDS).toContain('plum')
      expect(DARK_THEME_IDS).toContain('rust')
    })

    it('should have 14 total themes in ALL_THEME_IDS', () => {
      expect(ALL_THEME_IDS).toHaveLength(14)
    })
  })

  describe('THEME_METADATA', () => {
    it('should have metadata for all theme IDs', () => {
      for (const themeId of ALL_THEME_IDS) {
        expect(THEME_METADATA[themeId]).toBeDefined()
        expect(THEME_METADATA[themeId].name).toBeTruthy()
        expect(THEME_METADATA[themeId].color).toBeTruthy()
        expect(THEME_METADATA[themeId].description).toBeTruthy()
      }
    })

    it('should mark default theme as needing border', () => {
      expect(THEME_METADATA.default.needsBorder).toBe(true)
    })

    it('should have valid hex colors', () => {
      for (const themeId of ALL_THEME_IDS) {
        expect(THEME_METADATA[themeId].color).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })
  })

  describe('THEME_INFO', () => {
    it('should include all theme metadata plus system', () => {
      expect(Object.keys(THEME_INFO)).toHaveLength(15) // 14 themes + system
      expect(THEME_INFO.system).toBeDefined()
      expect(THEME_INFO.system.name).toBe('System')
    })
  })

  describe('isDarkTheme()', () => {
    it.each(DARK_THEME_IDS)(
      'should return true for dark theme: %s',
      (theme) => {
        expect(isDarkTheme(theme)).toBe(true)
      },
    )

    it.each(LIGHT_THEME_IDS)(
      'should return false for light theme: %s',
      (theme) => {
        expect(isDarkTheme(theme)).toBe(false)
      },
    )

    it('should return false for system theme', () => {
      expect(isDarkTheme('system')).toBe(false)
    })
  })

  describe('isValidThemeId()', () => {
    it.each([...ALL_THEME_IDS])(
      'should return true for valid theme: %s',
      (theme) => {
        expect(isValidThemeId(theme)).toBe(true)
      },
    )

    it('should return false for system (not a theme ID)', () => {
      expect(isValidThemeId('system')).toBe(false)
    })

    it('should return false for invalid theme strings', () => {
      expect(isValidThemeId('invalid')).toBe(false)
      expect(isValidThemeId('')).toBe(false)
      expect(isValidThemeId('DARK')).toBe(false) // case sensitive
    })
  })

  describe('Legacy Exports', () => {
    it('LIGHT_THEMES should match LIGHT_THEME_IDS', () => {
      expect(LIGHT_THEMES).toEqual([...LIGHT_THEME_IDS])
    })

    it('DARK_THEMES should match DARK_THEME_IDS', () => {
      expect(DARK_THEMES).toEqual([...DARK_THEME_IDS])
    })

    it('ALL_THEMES should include system', () => {
      expect(ALL_THEMES).toContain('system')
      expect(ALL_THEMES).toHaveLength(15)
    })
  })
})
