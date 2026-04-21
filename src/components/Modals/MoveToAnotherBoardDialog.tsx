/**
 * Move to Another Board Dialog
 *
 * A dialog for selecting a target board and status column when moving
 * a repository card from the current board to a different one.
 * ProjectInfo (notes, links, comments) is preserved since the card ID doesn't change.
 *
 * Features:
 * - Lazy-fetches boards on dialog open (avoids unnecessary API calls)
 * - Filters out current board from selection
 * - Status (column) selection updates based on selected board
 * - Color indicators for status columns
 * - Loading states and error handling
 */

'use client'

import { ArrowRightLeft, Loader2, LayoutGrid, Columns3 } from 'lucide-react'
import { useState, useCallback, useEffect, memo, useMemo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  moveCardToBoard,
  getUserBoardsWithStatusLists,
} from '@/lib/actions/repo-cards'
import type { RepoCardId } from '@/lib/types/brands'

import type { BoardOption } from './RestoreToBoardDialog'

interface MoveToAnotherBoardDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** RepoCard ID to move */
  cardId: RepoCardId
  /** Repository display name (owner/name) */
  repoName: string
  /** Current board ID (excluded from target list) */
  currentBoardId: string
  /** Callback after successful move */
  onMoved: (cardId: RepoCardId) => void
}

/**
 * Dialog for moving a repo card to another board
 *
 * @param isOpen - Controls dialog visibility
 * @param onClose - Called when dialog closes
 * @param cardId - ID of the card to move
 * @param repoName - Display name of the repository
 * @param currentBoardId - Current board ID (filtered from list)
 * @param onMoved - Called after successful move with the card ID
 *
 * @example
 * <MoveToAnotherBoardDialog
 *   isOpen={!!moveDialogCardId}
 *   onClose={() => setMoveDialogCardId(null)}
 *   cardId="card-uuid-123"
 *   repoName="owner/repo-name"
 *   currentBoardId="board-uuid-456"
 *   onMoved={(id) => dispatch(removeRepoCard(id))}
 * />
 */
