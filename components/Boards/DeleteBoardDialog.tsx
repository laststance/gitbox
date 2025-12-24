/**
 * Delete Board Confirmation Dialog
 *
 * An AlertDialog for confirming board deletion.
 * Uses useActionState for form handling with server-side action.
 */

'use client'

import { memo, useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deleteBoardAction, type DeleteBoardState } from '@/lib/actions/board'

interface DeleteBoardDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed */
  onClose: () => void
  /** Callback when delete succeeds (for optimistic update) */
  onDeleteSuccess: () => void
  /** Board ID to delete */
  boardId: string
  /** Board name for display */
  boardName: string
}

const initialState: DeleteBoardState = {}

/**
 * Delete Board Confirmation Dialog
 *
 * Displays a destructive confirmation dialog before deleting a board.
 * Uses useActionState for form handling and useEffect to handle success/error.
 *
 * @example
 * <DeleteBoardDialog
 *   isOpen={isDeleteOpen}
 *   onClose={() => setIsDeleteOpen(false)}
 *   onDeleteSuccess={() => removeBoard(boardId)}
 *   boardId="board-123"
 *   boardName="My Board"
 * />
 */
export const DeleteBoardDialog = memo(function DeleteBoardDialog({
  isOpen,
  onClose,
  onDeleteSuccess,
  boardId,
  boardName,
}: DeleteBoardDialogProps) {
  const [state, formAction, isPending] = useActionState(
    deleteBoardAction,
    initialState,
  )

  // Handle success/error after action completes
  useEffect(() => {
    if (state.success) {
      toast.success('Board deleted', {
        description: `"${boardName}" has been deleted.`,
      })
      onDeleteSuccess()
      onClose()
    } else if (state.error) {
      toast.error('Failed to delete board', {
        description: state.error,
      })
    }
  }, [state.success, state.error, boardName, onDeleteSuccess, onClose])

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Board</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{boardName}&quot;? This action
            cannot be undone. All columns and cards will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="boardId" value={boardId} />
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending}
              aria-label={`Delete board ${boardName}`}
            >
              {isPending ? 'Deleting...' : 'Delete Board'}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

export default DeleteBoardDialog
