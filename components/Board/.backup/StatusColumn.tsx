/**
 * StatusColumn Component
 *
 * Kanbanボードのステータス列を表示
 * - 列名、色、WIP制限を表示
 * - RepoCardのリストを表示
 * - WIP制限超過時に警告表示
 */

'use client'

import { memo, useState } from 'react'
import { RepoCard } from './RepoCard'
import { OverflowMenu } from './OverflowMenu'
import type { Database } from '@/lib/supabase/types'

type StatusListRow = Database['public']['Tables']['StatusList']['Row']
type RepoCardRow = Database['public']['Tables']['RepoCard']['Row']

export interface StatusColumnProps {
  /** StatusListデータ */
  status: StatusListRow
  /** この列に属するRepoCardのリスト (order順にソート済み) */
  cards: RepoCardRow[]
  /** カード移動ハンドラー (dnd-kit用) */
  onCardMove?: (cardId: string, newStatusId: string, newOrder: number) => void
  /** Project Info編集ハンドラー */
  onEditProjectInfo?: (cardId: string) => void
  /** Maintenance Modeへ移動ハンドラー */
  onMoveToMaintenance?: (cardId: string) => void
  /** カード削除ハンドラー */
  onDeleteCard?: (cardId: string) => void
}

/**
 * StatusColumn
 *
 * Kanbanボードのステータス列
 * - WIP制限がある場合、現在のカード数と制限を表示
 * - WIP制限超過時は警告色で表示
 */
export const StatusColumn = memo<StatusColumnProps>(
  ({
    status,
    cards,
    onCardMove,
    onEditProjectInfo,
    onMoveToMaintenance,
    onDeleteCard,
  }) => {
    const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null)

    const cardCount = cards.length
    const isWipExceeded = status.wip_limit
      ? cardCount > status.wip_limit
      : false

    const handleMenuClick = (cardId: string) => {
      setOpenMenuCardId(cardId)
    }

    const handleCloseMenu = () => {
      setOpenMenuCardId(null)
    }

    const handleEditProjectInfo = () => {
      if (openMenuCardId && onEditProjectInfo) {
        onEditProjectInfo(openMenuCardId)
      }
    }

    const handleMoveToMaintenance = () => {
      if (openMenuCardId && onMoveToMaintenance) {
        onMoveToMaintenance(openMenuCardId)
      }
    }

    const handleDeleteCard = () => {
      if (openMenuCardId && onDeleteCard) {
        onDeleteCard(openMenuCardId)
      }
    }

    return (
      <div className="flex min-h-[500px] w-80 flex-col rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
        {/* Column Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Color Indicator */}
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: status.color }}
                aria-label={`${status.name} color`}
              />

              {/* Column Name */}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {status.name}
              </h2>
            </div>

            {/* Card Count / WIP Limit */}
            {status.wip_limit ? (
              <span
                className={`text-sm font-medium ${
                  isWipExceeded
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {cardCount}/{status.wip_limit}
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {cardCount}
              </span>
            )}
          </div>

          {/* WIP Limit Warning */}
          {isWipExceeded && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>WIP limit exceeded</span>
            </div>
          )}
        </div>

        {/* Cards List */}
        <div
          className="flex-1 space-y-3 overflow-y-auto"
          data-status-id={status.id}
        >
          {cards.map((card) => (
            <div key={card.id} className="relative">
              <RepoCard card={card} onMenuClick={handleMenuClick} />

              {/* Overflow Menu */}
              {openMenuCardId === card.id && (
                <OverflowMenu
                  isOpen={true}
                  onClose={handleCloseMenu}
                  onEditProjectInfo={handleEditProjectInfo}
                  onMoveToMaintenance={handleMoveToMaintenance}
                  onDelete={handleDeleteCard}
                />
              )}
            </div>
          ))}

          {/* Empty State */}
          {cards.length === 0 && (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No cards
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }
)

StatusColumn.displayName = 'StatusColumn'
