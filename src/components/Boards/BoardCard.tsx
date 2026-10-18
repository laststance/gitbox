/**
 * Board Card Component
 *
 * A card displaying board information with a dropdown menu
 * for rename and delete actions.
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { Calendar, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { memo, useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { LocalDate } from '@/components/LocalDate'
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

        {/* Top-right actions: Favorite star + Menu.
            Hidden until hover only where there is a mouse (pointer-fine):
            a touch screen never hovers, so there they stay visible. */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {/* Favorite star button. The outline (`text-favorite`) is what
              has to stand out from the card: 3:1 or more on every theme.
              `hover:text-favorite` keeps the ghost Button from painting
              accent-foreground. Checked in board-card-star-contrast.test.ts. */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 transition-all ${
              localIsFavorite
                ? 'text-favorite hover:text-favorite opacity-100'
                : 'text-muted-foreground hover:text-favorite focus-visible:opacity-100 md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100'
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
                localIsFavorite ? 'fill-favorite' : ''
              }`}
            />
          </Button>

          {/* Menu trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-70 transition-opacity focus-visible:opacity-100 md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100"
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
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card content. pr-16 keeps the name clear of the buttons above: a
            name of several words breaks between them. One word that is
            wider than that room stays whole and runs on under the buttons,
            as it always did (eleven letters in a card of 216px). The inner
            box of the name may reach as far as the card's own padding
            (max-w is the room plus the 4rem of pr-16), and only a word that
            is wider than that breaks (min-w-0 and wrap-break-word). Without
            the limit a name of one long word ran out of the card, across
            the next one. */}
        <h2 className="text-foreground group-hover:text-primary flex pr-16 text-xl font-semibold transition-colors">
          <span className="flex max-w-[calc(100%+4rem)] items-center gap-2">
            <span className="min-w-0 wrap-break-word">{board.name}</span>
          </span>
        </h2>

        <div className="text-muted-foreground mt-4 flex items-center text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {board.created_at ? (
              <LocalDate isoDate={board.created_at} dateStyle="numeric" />
            ) : (
              'N/A'
            )}
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
