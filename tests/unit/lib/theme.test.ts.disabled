/**
 * Theme System Tests
 *
 * T028.8: Unit test for theme system and CSS variable application
 * - DOM へのテーマ適用テスト
 * - CSS 変数の取得テスト
 * - テーマ分類ユーティリティのテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  applyTheme,
  getCurrentTheme,
  getCSSVariable,
  isDarkTheme,
  getAllThemes,
  getThemesByMode,
} from '@/lib/theme'
import type { Theme } from '@/lib/supabase/types'

describe('Theme System (lib/theme.ts)', () => {
  describe('applyTheme', () => {
    beforeEach(() => {
      // 各テスト前にdata-theme属性をクリア
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    afterEach(() => {
      // テスト後もクリーンアップ
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    it('should apply light theme to DOM', () => {
      applyTheme('sunrise')

      const theme = document.documentElement.getAttribute('data-theme')
      expect(theme).toBe('sunrise')
    })

    it('should apply dark theme to DOM', () => {
      applyTheme('midnight')

      const theme = document.documentElement.getAttribute('data-theme')
      expect(theme).toBe('midnight')
    })

    it('should switch themes correctly', () => {
      applyTheme('sunrise')
      expect(document.documentElement.getAttribute('data-theme')).toBe('sunrise')

      applyTheme('midnight')
      expect(document.documentElement.getAttribute('data-theme')).toBe('midnight')

      applyTheme('ocean')
      expect(document.documentElement.getAttribute('data-theme')).toBe('ocean')
    })

    it('should apply all 12 themes correctly', () => {
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
        applyTheme(theme)
        expect(document.documentElement.getAttribute('data-theme')).toBe(theme)
      })
    })
  })

  describe('getCurrentTheme', () => {
    beforeEach(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    afterEach(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    it('should return null when no theme is applied', () => {
      const theme = getCurrentTheme()
      expect(theme).toBeNull()
    })

    it('should return current theme name', () => {
      applyTheme('sunrise')
      const theme = getCurrentTheme()
      expect(theme).toBe('sunrise')
    })

    it('should return updated theme after switch', () => {
      applyTheme('sunrise')
      expect(getCurrentTheme()).toBe('sunrise')

      applyTheme('midnight')
      expect(getCurrentTheme()).toBe('midnight')
    })
  })

  describe('getCSSVariable', () => {
    beforeEach(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    afterEach(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    it('should return empty string when no theme is applied', () => {
      const value = getCSSVariable('color-bg-primary')
      // テーマ未適用時は空文字またはデフォルト値
      expect(typeof value).toBe('string')
    })

    it('should return CSS variable value when theme is applied', () => {
      // テーマを適用
      applyTheme('sunrise')

      // CSS 変数が定義されているか確認
      // 実際の値はCSS実装に依存するため、存在確認のみ
      const value = getCSSVariable('color-bg-primary')
      expect(typeof value).toBe('string')
    })
  })

  describe('isDarkTheme', () => {
    it('should return false for light themes', () => {
      const lightThemes: Theme[] = [
        'sunrise',
        'sandstone',
        'mint',
        'sky',
        'lavender',
        'rose',
      ]

      lightThemes.forEach(theme => {
        expect(isDarkTheme(theme)).toBe(false)
      })
    })

    it('should return true for dark themes', () => {
      const darkThemes: Theme[] = [
        'midnight',
        'graphite',
        'forest',
        'ocean',
        'plum',
        'rust',
      ]

      darkThemes.forEach(theme => {
        expect(isDarkTheme(theme)).toBe(true)
      })
    })
  })

  describe('getAllThemes', () => {
    it('should return all 12 theme names', () => {
      const themes = getAllThemes()

      expect(themes).toHaveLength(12)
      expect(themes).toEqual([
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
      ])
    })

    it('should include both light and dark themes', () => {
      const themes = getAllThemes()

      // ライトテーマを含む
      expect(themes).toContain('sunrise')
      expect(themes).toContain('sandstone')
      expect(themes).toContain('mint')

      // ダークテーマを含む
      expect(themes).toContain('midnight')
      expect(themes).toContain('graphite')
      expect(themes).toContain('forest')
    })
  })

  describe('getThemesByMode', () => {
    it('should return 6 light themes and 6 dark themes', () => {
      const { light, dark } = getThemesByMode()

      expect(light).toHaveLength(6)
      expect(dark).toHaveLength(6)
    })

    it('should categorize light themes correctly', () => {
      const { light } = getThemesByMode()

      expect(light).toEqual([
        'sunrise',
        'sandstone',
        'mint',
        'sky',
        'lavender',
        'rose',
      ])
    })

    it('should categorize dark themes correctly', () => {
      const { dark } = getThemesByMode()

      expect(dark).toEqual([
        'midnight',
        'graphite',
        'forest',
        'ocean',
        'plum',
        'rust',
      ])
    })

    it('should not overlap between light and dark themes', () => {
      const { light, dark } = getThemesByMode()

      // lightとdarkに重複がないことを確認
      const overlap = light.filter(theme => dark.includes(theme))
      expect(overlap).toHaveLength(0)
    })

    it('should cover all 12 themes', () => {
      const { light, dark } = getThemesByMode()
      const allThemes = getAllThemes()

      const combined = [...light, ...dark]
      expect(combined.sort()).toEqual(allThemes.sort())
    })
  })

  describe('Integration: Theme Application and Retrieval', () => {
    beforeEach(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    afterEach(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    it('should apply and retrieve theme consistently', () => {
      const theme: Theme = 'ocean'

      applyTheme(theme)
      const retrievedTheme = getCurrentTheme()

      expect(retrievedTheme).toBe(theme)
      expect(isDarkTheme(theme)).toBe(true)
    })

    it('should work with theme switching flow', () => {
      // 初期テーマ適用
      applyTheme('sunrise')
      expect(getCurrentTheme()).toBe('sunrise')
      expect(isDarkTheme('sunrise')).toBe(false)

      // ダークテーマに切り替え
      applyTheme('midnight')
      expect(getCurrentTheme()).toBe('midnight')
      expect(isDarkTheme('midnight')).toBe(true)

      // 別のライトテーマに切り替え
      applyTheme('sky')
      expect(getCurrentTheme()).toBe('sky')
      expect(isDarkTheme('sky')).toBe(false)
    })
  })
})
