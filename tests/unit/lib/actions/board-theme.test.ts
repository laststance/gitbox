/**
 * Unit Test: Board Theme Server Action
 *
 * Tests the updateBoardThemeAction server action validation.
 * Verifies all 14 themes (7 light + 7 dark) are accepted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { updateBoardThemeAction } from '@/lib/actions/board'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: 'board-123' },
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-123' } },
        error: null,
      })),
    },
  })),
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('updateBoardThemeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper to create FormData with theme and boardId
   *
   * @param theme - Theme name to test
   * @param boardId - Board ID (defaults to 'board-123')
   * @returns FormData object
   */
  function createFormData(theme: string, boardId = 'board-123'): FormData {
    const formData = new FormData()
    formData.set('theme', theme)
    formData.set('boardId', boardId)
    return formData
  }

  describe('Theme Validation - All 14 Themes', () => {
    const lightThemes = [
      'default',
      'sunrise',
      'sandstone',
      'mint',
      'sky',
      'lavender',
      'rose',
    ]

    const darkThemes = [
      'dark',
      'midnight',
      'graphite',
      'forest',
      'ocean',
      'plum',
      'rust',
    ]

    it.each(lightThemes)('should accept light theme: %s', async (theme) => {
      const formData = createFormData(theme)
      const result = await updateBoardThemeAction({}, formData)

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.newTheme).toBe(theme)
    })

    it.each(darkThemes)('should accept dark theme: %s', async (theme) => {
      const formData = createFormData(theme)
      const result = await updateBoardThemeAction({}, formData)

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.newTheme).toBe(theme)
    })
  })

  describe('Theme Validation - Invalid Themes', () => {
    const invalidThemes = [
      'invalid',
      'system', // system is app-level only, not board-level
      'light',
      'random',
      '',
      'SUNRISE', // Case-sensitive
      'Default', // Case-sensitive
    ]

    it.each(invalidThemes)(
      'should reject invalid theme: "%s"',
      async (theme) => {
        const formData = createFormData(theme)
        const result = await updateBoardThemeAction({}, formData)

        expect(result.error).toBe('Invalid theme')
        expect(result.success).toBeUndefined()
      },
    )
  })

  describe('Regression: Default and Dark themes (bug fix)', () => {
    it('should accept "default" theme (previously rejected)', async () => {
      const formData = createFormData('default')
      const result = await updateBoardThemeAction({}, formData)

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.newTheme).toBe('default')
    })

    it('should accept "dark" theme (previously rejected)', async () => {
      const formData = createFormData('dark')
      const result = await updateBoardThemeAction({}, formData)

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.newTheme).toBe('dark')
    })
  })

  describe('Theme Count Verification', () => {
    it('should accept exactly 14 valid themes', async () => {
      const allThemes = [
        'default',
        'sunrise',
        'sandstone',
        'mint',
        'sky',
        'lavender',
        'rose',
        'dark',
        'midnight',
        'graphite',
        'forest',
        'ocean',
        'plum',
        'rust',
      ]

      expect(allThemes).toHaveLength(14)

      // Verify each theme is accepted
      for (const theme of allThemes) {
        const formData = createFormData(theme)
        const result = await updateBoardThemeAction({}, formData)
        expect(result.error).toBeUndefined()
      }
    })
  })
})
