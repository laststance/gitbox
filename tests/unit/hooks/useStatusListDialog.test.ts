/**
 * Unit Tests: useStatusListDialog Hook
 *
 * Tests for status list dialog state management including:
 * - Dialog open/close in create/edit modes
 * - Status CRUD operations
 * - Delete confirmation dialog
 * - Redux integration
 */

import { configureStore } from '@reduxjs/toolkit'
import * as Sentry from '@sentry/nextjs'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useStatusListDialog } from '@/hooks/board/useStatusListDialog'
import {
  createStatusList,
  updateStatusList,
  deleteStatusList,
} from '@/lib/actions/board'
import type { StatusListDomain } from '@/lib/models/domain'
import boardSlice from '@/lib/redux/slices/boardSlice'

// Mock server actions
vi.mock('@/lib/actions/board', () => ({
  createStatusList: vi.fn(),
  updateStatusList: vi.fn(),
  deleteStatusList: vi.fn(),
}))

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockCreateStatusList = vi.mocked(createStatusList)
const mockUpdateStatusList = vi.mocked(updateStatusList)
const mockDeleteStatusList = vi.mocked(deleteStatusList)

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

/**
 * Create a test store with initial state
 */
const createTestStore = (statusLists: StatusListDomain[] = []) => {
  return configureStore({
    reducer: {
      board: boardSlice,
    },
    preloadedState: {
      board: {
        activeBoard: null,
        statusLists,
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      },
    },
  })
}

/**
 * Wrapper component for Redux Provider
 */
const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    // Type assertion needed for React 19 compatibility
    return React.createElement(
      Provider,
      { store } as React.ComponentProps<typeof Provider>,
      children,
    )
  }
}

