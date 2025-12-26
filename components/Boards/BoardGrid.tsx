/**
 * Board Grid Component
 *
 * A grid of board cards with optimistic UI updates for rename/delete operations.
 * Uses useOptimistic for instant feedback.
 */

'use client'

import Link from 'next/link'
import { memo, useCallback, useOptimistic } from 'react'

import type { Tables } from '@/lib/supabase/types'

import { BoardCard } from './BoardCard'

type Board = Tables<'board'>

/**
 * Action types for optimistic updates
 */
type OptimisticAction =
  | { type: 'rename'; boardId: string; newName: string }
  | { type: 'delete'; boardId: string }
  | { type: 'toggleFavorite'; boardId: string; isFavorite: boolean }

interface BoardGridProps {
  /** Initial boards data from server */
  initialBoards: Board[]
}

/**
 * Board Grid with optimistic updates
 *
 * Displays a grid of board cards and handles optimistic UI updates
 * for rename and delete operations. Uses useOptimistic to provide
 * instant feedback while server actions are in progress.
 *
 * @example
 * // In Server Component
 * const boards = await fetchBoards()
 * <BoardGrid initialBoards={boards} />
 */
export const BoardGrid = memo(function BoardGrid({
  initialBoards,
}: BoardGridProps) {
  const [optimisticBoards, updateOptimisticBoards] = useOptimistic(
    initialBoards,
    (state: Board[], action: OptimisticAction): Board[] => {
      switch (action.type) {
        case 'rename':
          return state.map((board) =>
            board.id === action.boardId
              ? { ...board, name: action.newName }
              : board,
          )
        case 'delete':
          return state.filter((board) => board.id !== action.boardId)
        case 'toggleFavorite':
          return state.map((board) =>
            board.id === action.boardId
              ? { ...board, is_favorite: action.isFavorite }
              : board,
          )
        default:
          return state
      }
    },
  )

  const handleRename = useCallback(
    (boardId: string, newName: string) => {
      updateOptimisticBoards({ type: 'rename', boardId, newName })
    },
    [updateOptimisticBoards],
  )

  const handleDelete = useCallback(
    (boardId: string) => {
      updateOptimisticBoards({ type: 'delete', boardId })
    },
    [updateOptimisticBoards],
  )

  const handleToggleFavorite = useCallback(
    (boardId: string, isFavorite: boolean) => {
      updateOptimisticBoards({ type: 'toggleFavorite', boardId, isFavorite })
    },
    [updateOptimisticBoards],
  )

  if (optimisticBoards.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {optimisticBoards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          onRename={handleRename}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
        />
      ))}
    </div>
  )
})

export default BoardGrid

// ========================================
// Empty State Component
// ========================================

/**
 * Empty state displayed when there are no boards.
 */
const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 dark:border-gray-700 dark:bg-gray-800">
      <svg
        className="h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
        No boards yet
      </h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Get started by creating your first board
      </p>
      <Link
        href="/boards/new"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create Board
      </Link>
    </div>
  )
})
