'use client'

import * as Sentry from '@sentry/nextjs'
import { Columns3 } from 'lucide-react'
import { memo, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import type { HeldRepository } from '@/components/Board/HeldRepositoryList'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MoveFailure } from '@/hooks/board/useMoveDialogState'
import { moveCardToBoard } from '@/lib/actions/repo-cards'
import { OUTCOME_UNKNOWN_TEXT_CLASS } from '@/lib/constants/outcome-unknown'
import { SERVER_ANSWER_TIME_LIMIT_MS } from '@/lib/constants/requests'
import type { StatusListDomain } from '@/lib/models/domain'
import { selectStatusLists } from '@/lib/redux/slices/boardSlice'
import {
  boardRefreshRequested,
  trackBoardWrite,
} from '@/lib/redux/slices/boardSyncSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { BoardId, StatusListId } from '@/lib/types/brands'
import { toMoveFailure } from '@/lib/utils/move-failure'
import { reloadPage } from '@/lib/utils/reload-page'
import { settleWithin } from '@/lib/utils/settle-within'

interface MoveHereDialogProps {
  /** The held repository the user asked to move onto this board. */
  repository: HeldRepository
  /** Board the picker is open on. */
  boardId: BoardId
  /** Column the picker was opened for. The select starts there. */
  defaultStatusId: StatusListId | null
  /** Closes the dialog. Not called while a move is in flight. */
  onClose: () => void
  /** Called after the server confirms the move, so the held list can reload. */
  onMoved: () => void
}

/**
 * Confirms moving a repository that already sits on another board onto this one.
 *
 * Opened from a held row of {@link HeldRepositoryList}. The destination board
 * is the one on screen; the user picks the column, starting from the column
 * the picker was opened for. {@link moveCardToBoard} keeps the note, links
 * and comment. A move nobody could confirm offers "Reload page", the same
 * way {@link MoveToAnotherBoardDialog} does. While that outcome is unknown,
 * Move Here stays disabled: the first request may still finish, and a second
 * one to another column could land the card somewhere else.
 *
 * @param repository - The held repository the user asked to move onto this board.
 * @param boardId - Board the picker is open on.
 * @param defaultStatusId - Column the picker was opened for. The select starts there.
 * @param onClose - Closes the dialog. Not called while a move is in flight.
 * @param onMoved - Called after the server confirms the move, so the held list can reload.
 * @returns The confirmation dialog.
 * @example
 * <MoveHereDialog repository={held} boardId={boardId} defaultStatusId={statusId} onClose={close} onMoved={refresh} />
 */