describe('useStatusListDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = createTestStore()
      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.selectedStatus).toBeNull()
      expect(result.current.mode).toBe('create')
      expect(result.current.isDeleteConfirmOpen).toBe(false)
      expect(result.current.pendingDeleteStatusId).toBeNull()
      expect(result.current.pendingDeleteStatusTitle).toBeUndefined()
    })
  })

  describe('openCreate()', () => {
    it('should open dialog in create mode', () => {
      const store = createTestStore()
      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.openCreate()
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.mode).toBe('create')
      expect(result.current.selectedStatus).toBeNull()
    })
  })

  describe('openEdit()', () => {
    it('should open dialog in edit mode with selected status', () => {
      const store = createTestStore()
      const status = createMockStatus({ id: 'status-1', title: 'Todo' })

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.openEdit(status)
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.mode).toBe('edit')
      expect(result.current.selectedStatus).toEqual(status)
    })
  })

  describe('close()', () => {
    it('should close dialog', () => {
      const store = createTestStore()
      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      // Open first
      act(() => {
        result.current.openCreate()
      })
      expect(result.current.isOpen).toBe(true)

      // Close
      act(() => {
        result.current.close()
      })
      expect(result.current.isOpen).toBe(false)
    })
  })

  describe('save() - Create Mode', () => {
    it('should create new status and update Redux', async () => {
      const store = createTestStore([])
      const newStatus = createMockStatus({
        id: 'new-status',
        title: 'New Column',
        color: '#10b981',
      })
      mockCreateStatusList.mockResolvedValueOnce(newStatus)

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      // Open in create mode
      act(() => {
        result.current.openCreate()
      })

      // Save
      await act(async () => {
        await result.current.save({ name: 'New Column', color: '#10b981' })
      })

      expect(mockCreateStatusList).toHaveBeenCalledWith(
        'board-1',
        'New Column',
        '#10b981',
      )
      expect(toast.success).toHaveBeenCalledWith('Column created', {
        description: '"New Column" has been created.',
      })

      // Check Redux state
      const state = store.getState()
      expect(state.board.statusLists).toHaveLength(1)
      expect(state.board.statusLists[0]!.title).toBe('New Column')
    })

    it('should handle create error', async () => {
      const store = createTestStore([])
      const error = new Error('Create failed')
      mockCreateStatusList.mockRejectedValueOnce(error)

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.openCreate()
      })

      await act(async () => {
        await result.current.save({ name: 'New Column', color: '#000' })
      })

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { action: 'saveStatusList' },
      })
      expect(toast.error).toHaveBeenCalledWith('Failed to create column', {
        description: 'Please try again.',
      })
    })
  })

  describe('save() - Edit Mode', () => {
    it('should update existing status and Redux', async () => {
      const existingStatus = createMockStatus({
        id: 'status-1',
        title: 'Old Title',
        color: '#000',
      })
      const store = createTestStore([existingStatus])
      mockUpdateStatusList.mockResolvedValueOnce(undefined)

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      // Open in edit mode
      act(() => {
        result.current.openEdit(existingStatus)
      })

      // Save with new values
      await act(async () => {
        await result.current.save({ name: 'Updated Title', color: '#fff' })
      })

      expect(mockUpdateStatusList).toHaveBeenCalledWith('status-1', {
        name: 'Updated Title',
        color: '#fff',
      })
      expect(toast.success).toHaveBeenCalledWith('Column updated', {
        description: '"Updated Title" has been updated.',
      })

      // Check Redux state
      const state = store.getState()
      expect(state.board.statusLists[0]!.title).toBe('Updated Title')
      expect(state.board.statusLists[0]!.color).toBe('#fff')
    })

    it('should handle update error', async () => {
      const existingStatus = createMockStatus({ id: 'status-1' })
      const store = createTestStore([existingStatus])
      const error = new Error('Update failed')
      mockUpdateStatusList.mockRejectedValueOnce(error)

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.openEdit(existingStatus)
      })

      await act(async () => {
        await result.current.save({ name: 'New', color: '#000' })
      })

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { action: 'saveStatusList' },
      })
      expect(toast.error).toHaveBeenCalledWith('Failed to update column', {
        description: 'Please try again.',
      })
    })
  })

  describe('Delete Confirmation Flow', () => {
    it('should open delete confirmation dialog', () => {
      const existingStatus = createMockStatus({
        id: 'status-1',
        title: 'To Delete',
      })
      const store = createTestStore([existingStatus])

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.requestDelete('status-1')
      })

      expect(result.current.isDeleteConfirmOpen).toBe(true)
      expect(result.current.pendingDeleteStatusId).toBe('status-1')
      expect(result.current.pendingDeleteStatusTitle).toBe('To Delete')
    })

    it('should cancel delete', () => {
      const existingStatus = createMockStatus({ id: 'status-1' })
      const store = createTestStore([existingStatus])

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      // Request delete
      act(() => {
        result.current.requestDelete('status-1')
      })
      expect(result.current.isDeleteConfirmOpen).toBe(true)

      // Cancel
      act(() => {
        result.current.cancelDelete()
      })

      expect(result.current.isDeleteConfirmOpen).toBe(false)
      expect(result.current.pendingDeleteStatusId).toBeNull()
    })

    it('should confirm delete and update Redux', async () => {
      const existingStatus = createMockStatus({
        id: 'status-1',
        title: 'Deleted Status',
      })
      const store = createTestStore([existingStatus])
      mockDeleteStatusList.mockResolvedValueOnce(undefined)

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      // Request delete
      act(() => {
        result.current.requestDelete('status-1')
      })

      // Confirm delete
      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(mockDeleteStatusList).toHaveBeenCalledWith('status-1', 'board-1')
      expect(toast.success).toHaveBeenCalledWith('Column deleted', {
        description: '"Deleted Status" has been deleted.',
      })

      // Check Redux state
      const state = store.getState()
      expect(state.board.statusLists).toHaveLength(0)

      // Dialog should be closed
      expect(result.current.isDeleteConfirmOpen).toBe(false)
      expect(result.current.pendingDeleteStatusId).toBeNull()
    })

    it('should handle delete error', async () => {
      const existingStatus = createMockStatus({ id: 'status-1' })
      const store = createTestStore([existingStatus])
      const error = new Error('Delete failed')
      mockDeleteStatusList.mockRejectedValueOnce(error)

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.requestDelete('status-1')
      })

      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { action: 'deleteStatusList' },
      })
      expect(toast.error).toHaveBeenCalledWith('Failed to delete column', {
        description: 'Please try again.',
      })

      // Status should still exist in Redux
      const state = store.getState()
      expect(state.board.statusLists).toHaveLength(1)
    })

    it('should not delete when no pending status', async () => {
      const store = createTestStore([])

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(mockDeleteStatusList).not.toHaveBeenCalled()
    })

    it('should handle non-existent status in confirmDelete', async () => {
      const store = createTestStore([]) // No statuses

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      // Set pending delete ID manually (simulating edge case)
      act(() => {
        result.current.requestDelete('non-existent')
      })

      await act(async () => {
        await result.current.confirmDelete()
      })

      // Should not call delete since status doesn't exist
      expect(mockDeleteStatusList).not.toHaveBeenCalled()
      expect(result.current.isDeleteConfirmOpen).toBe(false)
    })
  })

  describe('setDeleteConfirmOpen()', () => {
    it('should control delete confirmation dialog visibility', () => {
      const store = createTestStore([])

      const { result } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      act(() => {
        result.current.setDeleteConfirmOpen(true)
      })
      expect(result.current.isDeleteConfirmOpen).toBe(true)

      act(() => {
        result.current.setDeleteConfirmOpen(false)
      })
      expect(result.current.isDeleteConfirmOpen).toBe(false)
      expect(result.current.pendingDeleteStatusId).toBeNull()
    })
  })

  describe('Memoization', () => {
    it('should maintain stable function references', () => {
      const store = createTestStore()
      const { result, rerender } = renderHook(
        () => useStatusListDialog({ boardId: 'board-1' }),
        { wrapper: createWrapper(store) },
      )

      const initialFunctions = {
        openCreate: result.current.openCreate,
        openEdit: result.current.openEdit,
        close: result.current.close,
        cancelDelete: result.current.cancelDelete,
        setDeleteConfirmOpen: result.current.setDeleteConfirmOpen,
      }

      rerender()

      expect(result.current.openCreate).toBe(initialFunctions.openCreate)
      expect(result.current.openEdit).toBe(initialFunctions.openEdit)
      expect(result.current.close).toBe(initialFunctions.close)
      expect(result.current.cancelDelete).toBe(initialFunctions.cancelDelete)
      expect(result.current.setDeleteConfirmOpen).toBe(
        initialFunctions.setDeleteConfirmOpen,
      )
    })
  })
})
