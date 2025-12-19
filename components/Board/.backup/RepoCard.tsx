/**
 * RepoCard Component
 *
 * Card component displaying GitHub repositories
 * Draggable on Kanban board
 */

'use client'

import { memo } from 'react'
import type { Database } from '@/lib/supabase/types'

type RepoCardRow = Database['public']['Tables']['RepoCard']['Row']

export interface RepoCardProps {
  /** Repository card data */
  card: RepoCardRow
  /** Overflow menu open handler */
  onMenuClick?: (cardId: string) => void
  /** Drag start handler (for dnd-kit) */
  onDragStart?: () => void
  /** Drag end handler (for dnd-kit) */
  onDragEnd?: () => void
}

/**
 * RepoCard
 *
 * Card component displaying repository information
 * - Shows owner/name
 * - Displays Quick note (max 300 characters)
 * - Shows metadata (stars, language, topics)
 * - OverflowMenu trigger (. key or click)
 */
export const RepoCard = memo<RepoCardProps>(
  ({ card, onMenuClick, onDragStart, onDragEnd }) => {
    const meta = card.meta as {
      stars?: number
      language?: string
      topics?: string[]
      updatedAt?: string
    } | null

    const handleMenuClick = () => {
      if (onMenuClick) {
        onMenuClick(card.id)
      }
    }

    return (
      <div
        className="repo-card group relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
        data-card-id={card.id}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Repository Owner/Name */}
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {card.repo_owner}/{card.repo_name}
          </h3>

          {/* Overflow Menu Trigger */}
          <button
            type="button"
            onClick={handleMenuClick}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            aria-label="Open menu"
          >
            <svg
              className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
        </div>

        {/* Quick Note */}
        {card.note && (
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
            {card.note}
          </p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {/* Stars */}
          {meta?.stars !== undefined && (
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{meta.stars}</span>
            </div>
          )}

          {/* Language */}
          {meta?.language && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
              {meta.language}
            </span>
          )}

          {/* Topics (最大3つ表示) */}
          {meta?.topics && meta.topics.length > 0 && (
            <div className="flex gap-1">
              {meta.topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {topic}
                </span>
              ))}
              {meta.topics.length > 3 && (
                <span className="text-gray-400">+{meta.topics.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  },
)

RepoCard.displayName = 'RepoCard'
