/**
 * KanbanBoard Component
 *
 * Display entire Kanban board
 * - Shows StatusLists in horizontally scrollable layout
 * - Displays RepoCards in each column
 * - Card movement via drag & drop (to be integrated with dnd-kit)
 */

'use client'

import { memo, useEffect, useState } from 'react'
import { StatusColumn } from './StatusColumn'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type StatusListRow = Database['public']['Tables']['StatusList']['Row']
type RepoCardRow = Database['public']['Tables']['RepoCard']['Row']

export interface KanbanBoardProps {
  /** Board ID */
  boardId: string
  /** Project Info edit modal open handler */
  onEditProjectInfo?: (cardId: string) => void
  /** Move to Maintenance Mode handler */
  onMoveToMaintenance?: (cardId: string) => void
}

/**
 * KanbanBoard
 *
 * Manage entire Kanban board
 * - Fetch StatusList and RepoCard from Supabase
 * - Display multiple columns in horizontally scrollable layout
 * - Handle operations like card movement and deletion
 */
export const KanbanBoard = memo<KanbanBoardProps>(
  ({ boardId, onEditProjectInfo, onMoveToMaintenance }) => {
    const [statusLists, setStatusLists] = useState<StatusListRow[]>([])
    const [repoCards, setRepoCards] = useState<RepoCardRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const supabase = createBrowserClient()

    // Fetch data
    useEffect(() => {
      const fetchBoardData = async () => {
        try {
          setIsLoading(true)
          setError(null)

          // Fetch StatusList (ordered by order)
          const { data: statusData, error: statusError } = await supabase
            .from('StatusList')
            .select('*')
            .eq('board_id', boardId)
            .order('order', { ascending: true })

          if (statusError) {
            throw statusError
          }

          // Fetch RepoCard (ordered by status_id, order)
          const { data: cardsData, error: cardsError } = await supabase
            .from('RepoCard')
            .select('*')
            .eq('board_id', boardId)
            .order('status_id')
            .order('order', { ascending: true })

          if (cardsError) {
            throw cardsError
          }

          setStatusLists(statusData || [])
          setRepoCards(cardsData || [])
        } catch (err) {
          console.error('Error fetching board data:', err)
          setError(
            err instanceof Error ? err.message : 'Failed to load board data',
          )
        } finally {
          setIsLoading(false)
        }
      }

      fetchBoardData()
    }, [boardId, supabase])

    // Card delete handler
    const handleDeleteCard = async (cardId: string) => {
      try {
        const { error: deleteError } = await supabase
          .from('RepoCard')
          .delete()
          .eq('id', cardId)

        if (deleteError) {
          throw deleteError
        }

        // Update local state
        setRepoCards((prev) => prev.filter((card) => card.id !== cardId))
      } catch (err) {
        console.error('Error deleting card:', err)
        alert(
          `Failed to delete card: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
        )
      }
    }

    // Loading state
    if (isLoading) {
      return (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <p className="text-gray-600 dark:text-gray-400">Loading board...</p>
          </div>
        </div>
      )
    }

    // Error state
    if (error) {
      return (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Failed to load board
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {error}
            </p>
          </div>
        </div>
      )
    }

    // Empty board state
    if (statusLists.length === 0) {
      return (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No status columns
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Create status columns to start organizing your repositories
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full overflow-x-auto">
        <div className="flex gap-6 p-6">
          {statusLists.map((status) => {
            // Filter cards belonging to this column
            const columnCards = repoCards.filter(
              (card) => card.status_id === status.id,
            )

            return (
              <StatusColumn
                key={status.id}
                status={status}
                cards={columnCards}
                onEditProjectInfo={onEditProjectInfo}
                onMoveToMaintenance={onMoveToMaintenance}
                onDeleteCard={handleDeleteCard}
              />
            )
          })}
        </div>
      </div>
    )
  },
)

KanbanBoard.displayName = 'KanbanBoard'
