/**
 * Board Card Component
 *
 * A card displaying board information with a dropdown menu
 * for rename and delete actions.
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import {
  Calendar,
  Globe,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { memo, useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'

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
  // Local state for immediate optimistic visual feedback
  // Initialized from board prop, no sync needed since we removed revalidatePath
  const [localIsFavorite, setLocalIsFavorite] = useState(board.is_favorite)

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

      const newFavoriteStatus = !localIsFavorite

      // Immediate local optimistic update for visual feedback
      setLocalIsFavorite(newFavoriteStatus)
      // Also notify parent for global state sync
      onToggleFavorite?.(board.id, newFavoriteStatus)

      startTransition(async () => {
        const result = await toggleBoardFavorite(board.id)
        // If failed, revert optimistic update
        if (!result.success) {
          setLocalIsFavorite(!newFavoriteStatus)
          onToggleFavorite?.(board.id, !newFavoriteStatus)
          Sentry.captureMessage('Failed to toggle favorite', {
            level: 'error',
            tags: { action: 'toggleFavorite', boardId: board.id },
            extra: { error: result.error },
          })
          toast.error('Failed to update favorite', {
            description: result.error,
          })
        } else {
          toast.success(
            newFavoriteStatus ? 'Added to favorites' : 'Removed from favorites',
            {
              description: `"${board.name}" has been ${newFavoriteStatus ? 'added to' : 'removed from'} favorites.`,
            },
          )
        }
      })
    },
    [board.id, localIsFavorite, board.name, onToggleFavorite],
  )

  return (
    <>
      <div
        data-testid={`board-card-${board.id}`}
        className="group border-border bg-card hover:border-primary relative block rounded-lg border p-6 shadow-sm transition-all hover:shadow-md"
      >
        {/* Board link - covers the card but not the menu */}
        <Link
          href={`/board/${board.id}`}
          className="absolute inset-0 z-0"
          aria-label={`Open board ${board.name}`}
        />

        {/* Top-right actions: Favorite star + Menu */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {/* Favorite star button */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 transition-all ${
              localIsFavorite
                ? 'text-amber-500 opacity-100 hover:text-amber-600'
                : 'text-muted-foreground opacity-70 hover:text-amber-500 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100'
            }`}
            aria-label={
              localIsFavorite
                ? `Remove ${board.name} from favorites`
                : `Add ${board.name} to favorites`
            }
            onClick={handleToggleFavorite}
            disabled={isPending}
          >
            <Star
              className={`h-4 w-4 transition-transform ${isPending ? 'animate-pulse' : ''} ${
                localIsFavorite ? 'fill-current' : ''
              }`}
            />
          </Button>

          {/* Menu trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-70 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
        <h3 className="text-foreground group-hover:text-primary flex items-center gap-2 pr-16 text-xl font-semibold transition-colors">
          {board.name}
          {board.is_public && (
            <Globe
              className="text-muted-foreground h-4 w-4 shrink-0"
              aria-label="Public board"
            />
          )}
        </h3>

        <div className="text-muted-foreground mt-4 flex items-center text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {board.created_at
              ? new Date(board.created_at).toLocaleDateString('en-US')
              : 'N/A'}
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
