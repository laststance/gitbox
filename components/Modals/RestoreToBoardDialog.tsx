/**
 * Restore to Board Dialog
 *
 * A dialog for selecting a target board and status column when restoring
 * a repository from maintenance mode back to an active board.
 *
 * Features:
 * - Board selection dropdown with all user's boards
 * - Status (column) selection that updates based on selected board
 * - Color indicators for status columns
 * - Loading states and error handling
 */

'use client'

import { Loader2, LayoutGrid, Columns3 } from 'lucide-react'
import { useState, useCallback, memo, useMemo } from 'react'

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
import { restoreToBoard } from '@/lib/actions/repo-cards'

/** Board with its status lists for selection */
export interface BoardOption {
  id: string
  name: string
  statusLists: Array<{
    id: string
    name: string
    color: string
  }>
}

interface RestoreToBoardDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** Maintenance item ID to restore */
  maintenanceId: string
  /** Repository display name (owner/name) */
  repoName: string
  /** Callback after successful restore */
  onRestored: () => void
  /** Available boards with their status lists (pre-fetched by parent) */
  boards: BoardOption[]
  /** Whether boards are being loaded */
  isLoadingBoards: boolean
  /** Error from loading boards */
  boardsError: string | null
}

/**
 * Dialog for restoring a maintenance item to a board
 *
 * @param isOpen - Controls dialog visibility
 * @param onClose - Called when dialog closes
 * @param maintenanceId - ID of the maintenance item to restore
 * @param repoName - Display name of the repository
 * @param onRestored - Called after successful restore
 * @param boards - Available boards (pre-fetched by parent)
 * @param isLoadingBoards - Loading state for boards
 * @param boardsError - Error state for boards
 *
 * @example
 * <RestoreToBoardDialog
 *   isOpen={dialogOpen}
 *   onClose={() => setDialogOpen(false)}
 *   maintenanceId="uuid-123"
 *   repoName="owner/repo-name"
 *   onRestored={() => refreshList()}
 *   boards={boards}
 *   isLoadingBoards={false}
 *   boardsError={null}
 * />
 */
export const RestoreToBoardDialog = memo(function RestoreToBoardDialog({
  isOpen,
  onClose,
  maintenanceId,
  repoName,
  onRestored,
  boards,
  isLoadingBoards,
  boardsError,
}: RestoreToBoardDialogProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get effective board and status selection (default to first if not selected)
  const effectiveBoardId = useMemo(() => {
    if (selectedBoardId && boards.some((b) => b.id === selectedBoardId)) {
      return selectedBoardId
    }
    return boards.length > 0 ? boards[0].id : ''
  }, [selectedBoardId, boards])

  // Get status lists for selected board (memoized to avoid deps changing on every render)
  const statusLists = useMemo(() => {
    const selectedBoard = boards.find((b) => b.id === effectiveBoardId)
    return selectedBoard?.statusLists || []
  }, [boards, effectiveBoardId])

  // Get effective status selection (default to first if not selected)
  const effectiveStatusId = useMemo(() => {
    if (
      selectedStatusId &&
      statusLists.some((s) => s.id === selectedStatusId)
    ) {
      return selectedStatusId
    }
    return statusLists.length > 0 ? statusLists[0].id : ''
  }, [selectedStatusId, statusLists])

  // Handle board selection change
  const handleBoardChange = useCallback((boardId: string) => {
    setSelectedBoardId(boardId)
    // Reset status selection when board changes
    setSelectedStatusId('')
  }, [])

  // Handle restore action
  const handleRestore = useCallback(async () => {
    if (!effectiveBoardId || !effectiveStatusId) {
      setError('Please select a board and column')
      return
    }

    setIsRestoring(true)
    setError(null)

    const result = await restoreToBoard(
      maintenanceId,
      effectiveBoardId,
      effectiveStatusId,
    )

    if (result.success) {
      // Reset selection state
      setSelectedBoardId('')
      setSelectedStatusId('')
      onRestored()
      onClose()
    } else {
      setError(result.error || 'Failed to restore')
    }

    setIsRestoring(false)
  }, [maintenanceId, effectiveBoardId, effectiveStatusId, onRestored, onClose])

  // Handle dialog close
  const handleClose = useCallback(() => {
    setSelectedBoardId('')
    setSelectedStatusId('')
    setError(null)
    onClose()
  }, [onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" accessibleTitle="Restore to Board">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Restore to Board
          </DialogTitle>
          <DialogDescription>
            Restore{' '}
            <span className="font-medium text-foreground">{repoName}</span> from
            maintenance back to an active board.
          </DialogDescription>
        </DialogHeader>

        {isLoadingBoards ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading boards...
            </span>
          </div>
        ) : boardsError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-destructive">{boardsError}</p>
          </div>
        ) : boards.length === 0 ? (
          <div className="py-8 text-center">
            <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No boards available. Create a board first.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Board Selection */}
            <div className="space-y-2">
              <Label htmlFor="board-select" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
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
                  {boards.map((board) => (
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
                <Columns3 className="h-4 w-4 text-muted-foreground" />
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
                <p className="text-xs text-muted-foreground">
                  This board has no columns. Add columns to the board first.
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <p className="text-sm text-destructive" role="alert">
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
            disabled={isRestoring}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRestore}
            disabled={
              isLoadingBoards ||
              isRestoring ||
              !effectiveBoardId ||
              !effectiveStatusId ||
              boards.length === 0 ||
              !!boardsError
            }
          >
            {isRestoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              'Restore'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export default RestoreToBoardDialog