export const MoveHereDialog = memo(function MoveHereDialog({
  repository,
  boardId,
  defaultStatusId,
  onClose,
  onMoved,
}: MoveHereDialogProps) {
  const dispatch = useAppDispatch()
  const columns = useAppSelector(selectStatusLists)
  const orderedColumns = useMemo(() => columnsInBoardOrder(columns), [columns])
  const [columnId, setColumnId] = useState<string>(
    startingColumnId(orderedColumns, defaultStatusId),
  )
  const [isBusy, setIsBusy] = useState(false)
  const [failure, setFailure] = useState<MoveFailure | null>(null)
  const moveButtonRef = useRef<HTMLButtonElement>(null)
  const reloadButtonRef = useRef<HTMLButtonElement>(null)

  const handleClose = (): void => {
    if (isBusy) return
    onClose()
  }

  const handleMove = async (): Promise<void> => {
    if (!columnId) return
    setIsBusy(true)
    setFailure(null)

    const outcome = await settleWithin(
      trackBoardWrite(
        dispatch,
        moveCardToBoard(repository.cardId, boardId, columnId),
      ),
      SERVER_ANSWER_TIME_LIMIT_MS,
    )
    const moveFailure = toMoveFailure(outcome)
    if (moveFailure) {
      // A stale page never ran the action. Reporting it would mark every tab
      // left open across a deploy.
      if (outcome.status === 'failed' && !moveFailure.isPageOutOfDate) {
        Sentry.captureException(outcome.error, {
          tags: { action: 'moveCardToBoard' },
        })
      } else if (outcome.status === 'overdue') {
        Sentry.captureMessage('moveCardToBoard got no answer in time', {
          level: 'warning',
          tags: { action: 'moveCardToBoard' },
        })
      }
      flushSync(() => {
        setIsBusy(false)
        setFailure(moveFailure)
      })
      if (moveFailure.isOutcomeKnown) {
        moveButtonRef.current?.focus()
      } else {
        reloadButtonRef.current?.focus()
      }
      // The card may have moved all the same. A stale page did not run the
      // action, so the card is where it was and this board is not fetched.
      if (!moveFailure.isPageOutOfDate) dispatch(boardRefreshRequested())
      return
    }

    setIsBusy(false)
    toast.success('Moved here', { description: repository.fullName })
    onMoved()
    dispatch(boardRefreshRequested())
    onClose()
  }

  return (
    <Dialog open onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md" isCloseDisabled={isBusy}>
        <DialogHeader>
          <DialogTitle>Move Here</DialogTitle>
          <DialogDescription>
            Move{' '}
            <span className="text-foreground font-medium">
              {repository.fullName}
            </span>{' '}
            from {repository.boardName} to this board. Notes, links, and
            comments stay with the repository.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="move-here-column" className="flex items-center gap-2">
            <Columns3 className="text-muted-foreground h-4 w-4" aria-hidden />
            Column
          </Label>
          <Select
            value={columnId}
            onValueChange={setColumnId}
            disabled={isBusy || orderedColumns.length === 0}
          >
            <SelectTrigger id="move-here-column" className="w-full">
              <SelectValue
                placeholder={
                  orderedColumns.length === 0
                    ? 'No columns available'
                    : 'Select a column'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {orderedColumns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  <span className="flex items-center gap-2">
                    {column.color && (
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: column.color }}
                        aria-hidden
                      />
                    )}
                    {column.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {orderedColumns.length === 0 && (
            <p className="text-muted-foreground text-sm">
              This board has no columns. Add a column before moving a repository
              here.
            </p>
          )}
          {failure && (
            <p
              className={`${
                !failure.isOutcomeKnown && !failure.isPageOutOfDate
                  ? OUTCOME_UNKNOWN_TEXT_CLASS
                  : 'text-destructive'
              } text-sm`}
              role="alert"
            >
              {failure.message}
            </p>
          )}
        </div>

        <DialogFooter>
          {failure && !failure.isOutcomeKnown ? (
            <Button
              ref={reloadButtonRef}
              type="button"
              variant="outline"
              onClick={reloadPage}
            >
              Reload page
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isBusy}
            >
              Cancel
            </Button>
          )}
          <Button
            ref={moveButtonRef}
            type="button"
            onClick={() => {
              void handleMove()
            }}
            disabled={
              isBusy ||
              !columnId ||
              (failure !== null && !failure.isOutcomeKnown)
            }
          >
            {isBusy ? 'Moving…' : 'Move Here'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

/**
 * Columns in the order the board draws them.
 *
 * @param columns - Columns of the board on screen.
 * @returns A copy sorted by grid row, then grid column.
 */
function columnsInBoardOrder(columns: StatusListDomain[]): StatusListDomain[] {
  return [...columns].sort(
    (left, right) =>
      left.gridRow - right.gridRow || left.gridCol - right.gridCol,
  )
}

/**
 * Column the select starts on: the one the picker was opened for, or the first.
 *
 * @param columns - Columns in board order.
 * @param defaultStatusId - Column the picker was opened for, if it has one.
 * @returns A column id, or `''` when the board has no columns.
 */
function startingColumnId(
  columns: StatusListDomain[],
  defaultStatusId: StatusListId | null,
): string {
  if (
    defaultStatusId &&
    columns.some((column) => column.id === defaultStatusId)
  ) {
    return defaultStatusId
  }
  return columns[0]?.id ?? ''
}
