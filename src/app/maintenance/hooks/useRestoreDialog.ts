/**
 * Restore Dialog Hook for Maintenance Page
 *
 * Manages restore dialog state, board loading, and restore completion.
 *
 * @example
 * const { restoreDialogOpen, handleRestore, handleRestored, boards } =
 *   useRestoreDialog({ onReposChange, router })
 */

import { useState, useCallback, useRef, useTransition } from 'react'

import type { BoardOption } from '@/components/Modals/RestoreToBoardDialog'
import { getUserBoardsWithStatusLists } from '@/lib/actions/repo-cards'

import type { MaintenanceRepo } from '../MaintenanceClient'

interface UseRestoreDialogProps {
  /** Callback to update repos state after restore */
  onReposChange: (
    updater: (prev: MaintenanceRepo[]) => MaintenanceRepo[],
  ) => void
  /** Next.js router for refresh */
  router: { refresh: () => void }
}

/**
 * Hook for managing the restore-to-board dialog
 *
 * @param props.onReposChange - Callback to update local repos state
 * @param props.router - Next.js router for page refresh
 * @returns Dialog state, handlers, and board data
 */
export function useRestoreDialog({
  onReposChange,
  router,
}: UseRestoreDialogProps) {
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<MaintenanceRepo | null>(null)
  const [boards, setBoards] = useState<BoardOption[]>([])
  const [boardsError, setBoardsError] = useState<string | null>(null)
  const hasFetchedBoards = useRef(false)
  const [isLoadingBoards, startLoadingBoards] = useTransition()

  /**
   * Fetch boards for restore dialog (event-driven, only once per session)
   */
  const fetchBoardsOnce = useCallback(() => {
    if (hasFetchedBoards.current) return
    hasFetchedBoards.current = true
    startLoadingBoards(async () => {
      const result = await getUserBoardsWithStatusLists()
      if (result.success && result.boards) {
        setBoards(result.boards)
        setBoardsError(null)
      } else {
        setBoardsError(result.error || 'Failed to load boards')
      }
    })
  }, [])

  /**
   * Open restore dialog for a specific maintenance item
   */
  const handleRestore = useCallback(
    (repo: MaintenanceRepo) => {
      setSelectedRepo(repo)
      setRestoreDialogOpen(true)
      fetchBoardsOnce()
    },
    [fetchBoardsOnce],
  )

  /**
   * Handle successful restore by removing item from local state
   */
  const handleRestored = useCallback(() => {
    if (selectedRepo) {
      onReposChange((prev) => prev.filter((r) => r.id !== selectedRepo.id))
      setSelectedRepo(null)
    }
    router.refresh()
  }, [selectedRepo, router, onReposChange])

  /**
   * Close the restore dialog
   */
  const closeRestoreDialog = useCallback(() => {
    setRestoreDialogOpen(false)
    setSelectedRepo(null)
  }, [])

  return {
    restoreDialogOpen,
    selectedRepo,
    boards,
    boardsError,
    isLoadingBoards,
    handleRestore,
    handleRestored,
    closeRestoreDialog,
  }
}
