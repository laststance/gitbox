/**
 * Unit Tests: useAddRepositoryCombobox Hook
 *
 * Tests for add repository combobox state management including:
 * - Combobox open/close state
 * - Status ID derivation (user selection or first column)
 * - Reset behavior when closing
 */

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, test, expect, vi } from 'vitest'

import { useAddRepositoryCombobox } from '@/hooks/board/useAddRepositoryCombobox'
import type { StatusListDomain } from '@/lib/models/domain'
import { toBoardId, toStatusListId } from '@/lib/types/brands'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

/**
 * Create a mock StatusListDomain object
 */
const createMockStatus = (
  overrides: Partial<StatusListDomain> = {},
): StatusListDomain => ({
  id: toStatusListId(`status-${Math.random().toString(36).substring(2, 11)}`),
  title: 'Test Status',
  color: '#3b82f6',
  gridRow: 1,
  gridCol: 1,
  boardId: toBoardId('board-1'),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('useAddRepositoryCombobox', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/board/board-1')
  })

  test('reopens the repository picker in the selected column after GitHub reauthentication', () => {
    // Arrange
    window.history.replaceState(
      {},
      '',
      '/board/board-1?addRepositoryTo=status-2',
    )
    const statusLists = [
      createMockStatus({ id: toStatusListId('status-1') }),
      createMockStatus({ id: toStatusListId('status-2') }),
    ]

    // Act
    const { result } = renderHook(() =>
      useAddRepositoryCombobox({ statusLists }),
    )

    // Assert
    expect(result.current.isOpen).toBe(true)
    expect(result.current.statusId).toBe('status-2')
  })

  test('restores the target column once board data hydrates after reauthentication', () => {
    // Arrange
    window.history.replaceState(
      {},
      '',
      '/board/board-1?addRepositoryTo=status-2',
    )
    const { result, rerender } = renderHook(
      ({ statusLists }) => useAddRepositoryCombobox({ statusLists }),
      { initialProps: { statusLists: [] as StatusListDomain[] } },
    )
    expect(result.current.isOpen).toBe(false)

    // Act
    rerender({
      statusLists: [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
      ],
    })

    // Assert
    expect(result.current.isOpen).toBe(true)
    expect(result.current.statusId).toBe('status-2')
  })

  test('closing the restored picker clears its return marker while preserving the board URL', () => {
    // Arrange
    window.history.replaceState(
      { __NA: true },
      '',
      '/board/board-1?view=compact&addRepositoryTo=status-2#cards',
    )
    const statusLists = [
      createMockStatus({ id: toStatusListId('status-1') }),
      createMockStatus({ id: toStatusListId('status-2') }),
    ]
    const { result, rerender } = renderHook(() =>
      useAddRepositoryCombobox({ statusLists }),
    )

    // Act
    act(() => result.current.handleOpenChange(false))
    rerender()

    // Assert
    expect(result.current.isOpen).toBe(false)
    expect(result.current.statusId).toBe('status-1')
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe('/board/board-1?view=compact#cards')
    expect(window.history.state).toBeNull()
  })

  test('does not reopen for a deleted column or a column from another board', () => {
    // Arrange
    window.history.replaceState(
      {},
      '',
      '/board/board-1?addRepositoryTo=other-board-status',
    )
    const statusLists = [createMockStatus({ id: toStatusListId('status-1') })]

    // Act
    const { result } = renderHook(() =>
      useAddRepositoryCombobox({ statusLists }),
    )

    // Assert
    expect(result.current.isOpen).toBe(false)
    expect(result.current.statusId).toBe('status-1')
  })

  describe('Initial State', () => {
    test('should have correct initial state with status lists', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1'), title: 'Todo' }),
        createMockStatus({
          id: toStatusListId('status-2'),
          title: 'In Progress',
        }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.isOpen).toBe(false)
      // Default to first status when no user selection
      expect(result.current.statusId).toBe('status-1')
    })

    test('should have null statusId when no status lists', () => {
      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists: [] }),
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.statusId).toBeNull()
    })
  })

  describe('openForStatus()', () => {
    test('should open combobox and set specific status ID', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1'), title: 'Todo' }),
        createMockStatus({
          id: toStatusListId('status-2'),
          title: 'In Progress',
        }),
        createMockStatus({ id: toStatusListId('status-3'), title: 'Done' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.statusId).toBe('status-1') // Default to first

      act(() => {
        result.current.openForStatus(toStatusListId('status-2'))
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.statusId).toBe('status-2')
    })

    test('should override previous user selection', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
        createMockStatus({ id: toStatusListId('status-3') }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      act(() => {
        result.current.openForStatus(toStatusListId('status-2'))
      })
      expect(result.current.statusId).toBe('status-2')

      act(() => {
        result.current.openForStatus(toStatusListId('status-3'))
      })
      expect(result.current.statusId).toBe('status-3')
    })
  })

  describe('handleOpenChange()', () => {
    test('should open combobox when passed true', () => {
      const statusLists = [createMockStatus({ id: toStatusListId('status-1') })]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      act(() => {
        result.current.handleOpenChange(true)
      })

      expect(result.current.isOpen).toBe(true)
    })

    test('should close combobox and reset to default when passed false', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      // Open for specific status
      act(() => {
        result.current.openForStatus(toStatusListId('status-2'))
      })
      expect(result.current.statusId).toBe('status-2')

      // Close
      act(() => {
        result.current.handleOpenChange(false)
      })

      expect(result.current.isOpen).toBe(false)
      // Should reset to first column (default)
      expect(result.current.statusId).toBe('status-1')
    })
  })

  describe('statusId Derivation', () => {
    test('should use user-selected status when specified', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      act(() => {
        result.current.openForStatus(toStatusListId('status-2'))
      })

      expect(result.current.statusId).toBe('status-2')
    })

    test('should fall back to first column when no user selection', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.statusId).toBe('status-1')
    })

    test('should update when statusLists change', () => {
      const initialStatusLists = [
        createMockStatus({ id: toStatusListId('status-old') }),
      ]

      const { result, rerender } = renderHook(
        ({ statusLists }) => useAddRepositoryCombobox({ statusLists }),
        { initialProps: { statusLists: initialStatusLists } },
      )

      expect(result.current.statusId).toBe('status-old')

      const newStatusLists = [
        createMockStatus({ id: toStatusListId('status-new-1') }),
        createMockStatus({ id: toStatusListId('status-new-2') }),
      ]

      rerender({ statusLists: newStatusLists })

      expect(result.current.statusId).toBe('status-new-1')
    })

    test('should preserve user selection when statusLists change', () => {
      const initialStatusLists = [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
      ]

      const { result, rerender } = renderHook(
        ({ statusLists }) => useAddRepositoryCombobox({ statusLists }),
        { initialProps: { statusLists: initialStatusLists } },
      )

      // User selects status-2
      act(() => {
        result.current.openForStatus(toStatusListId('status-2'))
      })
      expect(result.current.statusId).toBe('status-2')

      // Add new status
      const newStatusLists = [
        ...initialStatusLists,
        createMockStatus({ id: toStatusListId('status-3') }),
      ]

      rerender({ statusLists: newStatusLists })

      // User selection should be preserved
      expect(result.current.statusId).toBe('status-2')
    })
  })

  describe('Memoization', () => {
    test('should maintain stable function references', () => {
      const statusLists = [createMockStatus({ id: toStatusListId('status-1') })]

      const { result, rerender } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      const initialOpenForStatus = result.current.openForStatus
      const initialHandleOpenChange = result.current.handleOpenChange

      rerender()

      expect(result.current.openForStatus).toBe(initialOpenForStatus)
      expect(result.current.handleOpenChange).toBe(initialHandleOpenChange)
    })
  })

  describe('Edge Cases', () => {
    test('should handle single status list', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('only-status') }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.statusId).toBe('only-status')

      // Opening for the only status should work
      act(() => {
        result.current.openForStatus(toStatusListId('only-status'))
      })
      expect(result.current.statusId).toBe('only-status')
    })

    test('should handle rapid open/close cycles', () => {
      const statusLists = [
        createMockStatus({ id: toStatusListId('status-1') }),
        createMockStatus({ id: toStatusListId('status-2') }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      // Rapid cycles
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.openForStatus(toStatusListId('status-2'))
        })
        act(() => {
          result.current.handleOpenChange(false)
        })
      }

      // Should be closed and reset to default
      expect(result.current.isOpen).toBe(false)
      expect(result.current.statusId).toBe('status-1')
    })
  })
})