export const MoveToAnotherBoardDialog = memo(function MoveToAnotherBoardDialog({
  isOpen,
  onClose,
  cardId,
  repoName,
  currentBoardId,
  onMoved,
}: MoveToAnotherBoardDialogProps) {
  const [boards, setBoards] = useState<BoardOption[]>([])
  const [isLoadingBoards, setIsLoadingBoards] = useState(false)
  const [boardsError, setBoardsError] = useState<string | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [isMoving, setIsMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter out current board
  const availableBoards = useMemo(
    () => boards.filter((b) => b.id !== currentBoardId),
    [boards, currentBoardId],
  )

  // Lazy-fetch boards when dialog opens
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const fetchBoards = async () => {
      setIsLoadingBoards(true)
      setBoardsError(null)

      try {
        const result = await getUserBoardsWithStatusLists()

        if (cancelled) return

        if (result.success && result.data) {
          setBoards(result.data)
        } else if (!result.success) {
          setBoardsError(result.error || 'Failed to load boards')
        }
      } catch {
        if (!cancelled) {
          setBoardsError('Failed to load boards')
        }
      }
      if (!cancelled) {
        setIsLoadingBoards(false)
      }
    }

    fetchBoards()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  // Get effective board selection (default to first available)
  const effectiveBoardId = useMemo(() => {
    if (
      selectedBoardId &&
      availableBoards.some((b) => b.id === selectedBoardId)
    ) {
      return selectedBoardId
    }
    return availableBoards[0]?.id ?? ''
  }, [selectedBoardId, availableBoards])

  // Get status lists for selected board
  const statusLists = useMemo(() => {
    const selectedBoard = availableBoards.find((b) => b.id === effectiveBoardId)
    return selectedBoard?.statusLists || []
  }, [availableBoards, effectiveBoardId])

  // Get effective status selection (default to first)
  const effectiveStatusId = useMemo(() => {
    if (
      selectedStatusId &&
      statusLists.some((s) => s.id === selectedStatusId)
    ) {
      return selectedStatusId
    }
    return statusLists[0]?.id ?? ''
  }, [selectedStatusId, statusLists])

  // Handle board selection change
  const handleBoardChange = useCallback((boardId: string) => {
    setSelectedBoardId(boardId)
    setSelectedStatusId('')
  }, [])

  // Handle move action
  const handleMove = useCallback(async () => {
    if (!effectiveBoardId || !effectiveStatusId) {
      setError('Please select a board and column')
      return
    }

    setIsMoving(true)
    setError(null)

    try {
      const result = await moveCardToBoard(
        cardId,
        effectiveBoardId,
        effectiveStatusId,
      )

      if (result.success) {
        const selectedBoard = availableBoards.find(
          (b) => b.id === effectiveBoardId,
        )
        toast.success('Card moved', {
          description: `"${repoName}" has been moved to ${selectedBoard?.name ?? 'board'}.`,
        })
        setSelectedBoardId('')
        setSelectedStatusId('')
        onMoved(cardId)
        onClose()
      } else {
        setError(result.error || 'Failed to move card')
      }
    } catch {
      setError('Failed to move card')
    } finally {
      setIsMoving(false)
    }
  }, [
    cardId,
    effectiveBoardId,
    effectiveStatusId,
    onMoved,
    onClose,
    availableBoards,
    repoName,
  ])

  // Handle dialog close
  const handleClose = useCallback(() => {
    setSelectedBoardId('')
    setSelectedStatusId('')
    setError(null)
    onClose()
  }, [onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-md"
        accessibleTitle="Move to Another Board"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-primary h-5 w-5" />
            Move to Another Board
          </DialogTitle>
          <DialogDescription>
            Move <span className="text-foreground font-medium">{repoName}</span>{' '}
            to a different board. Notes, links, and comments will be preserved.
          </DialogDescription>
        </DialogHeader>

        {isLoadingBoards ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <span className="text-muted-foreground ml-2 text-sm">
              Loading boards...
            </span>
          </div>
        ) : boardsError ? (
          <div className="py-8 text-center">
            <p className="text-destructive text-sm">{boardsError}</p>
          </div>
        ) : availableBoards.length === 0 ? (
          <div className="py-8 text-center">
            <LayoutGrid className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-4 text-sm">
              No other boards available. Create another board first.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Board Selection */}
            <div className="space-y-2">
              <Label htmlFor="board-select" className="flex items-center gap-2">
                <LayoutGrid className="text-muted-foreground h-4 w-4" />
                Board
              </Label>
              <Select
                value={effectiveBoardId}
                onValueChange={handleBoardChange}
              >
                <SelectTrigger id="board-select" className="w-full">
                  <SelectValue placeholder="Select a board" />
                </SelectTrigger>
                <SelectContent>
                  {availableBoards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status (Column) Selection */}
            <div className="space-y-2">
              <Label
                htmlFor="status-select"
                className="flex items-center gap-2"
              >
                <Columns3 className="text-muted-foreground h-4 w-4" />
                Column
              </Label>
              <Select
                value={effectiveStatusId}
                onValueChange={setSelectedStatusId}
                disabled={statusLists.length === 0}
              >
                <SelectTrigger id="status-select" className="w-full">
                  <SelectValue
                    placeholder={
                      statusLists.length === 0
                        ? 'No columns available'
                        : 'Select a column'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {statusLists.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                          aria-hidden="true"
                        />
                        {status.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusLists.length === 0 && effectiveBoardId && (
                <p className="text-muted-foreground text-xs">
                  This board has no columns. Add columns to the board first.
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleMove}
            disabled={
              isLoadingBoards ||
              isMoving ||
              !effectiveBoardId ||
              !effectiveStatusId ||
              availableBoards.length === 0 ||
              !!boardsError
            }
          >
            {isMoving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving...
              </>
            ) : (
              'Move'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
