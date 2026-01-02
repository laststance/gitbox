/**
 * Unit Tests: useProjectInfoModal Hook
 *
 * Tests for project info modal state management including:
 * - Modal open/close state
 * - Project info fetching
 * - Optimistic updates
 * - Error handling and rollback
 */

import * as Sentry from '@sentry/nextjs'
import { renderHook, act } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useProjectInfoModal } from '@/hooks/board/useProjectInfoModal'
import { getProjectInfo, upsertProjectInfo } from '@/lib/actions/project-info'

// Mock server actions
vi.mock('@/lib/actions/project-info', () => ({
  getProjectInfo: vi.fn(),
  upsertProjectInfo: vi.fn(),
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

const mockGetProjectInfo = vi.mocked(getProjectInfo)
const mockUpsertProjectInfo = vi.mocked(upsertProjectInfo)

describe('useProjectInfoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useProjectInfoModal())

      expect(result.current.isOpen).toBe(false)
      expect(result.current.selectedCardId).toBeNull()
      expect(result.current.projectInfo).toBeNull()
    })
  })

  describe('openModal()', () => {
    it('should open modal and fetch project info', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        note: 'Test note',
        comment: 'Test comment',
        links: [{ type: 'github', url: 'https://github.com' }],
      })

      const { result } = renderHook(() => useProjectInfoModal())

      await act(async () => {
        await result.current.openModal('card-1')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedCardId).toBe('card-1')
      expect(result.current.projectInfo).toEqual({
        id: 'card-1',
        note: 'Test note',
        comment: 'Test comment',
        links: [{ type: 'github', url: 'https://github.com' }],
      })
      expect(mockGetProjectInfo).toHaveBeenCalledWith('card-1')
    })

    it('should open modal with empty state when no data exists', async () => {
      mockGetProjectInfo.mockResolvedValueOnce(null)

      const { result } = renderHook(() => useProjectInfoModal())

      await act(async () => {
        await result.current.openModal('card-1')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.projectInfo).toEqual({
        id: 'card-1',
        note: '',
        comment: '',
        links: [],
      })
    })

    it('should handle fetch error and open with empty state', async () => {
      const error = new Error('Fetch failed')
      mockGetProjectInfo.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useProjectInfoModal())

      await act(async () => {
        await result.current.openModal('card-1')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.projectInfo).toEqual({
        id: 'card-1',
        note: '',
        comment: '',
        links: [],
      })
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { action: 'loadProjectInfo' },
      })
    })
  })

  describe('closeModal()', () => {
    it('should close modal and reset state', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        note: 'Test note',
        comment: '',
        links: [],
      })

      const { result } = renderHook(() => useProjectInfoModal())

      // Open first
      await act(async () => {
        await result.current.openModal('card-1')
      })

      expect(result.current.isOpen).toBe(true)

      // Close
      act(() => {
        result.current.closeModal()
      })

      expect(result.current.isOpen).toBe(false)
      expect(result.current.selectedCardId).toBeNull()
      expect(result.current.projectInfo).toBeNull()
    })
  })

  describe('saveProjectInfo()', () => {
    it('should save project info with optimistic update', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        note: 'Old note',
        comment: 'Old comment',
        links: [],
      })
      mockUpsertProjectInfo.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useProjectInfoModal())

      // Open modal first
      await act(async () => {
        await result.current.openModal('card-1')
      })

      // Save project info
      await act(async () => {
        await result.current.saveProjectInfo({
          note: 'New note',
          comment: 'New comment',
          links: [{ type: 'docs', url: 'https://docs.example.com' }],
        })
      })

      expect(mockUpsertProjectInfo).toHaveBeenCalledWith('card-1', {
        note: 'New note',
        comment: 'New comment',
        links: [{ type: 'docs', url: 'https://docs.example.com' }],
      })
      expect(toast.success).toHaveBeenCalledWith('Project info saved', {
        description: 'Your project information has been saved.',
      })
    })

    it('should rollback on save error', async () => {
      mockGetProjectInfo
        .mockResolvedValueOnce({
          note: 'Original note',
          comment: 'Original comment',
          links: [],
        })
        .mockResolvedValueOnce({
          note: 'Original note',
          comment: 'Original comment',
          links: [],
        })

      const saveError = new Error('Save failed')
      mockUpsertProjectInfo.mockRejectedValueOnce(saveError)

      const { result } = renderHook(() => useProjectInfoModal())

      // Open modal first
      await act(async () => {
        await result.current.openModal('card-1')
      })

      // Try to save (will fail)
      await act(async () => {
        await result.current.saveProjectInfo({
          note: 'New note',
          comment: 'New comment',
          links: [],
        })
      })

      // Should rollback to original data
      expect(result.current.projectInfo).toEqual({
        id: 'card-1',
        note: 'Original note',
        comment: 'Original comment',
        links: [],
      })
      expect(Sentry.captureException).toHaveBeenCalledWith(saveError, {
        tags: { action: 'saveProjectInfo' },
      })
      expect(toast.error).toHaveBeenCalledWith('Failed to save project info', {
        description: 'Please try again.',
      })
    })

    it('should not save when no card is selected', async () => {
      const { result } = renderHook(() => useProjectInfoModal())

      await act(async () => {
        await result.current.saveProjectInfo({
          note: 'Test',
          comment: '',
          links: [],
        })
      })

      expect(mockUpsertProjectInfo).not.toHaveBeenCalled()
    })

    it('should handle rollback error gracefully', async () => {
      mockGetProjectInfo
        .mockResolvedValueOnce({
          note: 'Original',
          comment: '',
          links: [],
        })
        .mockRejectedValueOnce(new Error('Rollback fetch failed'))

      mockUpsertProjectInfo.mockRejectedValueOnce(new Error('Save failed'))

      const { result } = renderHook(() => useProjectInfoModal())

      await act(async () => {
        await result.current.openModal('card-1')
      })

      await act(async () => {
        await result.current.saveProjectInfo({
          note: 'New',
          comment: '',
          links: [],
        })
      })

      // Sentry should be called twice - once for save error, once for rollback error
      expect(Sentry.captureException).toHaveBeenCalledTimes(2)
    })
  })

  describe('Memoization', () => {
    it('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() => useProjectInfoModal())

      const initialOpenModal = result.current.openModal
      const initialCloseModal = result.current.closeModal
      const initialSaveProjectInfo = result.current.saveProjectInfo

      rerender()

      expect(result.current.openModal).toBe(initialOpenModal)
      expect(result.current.closeModal).toBe(initialCloseModal)
      expect(result.current.saveProjectInfo).toBe(initialSaveProjectInfo)
    })
  })
})
