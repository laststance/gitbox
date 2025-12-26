/**
 * Board Card Component
 *
 * A card displaying board information with a dropdown menu
 * for rename and delete actions.
 */

'use client'

import { Calendar, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { memo, useCallback, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toggleBoardFavorite } from '@/lib/actions/board'
import type { Tables } from '@/lib/supabase/types'

import { DeleteBoardDialog } from './DeleteBoardDialog'
import { RenameBoardDialog } from './RenameBoardDialog'

type Board = Tables<'board'>

interface BoardCardProps {
  /** Board data */
  board: Board
  /** Callback when board is renamed (for optimistic update) */
  onRename: (boardId: string, newName: string) => void
  /** Callback when board is deleted (for optimistic update) */
  onDelete: (boardId: string) => void
  /** Callback when board favorite is toggled (for optimistic update) */
  onToggleFavorite?: (boardId: string, isFavorite: boolean) => void
}

/**
 * Board Card with actions menu
 *
 * Displays a clickable card for navigating to a board, with a dropdown menu
 * for rename and delete actions. The menu trigger is hidden on desktop until
 * hover, but always visible (with reduced opacity) on touch devices.
 *
 * @example
 * <BoardCard
 *   board={board}
 *   onRename={(id, name) => updateBoard(id, name)}
 *   onDelete={(id) => removeBoard(id)}
 * />
 */
export const BoardCard = memo(function BoardCard({
  board,
  onRename,
  onDelete,
  onToggleFavorite,
}: BoardCardProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleRenameSuccess = useCallback(
    (newName: string) => {
      onRename(board.id, newName)
    },
    [board.id, onRename],
  )

  const handleDeleteSuccess = useCallback(() => {
    onDelete(board.id)
  }, [board.id, onDelete])

  const handleOpenRename = useCallback(() => {
    setIsRenameOpen(true)
  }, [])

  const handleOpenDelete = useCallback(() => {
    setIsDeleteOpen(true)
  }, [])

  const handleCloseRename = useCallback(() => {
    setIsRenameOpen(false)
  }, [])

  const handleCloseDelete = useCallback(() => {
    setIsDeleteOpen(false)
  }, [])

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const newFavoriteStatus = !board.is_favorite
      // Optimistic update
      onToggleFavorite?.(board.id, newFavoriteStatus)

      startTransition(async () => {
        const result = await toggleBoardFavorite(board.id)
        // If failed, revert optimistic update
        if (!result.success) {
          onToggleFavorite?.(board.id, board.is_favorite)
          console.error('Failed to toggle favorite:', result.error)
        }
      })
    },
    [board.id, board.is_favorite, onToggleFavorite],
  )

  return (
    <>
      <div className="group relative block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600">
        {/* Board link - covers the card but not the menu */}
        <Link
          href={`/board/${board.id}`}
          className="absolute inset-0 z-0"
          aria-label={`Open board ${board.name}`}
        />

        {/* Top-right actions: Favorite star + Menu */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {/* Favorite star button */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 transition-all ${
              board.is_favorite
                ? 'text-amber-500 hover:text-amber-600 opacity-100'
                : 'text-gray-400 hover:text-amber-500 opacity-70 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100'
            }`}
            aria-label={
              board.is_favorite
                ? `Remove ${board.name} from favorites`
                : `Add ${board.name} to favorites`
            }
            onClick={handleToggleFavorite}
            disabled={isPending}
          >
            <Star
              className={`h-4 w-4 transition-transform ${isPending ? 'animate-pulse' : ''} ${
                board.is_favorite ? 'fill-current' : ''
              }`}
            />
          </Button>

          {/* Menu trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-70 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label={`Open menu for ${board.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenRename}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleOpenDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card content */}
        <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors pr-16">
          {board.name}
        </h3>

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {board.created_at
              ? new Date(board.created_at).toLocaleDateString('en-US')
              : 'N/A'}
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: getThemeColor(board.theme),
              }}
              aria-hidden="true"
            />
            {board.theme}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <RenameBoardDialog
        isOpen={isRenameOpen}
        onClose={handleCloseRename}
        onRenameSuccess={handleRenameSuccess}
        boardId={board.id}
        currentName={board.name}
      />

      <DeleteBoardDialog
        isOpen={isDeleteOpen}
        onClose={handleCloseDelete}
        onDeleteSuccess={handleDeleteSuccess}
        boardId={board.id}
        boardName={board.name}
      />
    </>
  )
})

export default BoardCard

// ========================================
// Helper Functions
// ========================================

/**
 * Get the display color for a theme.
 *
 * @param theme - Theme name
 * @returns Hex color code for the theme
 */
function getThemeColor(theme: string | null): string {
  switch (theme) {
    case 'sunrise':
      return '#f59e0b'
    case 'midnight':
      return '#1e40af'
    case 'sandstone':
      return '#a8a29e'
    case 'graphite':
      return '#374151'
    case 'mint':
      return '#10b981'
    case 'forest':
      return '#065f46'
    case 'sky':
      return '#0ea5e9'
    case 'ocean':
      return '#0369a1'
    case 'lavender':
      return '#8b5cf6'
    case 'plum':
      return '#7c3aed'
    case 'rose':
      return '#f43f5e'
    case 'rust':
      return '#b91c1c'
    default:
      return '#6b7280'
  }
}
