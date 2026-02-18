/**
 * Unit Tests: useBoardSettings Hook
 *
 * Tests for board settings dialog state management including:
 * - Dialog open/close state
 * - Display name updates (optimistic rename)
 * - Card display settings management
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { useBoardSettings } from '@/hooks/board/useBoardSettings'
import {
  DEFAULT_CARD_DISPLAY_SETTINGS,
  type CardDisplaySettings,
} from '@/lib/types/board-settings'

describe('useBoardSettings', () => {
  const defaultBoardSettings = {
    cardDisplay: {
      showGitHubDescription: true,
      showComment: true,
      commentText: {
        fontSize: 'sm',
        fontWeight: 'normal',
      },
    },
  }

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.displayName).toBe('Test Board')
      expect(result.current.cardDisplaySettings).toEqual({
        showGitHubDescription: true,
        showComment: true,
        commentText: {
          fontSize: 'sm',
          fontWeight: 'normal',
        },
      })
    })

    it('should use default settings when boardSettings is null', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: null,
        }),
      )

      // Should use DEFAULT_CARD_DISPLAY_SETTINGS
      expect(result.current.cardDisplaySettings).toEqual(
        DEFAULT_CARD_DISPLAY_SETTINGS,
      )
    })

    it('should use default settings when boardSettings is undefined', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: undefined,
        }),
      )

      expect(result.current.cardDisplaySettings).toEqual(
        DEFAULT_CARD_DISPLAY_SETTINGS,
      )
    })

    it('should use default settings when boardSettings is invalid', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: 'invalid-json',
        }),
      )

      expect(result.current.cardDisplaySettings).toEqual(
        DEFAULT_CARD_DISPLAY_SETTINGS,
      )
    })
  })

  describe('open()', () => {
    it('should open the dialog', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      expect(result.current.isOpen).toBe(false)

      act(() => {
        result.current.open()
      })

      expect(result.current.isOpen).toBe(true)
    })
  })

  describe('close()', () => {
    it('should close the dialog', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      // Open first
      act(() => {
        result.current.open()
      })
      expect(result.current.isOpen).toBe(true)

      // Close
      act(() => {
        result.current.close()
      })
      expect(result.current.isOpen).toBe(false)
    })
  })

  describe('handleRenameSuccess()', () => {
    it('should update display name', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Original Name',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      expect(result.current.displayName).toBe('Original Name')

      act(() => {
        result.current.handleRenameSuccess('New Name')
      })

      expect(result.current.displayName).toBe('New Name')
    })
  })

  describe('handleCardDisplayChange()', () => {
    it('should update card display settings', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      const newSettings: CardDisplaySettings = {
        showGitHubDescription: false,
        showComment: false,
        commentText: {
          fontSize: 'lg',
          fontWeight: 'semibold',
        },
      }

      act(() => {
        result.current.handleCardDisplayChange(newSettings)
      })

      expect(result.current.cardDisplaySettings).toEqual(newSettings)
    })
  })

  describe('Memoization', () => {
    it('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      const initialOpen = result.current.open
      const initialClose = result.current.close
      const initialHandleRenameSuccess = result.current.handleRenameSuccess
      const initialHandleCardDisplayChange =
        result.current.handleCardDisplayChange

      rerender()

      expect(result.current.open).toBe(initialOpen)
      expect(result.current.close).toBe(initialClose)
      expect(result.current.handleRenameSuccess).toBe(
        initialHandleRenameSuccess,
      )
      expect(result.current.handleCardDisplayChange).toBe(
        initialHandleCardDisplayChange,
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty board name', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: '',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      expect(result.current.displayName).toBe('')
    })

    it('should handle partial card display settings', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: {
            cardDisplay: {
              showGitHubDescription: false,
              // Missing showComment and commentText - should use defaults
            },
          },
        }),
      )

      // Should merge with defaults
      expect(result.current.cardDisplaySettings.showGitHubDescription).toBe(
        false,
      )
      expect(result.current.cardDisplaySettings.showComment).toBe(true) // default
      expect(result.current.cardDisplaySettings.commentText).toEqual({
        fontSize: 'sm',
        fontWeight: 'normal',
      })
    })
  })
})
