/**
 * Unit Tests: useBoardSettings Hook
 *
 * Tests for board settings dialog state management including:
 * - Dialog open/close state
 * - Display name updates (optimistic rename)
 * - Card display settings management
 */

import { renderHook, act } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

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
    test('should have correct initial state', () => {
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

    test('should use default settings when boardSettings is null', () => {
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

    test('should use default settings when boardSettings is undefined', () => {
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

    test('should use default settings when boardSettings is invalid', () => {
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
    test('should open the dialog', () => {
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
    test('should close the dialog', () => {
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
    test('should update display name', () => {
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
    test('should update card display settings', () => {
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
    test('should maintain stable function references', () => {
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
    test('should handle empty board name', () => {
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: '',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      expect(result.current.displayName).toBe('')
    })

    test('should handle partial card display settings', () => {
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

  describe('Share link', () => {
    type FetchedSharing = { isPublic: boolean; shareSlug: string | null }

    test('offers the share slug of a board that is shared when the page loads', () => {
      // Arrange / Act
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
          isPublic: true,
          shareSlug: 'a1b2c3d4e5f6',
        }),
      )

      // Assert
      expect(result.current.publicShareSlug).toBe('a1b2c3d4e5f6')
    })

    test('offers no share slug for a private board that kept its slug from earlier sharing', () => {
      // Arrange / Act: sharing was turned off, the slug stays in the database
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
          isPublic: false,
          shareSlug: 'a1b2c3d4e5f6',
        }),
      )

      // Assert
      expect(result.current.publicShareSlug).toBeNull()
    })

    test('offers the share slug as soon as sharing is turned on', () => {
      // Arrange
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
        }),
      )

      // Act
      act(() => {
        result.current.handlePublicChange(true, 'a1b2c3d4e5f6')
      })

      // Assert
      expect(result.current.publicShareSlug).toBe('a1b2c3d4e5f6')
    })

    test('stops offering the share slug as soon as sharing is turned off', () => {
      // Arrange
      const { result } = renderHook(() =>
        useBoardSettings({
          boardName: 'Test Board',
          boardSubtitle: null,
          boardSettings: defaultBoardSettings,
          isPublic: true,
          shareSlug: 'a1b2c3d4e5f6',
        }),
      )

      // Act: the server keeps the slug when the board goes private
      act(() => {
        result.current.handlePublicChange(false, 'a1b2c3d4e5f6')
      })

      // Assert
      expect(result.current.publicShareSlug).toBeNull()
    })

    test('offers the share slug once the board is fetched again after sharing was turned on in another tab', () => {
      // Arrange: the page loaded while the board was private
      const privateBoard: FetchedSharing = { isPublic: false, shareSlug: null }
      const { result, rerender } = renderHook(
        (board: FetchedSharing) =>
          useBoardSettings({
            boardName: 'Test Board',
            boardSubtitle: null,
            boardSettings: defaultBoardSettings,
            isPublic: board.isPublic,
            shareSlug: board.shareSlug,
          }),
        { initialProps: privateBoard },
      )
      expect(result.current.publicShareSlug).toBeNull()

      // Act: the fetched board is shared now
      rerender({ isPublic: true, shareSlug: 'a1b2c3d4e5f6' })

      // Assert
      expect(result.current.publicShareSlug).toBe('a1b2c3d4e5f6')
    })

    test('stops offering the share slug once the board is fetched again after sharing was turned off in another tab', () => {
      // Arrange: the page loaded while the board was shared
      const sharedBoard: FetchedSharing = {
        isPublic: true,
        shareSlug: 'a1b2c3d4e5f6',
      }
      const { result, rerender } = renderHook(
        (board: FetchedSharing) =>
          useBoardSettings({
            boardName: 'Test Board',
            boardSubtitle: null,
            boardSettings: defaultBoardSettings,
            isPublic: board.isPublic,
            shareSlug: board.shareSlug,
          }),
        { initialProps: sharedBoard },
      )
      expect(result.current.publicShareSlug).toBe('a1b2c3d4e5f6')

      // Act: the fetched board is private now and keeps its slug
      rerender({ isPublic: false, shareSlug: 'a1b2c3d4e5f6' })

      // Assert
      expect(result.current.publicShareSlug).toBeNull()
    })

    test('offers the new share slug once the board is fetched again with another slug', () => {
      // Arrange
      const sharedBoard: FetchedSharing = {
        isPublic: true,
        shareSlug: 'a1b2c3d4e5f6',
      }
      const { result, rerender } = renderHook(
        (board: FetchedSharing) =>
          useBoardSettings({
            boardName: 'Test Board',
            boardSubtitle: null,
            boardSettings: defaultBoardSettings,
            isPublic: board.isPublic,
            shareSlug: board.shareSlug,
          }),
        { initialProps: sharedBoard },
      )

      // Act: still shared, under another slug
      rerender({ isPublic: true, shareSlug: 'f6e5d4c3b2a1' })

      // Assert
      expect(result.current.publicShareSlug).toBe('f6e5d4c3b2a1')
    })

    test('keeps the share slug the settings dialog reported when the board is fetched again unchanged', () => {
      // Arrange: sharing was turned on in the dialog of a page that loaded
      // while the board was private
      const privateBoard: FetchedSharing = { isPublic: false, shareSlug: null }
      const { result, rerender } = renderHook(
        (board: FetchedSharing) =>
          useBoardSettings({
            boardName: 'Test Board',
            boardSubtitle: null,
            boardSettings: defaultBoardSettings,
            isPublic: board.isPublic,
            shareSlug: board.shareSlug,
          }),
        { initialProps: privateBoard },
      )
      act(() => {
        result.current.handlePublicChange(true, 'a1b2c3d4e5f6')
      })

      // Act: a fetch that started before the switch was saved brings the
      // same private board again
      rerender({ isPublic: false, shareSlug: null })

      // Assert: the dialog's change is not undone
      expect(result.current.publicShareSlug).toBe('a1b2c3d4e5f6')
    })
  })
})
