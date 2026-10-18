import { gridPositionRefusalSentence } from '@/lib/constants/grid-position'
import { failedActionMessage } from '@/lib/utils/failed-action-message'
import {
  notifyFailedBoardSave,
  type BoardRollbackOutcome,
} from '@/lib/utils/notify-failed-board-save'

/**
 * Rolls the columns back when a position write answered with a failure.
 *
 * A thrown write is left to the caller: that request never got an answer, and
 * the caller reports it. Called by {@link useKanbanDnD} and {@link useKanbanUndo}
 * around the actions that store a column's row and column.
 *
 * @param write - The position action, already started.
 * @param title - First line of the toast, e.g. `'Failed to move column'`.
 * @param rollback - Puts the columns back and says which second line to use
 *   when the failure is not the grid bound.
 * @param toastId - Sonner id to show the toast under. Omit it to use the id
 *   shared by failed saves.
 * @returns `saved` when the write was kept, otherwise what {@link rollback} did.
 *   {@link useKanbanUndo} puts a restored step back once so Z can try it again.
 * @example
 * const outcome = await rollbackIfPositionWriteFailed(
 *   updateStatusListPosition(id, row, col),
 *   'Failed to move column',
 *   () => dispatch(rollbackStatusLists(columnsAfter, columnsBefore)),
 * )
 */
export async function rollbackIfPositionWriteFailed(
  write: Promise<unknown>,
  title: string,
  rollback: () => BoardRollbackOutcome,
  toastId?: string,
): Promise<'saved' | BoardRollbackOutcome> {
  const message = failedActionMessage(await write)
  if (message === null) return 'saved'
  const outcome = rollback()
  notifyFailedBoardSave(
    title,
    outcome,
    toastId,
    gridPositionRefusalSentence(message) ?? undefined,
  )
  return outcome
}
