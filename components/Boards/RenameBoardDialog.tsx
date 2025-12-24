/**
 * Rename Board Dialog
 *
 * A dialog for renaming a board with inline validation.
 * Uses useActionState for form handling with server-side validation.
 */

'use client'

import { memo, useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { renameBoardAction, type RenameBoardState } from '@/lib/actions/board'
import { BOARD_NAME_MAX_LENGTH } from '@/lib/validations/board'

interface RenameBoardDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed */
  onClose: () => void
  /** Callback when rename succeeds (for optimistic update) */
  onRenameSuccess: (newName: string) => void
  /** Board ID to rename */
  boardId: string
  /** Current board name */
  currentName: string
}

const initialState: RenameBoardState = {}

/**
 * Rename Board Dialog
 *
 * Displays a form dialog for renaming a board.
 * Uses useActionState for form handling and shows validation errors inline.
 *
 * @example
 * <RenameBoardDialog
 *   isOpen={isRenameOpen}
 *   onClose={() => setIsRenameOpen(false)}
 *   onRenameSuccess={(newName) => updateBoardName(boardId, newName)}
 *   boardId="board-123"
 *   currentName="My Board"
 * />
 */
export const RenameBoardDialog = memo(function RenameBoardDialog({
  isOpen,
  onClose,
  onRenameSuccess,
  boardId,
  currentName,
}: RenameBoardDialogProps) {
  const [state, formAction, isPending] = useActionState(
    renameBoardAction,
    initialState,
  )

  // Local state for character count display
  // Re-initialize when currentName changes (key prop pattern alternative)
  const [name, setName] = useState(currentName)
  const [lastCurrentName, setLastCurrentName] = useState(currentName)

  // Pattern: Sync state from props without useEffect
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (currentName !== lastCurrentName) {
    setLastCurrentName(currentName)
    setName(currentName)
  }

  // Handle success/error after action completes
  useEffect(() => {
    if (state.success && state.newName) {
      toast.success('Board renamed', {
        description: `Board renamed to "${state.newName}".`,
      })
      onRenameSuccess(state.newName)
      onClose()
    }
  }, [state.success, state.newName, onRenameSuccess, onClose])

  const charCount = name.length
  const isNearLimit = charCount >= BOARD_NAME_MAX_LENGTH - 10
  const hasError = state.errors?.name && state.errors.name.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[400px]"
        accessibleTitle="Rename Board"
      >
        <DialogHeader>
          <DialogTitle>Rename Board</DialogTitle>
          <DialogDescription>
            Enter a new name for this board.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="boardId" value={boardId} />

          <div className="space-y-2">
            <Input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Board name"
              maxLength={BOARD_NAME_MAX_LENGTH}
              aria-invalid={hasError}
              aria-describedby={hasError ? 'name-error' : 'name-char-count'}
              autoFocus
            />

            <div className="flex items-center justify-between">
              {hasError ? (
                <p
                  id="name-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {state.errors?.name?.[0]}
                </p>
              ) : (
                <span />
              )}
              <p
                id="name-char-count"
                className={
                  isNearLimit
                    ? 'text-sm text-orange-500'
                    : 'text-sm text-muted-foreground'
                }
              >
                {charCount}/{BOARD_NAME_MAX_LENGTH}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || name.trim() === ''}
              aria-label={`Rename board to ${name}`}
            >
              {isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})

export default RenameBoardDialog
