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
import type { FetchedBoardDetails } from '@/lib/utils/adopt-fetched-board-details'

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

  describe('a refetch', () => {
    const page: {
      boardId: string
      boardName: string
      boardSubtitle: string | null
      boardSettings: typeof defaultBoardSettings
      fetchedDetails: FetchedBoardDetails | null
    } = {
      boardId: 'board-1',
      boardName: 'Alpha',
      boardSubtitle: 'first',
      boardSettings: defaultBoardSettings,
      fetchedDetails: null,
    }

    // Value: protects=a rename stays when a refetch was read before it was saved, and a subtitle saved in another tab shows up (TODOS.md board settings refetch); fails_when=the fetch puts the previous name back, or the header keeps the subtitle this tab had; why_new=the hook used to keep its first props; seam=none; no_claim=the fetch itself (useBoardServerSync.test.tsx)
    test('shows a subtitle saved in another tab and keeps a rename the fetch still has as the previous name', () => {
      // Arrange
      const { result, rerender } = renderHook(
        (props: typeof page) => useBoardSettings(props),
        { initialProps: page },
      )
      act(() => {
        result.current.open()
        result.current.handleRenameSuccess('Beta')
      })
      const cardDisplay = result.current.cardDisplaySettings

      // Act: the read still has the name and the settings this tab started with
      rerender({
        ...page,
        fetchedDetails: {
          boardId: 'board-1',
          name: 'Alpha',
          subtitle: 'first',
          settings: {
            cardDisplay: {
              showGitHubDescription: true,
              showComment: true,
              commentText: { fontSize: 'sm', fontWeight: 'normal' },
            },
          },
          comments: {},
        },
      })

      // Assert
      expect(result.current.displayName).toBe('Beta')
      expect(result.current.displaySubtitle).toBe('first')
      expect(result.current.cardDisplaySettings).toBe(cardDisplay)
      expect(result.current.isOpen).toBe(true)

      // Act: another tab saved a subtitle and hid the comment on cards
      rerender({
        ...page,
        fetchedDetails: {
          boardId: 'board-1',
          name: 'Alpha',
          subtitle: 'from the other tab',
          settings: {
            showSubtitle: false,
            cardDisplay: {
              showGitHubDescription: true,
              showComment: false,
              commentText: { fontSize: 'sm', fontWeight: 'normal' },
            },
          },
          comments: {},
        },
      })

      // Assert: the rename stays, because this read still has the previous name
      expect(result.current.displayName).toBe('Beta')
      expect(result.current.displaySubtitle).toBe('from the other tab')
      expect(result.current.showSubtitle).toBe(false)
      expect(result.current.cardDisplaySettings).toEqual({
        showGitHubDescription: true,
        showComment: false,
        commentText: { fontSize: 'sm', fontWeight: 'normal' },
      })
      expect(result.current.isOpen).toBe(true)
    })

    // Value: protects=opening another board shows that board, not a fetch of the one just left; fails_when=the previous board's name stays on screen; why_new=the fetched copy lives in state that survives a new board id; seam=none; no_claim=navigation
    test('shows the board the page moved to, not a fetch of the board just left', () => {
      // Arrange
      const { result, rerender } = renderHook(
        (props: typeof page) => useBoardSettings(props),
        { initialProps: page },
      )
      rerender({
        ...page,
        fetchedDetails: {
          boardId: 'board-1',
          name: 'Renamed elsewhere',
          subtitle: 'from the other tab',
          settings: defaultBoardSettings,
          comments: {},
        },
      })
      expect(result.current.displayName).toBe('Renamed elsewhere')

      // Act
      rerender({
        ...page,
        boardId: 'board-2',
        boardName: 'Other',
        boardSubtitle: null,
        fetchedDetails: {
          boardId: 'board-1',
          name: 'Renamed elsewhere',
          subtitle: 'from the other tab',
          settings: defaultBoardSettings,
          comments: {},
        },
      })

      // Assert
      expect(result.current.displayName).toBe('Other')
      expect(result.current.displaySubtitle).toBe('')
    })
  })
})
