/**
 * Unit Tests: useAddRepositoryCombobox Hook
 *
 * Tests for add repository combobox state management including:
 * - Combobox open/close state
 * - Status ID derivation (user selection or first column)
 * - Reset behavior when closing
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { useAddRepositoryCombobox } from '@/hooks/board/useAddRepositoryCombobox'
import type { StatusListDomain } from '@/lib/models/domain'

/**
 * Create a mock StatusListDomain object
 */
const createMockStatus = (
  overrides: Partial<StatusListDomain> = {},
): StatusListDomain => ({
  id: `status-${Math.random().toString(36).substring(2, 11)}`,
  title: 'Test Status',
  color: '#3b82f6',
  gridRow: 1,
  gridCol: 1,
  boardId: 'board-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('useAddRepositoryCombobox', () => {
  describe('Initial State', () => {
    it('should have correct initial state with status lists', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1', title: 'Todo' }),
        createMockStatus({ id: 'status-2', title: 'In Progress' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.isOpen).toBe(false)
      // Default to first status when no user selection
      expect(result.current.statusId).toBe('status-1')
    })

    it('should have empty statusId when no status lists', () => {
      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists: [] }),
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.statusId).toBe('')
    })
  })

  describe('openForStatus()', () => {
    it('should open combobox and set specific status ID', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1', title: 'Todo' }),
        createMockStatus({ id: 'status-2', title: 'In Progress' }),
        createMockStatus({ id: 'status-3', title: 'Done' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.statusId).toBe('status-1') // Default to first

      act(() => {
        result.current.openForStatus('status-2')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.statusId).toBe('status-2')
    })

    it('should override previous user selection', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1' }),
        createMockStatus({ id: 'status-2' }),
        createMockStatus({ id: 'status-3' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      act(() => {
        result.current.openForStatus('status-2')
      })
      expect(result.current.statusId).toBe('status-2')

      act(() => {
        result.current.openForStatus('status-3')
      })
      expect(result.current.statusId).toBe('status-3')
    })
  })

  describe('handleOpenChange()', () => {
    it('should open combobox when passed true', () => {
      const statusLists = [createMockStatus({ id: 'status-1' })]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      act(() => {
        result.current.handleOpenChange(true)
      })

      expect(result.current.isOpen).toBe(true)
    })

    it('should close combobox and reset to default when passed false', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1' }),
        createMockStatus({ id: 'status-2' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      // Open for specific status
      act(() => {
        result.current.openForStatus('status-2')
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
    it('should use user-selected status when specified', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1' }),
        createMockStatus({ id: 'status-2' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      act(() => {
        result.current.openForStatus('status-2')
      })

      expect(result.current.statusId).toBe('status-2')
    })

    it('should fall back to first column when no user selection', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1' }),
        createMockStatus({ id: 'status-2' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.statusId).toBe('status-1')
    })

    it('should update when statusLists change', () => {
      const initialStatusLists = [createMockStatus({ id: 'status-old' })]

      const { result, rerender } = renderHook(
        ({ statusLists }) => useAddRepositoryCombobox({ statusLists }),
        { initialProps: { statusLists: initialStatusLists } },
      )

      expect(result.current.statusId).toBe('status-old')

      const newStatusLists = [
        createMockStatus({ id: 'status-new-1' }),
        createMockStatus({ id: 'status-new-2' }),
      ]

      rerender({ statusLists: newStatusLists })

      expect(result.current.statusId).toBe('status-new-1')
    })

    it('should preserve user selection when statusLists change', () => {
      const initialStatusLists = [
        createMockStatus({ id: 'status-1' }),
        createMockStatus({ id: 'status-2' }),
      ]

      const { result, rerender } = renderHook(
        ({ statusLists }) => useAddRepositoryCombobox({ statusLists }),
        { initialProps: { statusLists: initialStatusLists } },
      )

      // User selects status-2
      act(() => {
        result.current.openForStatus('status-2')
      })
      expect(result.current.statusId).toBe('status-2')

      // Add new status
      const newStatusLists = [
        ...initialStatusLists,
        createMockStatus({ id: 'status-3' }),
      ]

      rerender({ statusLists: newStatusLists })

      // User selection should be preserved
      expect(result.current.statusId).toBe('status-2')
    })
  })

  describe('Memoization', () => {
    it('should maintain stable function references', () => {
      const statusLists = [createMockStatus({ id: 'status-1' })]

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
    it('should handle single status list', () => {
      const statusLists = [createMockStatus({ id: 'only-status' })]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      expect(result.current.statusId).toBe('only-status')

      // Opening for the only status should work
      act(() => {
        result.current.openForStatus('only-status')
      })
      expect(result.current.statusId).toBe('only-status')
    })

    it('should handle rapid open/close cycles', () => {
      const statusLists = [
        createMockStatus({ id: 'status-1' }),
        createMockStatus({ id: 'status-2' }),
      ]

      const { result } = renderHook(() =>
        useAddRepositoryCombobox({ statusLists }),
      )

      // Rapid cycles
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.openForStatus('status-2')
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
