/**
 * Delete Maintenance Item Confirmation Dialog
 *
 * An AlertDialog for confirming permanent deletion of a maintenance item.
 * Uses useActionState for form handling with server-side action.
 * Associated project info (notes, links) is automatically cleaned up via DB cascade.
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
import {
  deleteMaintenanceItemAction,
  type DeleteMaintenanceState,
} from '@/lib/actions/maintenance-project-info'

interface DeleteMaintenanceDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed */
  onClose: () => void
  /** Callback when delete succeeds (for optimistic update) */
  onDeleteSuccess: () => void
  /** Maintenance item ID to delete */
  maintenanceId: string
  /** Repository name for display (e.g., "owner/repo") */
  repoName: string
}

const initialState: DeleteMaintenanceState = {}

/**
 * Delete Maintenance Item Confirmation Dialog
 *
 * Displays a destructive confirmation dialog before permanently deleting
 * a maintenance item. Uses useActionState for form handling.
 *
 * @example
 * <DeleteMaintenanceDialog
 *   isOpen={isDeleteOpen}
 *   onClose={() => setIsDeleteOpen(false)}
 *   onDeleteSuccess={() => removeRepo(repoId)}
 *   maintenanceId="maint-123"
 *   repoName="laststance/gitbox"
 * />
 */
export const DeleteMaintenanceDialog = memo(function DeleteMaintenanceDialog({
  isOpen,
  onClose,
  onDeleteSuccess,
  maintenanceId,
  repoName,
}: DeleteMaintenanceDialogProps) {
  const [state, formAction, isPending] = useActionState(
    deleteMaintenanceItemAction,
    initialState,
  )

  // Handle success/error after action completes
  useEffect(() => {
    if (state.success) {
      toast.success('Item deleted', {
        description: `"${repoName}" has been removed from maintenance.`,
      })
      onDeleteSuccess()
      onClose()
    } else if (state.error) {
      toast.error('Failed to delete item', {
        description: state.error,
      })
    }
  }, [state.success, state.error, repoName, onDeleteSuccess, onClose])

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={() => {
        if (!isPending) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete from Maintenance</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{repoName}&quot;? This action
            cannot be undone. All associated notes, comments, and links will be
            permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="maintenanceId" value={maintenanceId} />
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending}
              aria-label={`Delete ${repoName} from maintenance`}
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
