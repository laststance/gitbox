/**
 * Unit Tests: useNoteModal Hook
 *
 * Tests for note modal state management including:
 * - Modal open/close state
 * - Note fetching from server
 * - Note saving
 * - Error handling
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useNoteModal } from '@/hooks/board/useNoteModal'
import { getProjectInfo, upsertProjectInfo } from '@/lib/actions/project-info'
import type { RepoCardForRedux } from '@/lib/models/domain'

// Mock server actions
vi.mock('@/lib/actions/project-info', () => ({
  getProjectInfo: vi.fn(),
  upsertProjectInfo: vi.fn(),
}))

const mockGetProjectInfo = vi.mocked(getProjectInfo)
const mockUpsertProjectInfo = vi.mocked(upsertProjectInfo)

describe('useNoteModal', () => {
  const mockRepoCards: RepoCardForRedux[] = [
    {
      id: 'card-1',
      title: 'test/repo-1',
      description: 'Test repository 1',
      statusId: 'status-1',
      boardId: 'board-1',
      repoOwner: 'test',
      repoName: 'repo-1',
      order: 0,
      meta: {},
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'card-2',
      title: 'test/repo-2',
      description: 'Test repository 2',
      statusId: 'status-1',
      boardId: 'board-1',
      repoOwner: 'test',
      repoName: 'repo-2',
      order: 1,
      meta: {},
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      expect(result.current.isOpen).toBe(false)
      expect(result.current.cardId).toBeNull()
      expect(result.current.cardTitle).toBe('')
      expect(result.current.initialNote).toBe('')
      expect(result.current.initialLinks).toEqual([])
    })
  })

  describe('open()', () => {
    it('should open modal and fetch note and links for card', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        success: true,
        data: {
          note: 'Existing note content',
          comment: '',
          links: [{ url: 'https://vercel.app', type: 'vercel' }],
        },
      })

      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      await act(async () => {
        await result.current.open('card-1')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.cardId).toBe('card-1')
      expect(result.current.cardTitle).toBe('test/repo-1')
      expect(result.current.initialNote).toBe('Existing note content')
      expect(result.current.initialLinks).toEqual([
        { url: 'https://vercel.app', type: 'vercel' },
      ])
      expect(mockGetProjectInfo).toHaveBeenCalledWith('card-1')
    })

    it('should set empty note and links when no project info exists', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        success: true,
        data: null,
      })

      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      await act(async () => {
        await result.current.open('card-1')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.initialNote).toBe('')
      expect(result.current.initialLinks).toEqual([])
    })

    it('should handle fetch error gracefully', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      })

      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      await act(async () => {
        await result.current.open('card-1')
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.initialNote).toBe('')
      expect(result.current.initialLinks).toEqual([])
    })

    it('should not open when card is not found', async () => {
      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      await act(async () => {
        await result.current.open('non-existent-card')
      })

      expect(result.current.isOpen).toBe(false)
      expect(mockGetProjectInfo).not.toHaveBeenCalled()
    })
  })

  describe('close()', () => {
    it('should close modal and reset state', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        success: true,
        data: {
          note: 'Existing note',
          comment: '',
          links: [],
        },
      })

      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      // Open first
      await act(async () => {
        await result.current.open('card-1')
      })

      expect(result.current.isOpen).toBe(true)

      // Close
      act(() => {
        result.current.close()
      })

      expect(result.current.isOpen).toBe(false)
      expect(result.current.cardId).toBeNull()
      expect(result.current.cardTitle).toBe('')
      expect(result.current.initialNote).toBe('')
      expect(result.current.initialLinks).toEqual([])
    })
  })

  describe('save()', () => {
    it('should save note and links to server', async () => {
      mockGetProjectInfo.mockResolvedValueOnce({
        success: true,
        data: {
          note: 'Old note',
          comment: '',
          links: [],
        },
      })
      mockUpsertProjectInfo.mockResolvedValueOnce({
        success: true,
        data: undefined,
      })

      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      // Open modal first
      await act(async () => {
        await result.current.open('card-1')
      })

      // Save note with links
      const newLinks = [{ url: 'https://vercel.app', type: 'vercel' }]
      await act(async () => {
        await result.current.save('New note content', newLinks)
      })

      expect(mockUpsertProjectInfo).toHaveBeenCalledWith('card-1', {
        note: 'New note content',
        links: newLinks,
      })
    })

    it('should not save when no card is selected', async () => {
      const { result } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      await act(async () => {
        await result.current.save('Some note', [])
      })

      expect(mockUpsertProjectInfo).not.toHaveBeenCalled()
    })
  })

  describe('Memoization', () => {
    it('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() =>
        useNoteModal({ repoCards: mockRepoCards }),
      )

      const initialOpen = result.current.open
      const initialClose = result.current.close
      const initialSave = result.current.save

      rerender()

      expect(result.current.open).toBe(initialOpen)
      expect(result.current.close).toBe(initialClose)
      expect(result.current.save).toBe(initialSave)
    })
  })
})
