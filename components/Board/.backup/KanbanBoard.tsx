/**
 * KanbanBoard Component
 *
 * Kanbanボード全体を表示
 * - StatusListを横スクロール可能なレイアウトで表示
 * - 各列にRepoCardを表示
 * - ドラッグ&ドロップでカード移動 (後でdnd-kitと統合)
 */

'use client'

import { memo, useEffect, useState } from 'react'
import { StatusColumn } from './StatusColumn'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type StatusListRow = Database['public']['Tables']['StatusList']['Row']
type RepoCardRow = Database['public']['Tables']['RepoCard']['Row']

export interface KanbanBoardProps {
  /** ボードID */
  boardId: string
  /** Project Info編集モーダルを開くハンドラー */
  onEditProjectInfo?: (cardId: string) => void
  /** Maintenance Modeへ移動ハンドラー */
  onMoveToMaintenance?: (cardId: string) => void
}

/**
 * KanbanBoard
 *
 * Kanbanボード全体を管理
 * - StatusListとRepoCardをSupabaseからフェッチ
 * - 横スクロール可能なレイアウトで複数の列を表示
 * - カード移動、削除などの操作を処理
 */
export const KanbanBoard = memo<KanbanBoardProps>(
  ({ boardId, onEditProjectInfo, onMoveToMaintenance }) => {
    const [statusLists, setStatusLists] = useState<StatusListRow[]>([])
    const [repoCards, setRepoCards] = useState<RepoCardRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const supabase = createBrowserClient()

    // データフェッチ
    useEffect(() => {
      const fetchBoardData = async () => {
        try {
          setIsLoading(true)
          setError(null)

          // StatusListをフェッチ (order順)
          const { data: statusData, error: statusError } = await supabase
            .from('StatusList')
            .select('*')
            .eq('board_id', boardId)
            .order('order', { ascending: true })

          if (statusError) {
            throw statusError
          }

          // RepoCardをフェッチ (status_id, order順)
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
            err instanceof Error ? err.message : 'Failed to load board data'
          )
        } finally {
          setIsLoading(false)
        }
      }

      fetchBoardData()
    }, [boardId, supabase])

    // カード削除ハンドラー
    const handleDeleteCard = async (cardId: string) => {
      try {
        const { error: deleteError } = await supabase
          .from('RepoCard')
          .delete()
          .eq('id', cardId)

        if (deleteError) {
          throw deleteError
        }

        // ローカル状態を更新
        setRepoCards((prev) => prev.filter((card) => card.id !== cardId))
      } catch (err) {
        console.error('Error deleting card:', err)
        alert(
          `Failed to delete card: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        )
      }
    }

    // ローディング状態
    if (isLoading) {
      return (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading board...
            </p>
          </div>
        </div>
      )
    }

    // エラー状態
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

    // 空のボード状態
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
            // この列に属するカードをフィルター
            const columnCards = repoCards.filter(
              (card) => card.status_id === status.id
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
  }
)

KanbanBoard.displayName = 'KanbanBoard'
