/**
 * Delete Account Dialog Component
 *
 * A confirmation dialog for permanent account deletion.
 * - Requires user to type "DELETE" to enable the delete button
 * - Uses shadcn AlertDialog for accessibility
 * - Calls deleteAccount server action on confirmation
 */

'use client'

import { AlertTriangle } from 'lucide-react'
import { memo, useCallback, useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/lib/actions/auth'

/** Confirmation text required to enable delete button */
const CONFIRMATION_TEXT = 'DELETE'

interface DeleteAccountDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const DeleteAccountDialog = memo(function DeleteAccountDialog({
  isOpen,
  onClose,
}: DeleteAccountDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isPending, startTransition] = useTransition()

  const isConfirmed = useMemo(
    () => confirmationInput === CONFIRMATION_TEXT,
    [confirmationInput],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmationInput(e.target.value)
    },
    [],
  )

  const handleDelete = useCallback(() => {
    if (!isConfirmed) return

    startTransition(async () => {
      try {
        await deleteAccount()
        // Note: deleteAccount redirects to '/', so this won't be reached on success
      } catch (error) {
        toast.error('Failed to delete account', {
          description:
            error instanceof Error ? error.message : 'Please try again later.',
        })
      }
    })
  }, [isConfirmed])

  const handleClose = useCallback(() => {
    setConfirmationInput('')
    onClose()
  }, [onClose])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose()
      }
    },
    [handleClose],
  )

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid="delete-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action is <strong>irreversible</strong>. All your boards,
              cards, notes, and settings will be permanently deleted.
            </p>
            <p className="font-medium text-foreground">
              Your GitHub repositories will NOT be affected.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="delete-confirmation">
            Type{' '}
            <span className="font-mono font-bold">{CONFIRMATION_TEXT}</span> to
            confirm:
          </Label>
          <Input
            id="delete-confirmation"
            type="text"
            value={confirmationInput}
            onChange={handleInputChange}
            placeholder={CONFIRMATION_TEXT}
            autoComplete="off"
            autoFocus
            data-testid="delete-confirmation-input"
          />
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            data-testid="cancel-delete-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isPending}
            data-testid="confirm-delete-button"
          >
            {isPending ? 'Deleting...' : 'Delete Account'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
