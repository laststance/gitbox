/**
 * i18n Configuration Tests
 *
 * T028.6: Unit test for i18n configuration and message loading
 * - ロケール設定の検証
 * - メッセージファイルの読み込み
 * - デフォルトロケールの確認
 */

import { describe, it, expect } from 'vitest'
import { locales, defaultLocale } from '@/lib/i18n/config'

describe('i18n Configuration (lib/i18n/config.ts)', () => {
  describe('Locale Settings', () => {
    it('should have locales defined', () => {
      expect(locales).toBeDefined()
      expect(Array.isArray(locales)).toBe(true)
    })

    it('should include en and ja locales', () => {
      expect(locales).toContain('en')
      expect(locales).toContain('ja')
    })

    it('should have exactly 2 locales', () => {
      expect(locales).toHaveLength(2)
    })

    it('should have defaultLocale defined', () => {
      expect(defaultLocale).toBeDefined()
      expect(typeof defaultLocale).toBe('string')
    })

    it('should have defaultLocale as ja', () => {
      expect(defaultLocale).toBe('ja')
    })

    it('should have defaultLocale in locales array', () => {
      expect(locales).toContain(defaultLocale)
    })
  })

  describe('Message Files', () => {
    it('should load English messages', async () => {
      const messages = await import('@/lib/i18n/messages/en.json')

      expect(messages.default).toBeDefined()
      expect(messages.default).toHaveProperty('common')
      expect(messages.default).toHaveProperty('Auth')
      expect(messages.default).toHaveProperty('Boards')
    })

    it('should load Japanese messages', async () => {
      const messages = await import('@/lib/i18n/messages/ja.json')

      expect(messages.default).toBeDefined()
      expect(messages.default).toHaveProperty('common')
      expect(messages.default).toHaveProperty('Auth')
      expect(messages.default).toHaveProperty('Boards')
    })

    it('should have matching keys between en and ja', async () => {
      const enMessages = await import('@/lib/i18n/messages/en.json')
      const jaMessages = await import('@/lib/i18n/messages/ja.json')

      const enKeys = Object.keys(enMessages.default)
      const jaKeys = Object.keys(jaMessages.default)

      expect(enKeys.sort()).toEqual(jaKeys.sort())
    })

    it('should have common namespace in both locales', async () => {
      const enMessages = await import('@/lib/i18n/messages/en.json')
      const jaMessages = await import('@/lib/i18n/messages/ja.json')

      expect(enMessages.default.common).toBeDefined()
      expect(jaMessages.default.common).toBeDefined()

      const enCommonKeys = Object.keys(enMessages.default.common)
      const jaCommonKeys = Object.keys(jaMessages.default.common)

      expect(enCommonKeys.sort()).toEqual(jaCommonKeys.sort())
    })

    it('should have Auth namespace in both locales', async () => {
      const enMessages = await import('@/lib/i18n/messages/en.json')
      const jaMessages = await import('@/lib/i18n/messages/ja.json')

      expect(enMessages.default.Auth).toBeDefined()
      expect(jaMessages.default.Auth).toBeDefined()

      const enAuthKeys = Object.keys(enMessages.default.Auth)
      const jaAuthKeys = Object.keys(jaMessages.default.Auth)

      expect(enAuthKeys.sort()).toEqual(jaAuthKeys.sort())
    })

    it('should have Boards namespace in both locales', async () => {
      const enMessages = await import('@/lib/i18n/messages/en.json')
      const jaMessages = await import('@/lib/i18n/messages/ja.json')

      expect(enMessages.default.Boards).toBeDefined()
      expect(jaMessages.default.Boards).toBeDefined()

      const enBoardsKeys = Object.keys(enMessages.default.Boards)
      const jaBoardsKeys = Object.keys(jaMessages.default.Boards)

      expect(enBoardsKeys.sort()).toEqual(jaBoardsKeys.sort())
    })
  })

  describe('Message Content', () => {
    it('should have loading message in English', async () => {
      const messages = await import('@/lib/i18n/messages/en.json')

      expect(messages.default.common.loading).toBe('Loading...')
    })

    it('should have loading message in Japanese', async () => {
      const messages = await import('@/lib/i18n/messages/ja.json')

      expect(messages.default.common.loading).toBe('読み込み中...')
    })

    it('should have signInWithGitHub message in English', async () => {
      const messages = await import('@/lib/i18n/messages/en.json')

      expect(messages.default.Auth.signInWithGitHub).toBe('Sign in with GitHub')
    })

    it('should have signInWithGitHub message in Japanese', async () => {
      const messages = await import('@/lib/i18n/messages/ja.json')

      expect(messages.default.Auth.signInWithGitHub).toBe('GitHub でサインイン')
    })

    it('should have all theme names in both locales', async () => {
      const enMessages = await import('@/lib/i18n/messages/en.json')
      const jaMessages = await import('@/lib/i18n/messages/ja.json')

      const expectedThemes = [
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

      expectedThemes.forEach(theme => {
        expect(enMessages.default.theme[theme]).toBeDefined()
        expect(jaMessages.default.theme[theme]).toBeDefined()
      })
    })
  })

  describe('Type Safety', () => {
    it('should export Locale type', () => {
      type Locale = (typeof locales)[number]

      const testLocale: Locale = 'en'
      expect(['en', 'ja']).toContain(testLocale)
    })
  })
})
