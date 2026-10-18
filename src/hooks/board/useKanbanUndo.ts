/**
 * useKanbanUndo Hook
 *
 * Manages undo history for both card and column drag operations.
 * Includes keyboard shortcut (Z key) registration internally.
 *
 * History stacks are capped at 10 entries to prevent unbounded memory growth.
 * A column snapshot whose columns are all still on the board takes priority
 * over card undo. One that names a deleted column is skipped, and so is one
 * that would put two columns on the same cell. The card stack runs in that
 * same Z only when every column snapshot was skipped. A card whose old
 * column was deleted stays in its current column. The other cards in
 * that snapshot still go back.
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch, cards, statuses })
 * // Pass to useKanbanDnD:
 * useKanbanDnD({ ...params, pushCardHistory, pushColumnHistory })
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import {
  batchUpdateRepoCardOrders,
  batchUpdateStatusListPositions,
} from '@/lib/actions/board'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import { setStatusLists, setRepoCards } from '@/lib/redux/slices/boardSlice'
import {
  rollbackRepoCards,
  rollbackStatusLists,
  trackBoardWrite,
} from '@/lib/redux/slices/boardSyncSlice'
import type { AppDispatch } from '@/lib/redux/store'
import { isOverlayOpen } from '@/lib/utils/is-overlay-open'
import {
  reportThrownBoardSave,
  type BoardRollbackOutcome,
} from '@/lib/utils/notify-failed-board-save'
import { reconcileColumnUndo } from '@/lib/utils/reconcile-column-undo'
import { reconcileUndoSnapshot } from '@/lib/utils/reconcile-undo-snapshot'
import { reportUnconfirmedBoardSave } from '@/lib/utils/report-unconfirmed-board-save'
import { rollbackIfPositionWriteFailed } from '@/lib/utils/rollback-if-position-write-failed'
import {
  toColumnPositions,
  type CardColumnPosition,
} from '@/lib/utils/to-column-positions'

/**
 * Sonner id shared by an undo's "restored" toast and its "failed" toast, so a
 * refused undo replaces the success message instead of standing next to it.
 */
const UNDO_TOAST_ID = 'board-undo'

/** First line of the toast shown when an undo was not saved. */
const UNDO_FAILED_TOAST_TITLE = 'Failed to sync undo to database'

interface UseKanbanUndoParams {
  /** Redux dispatch function */
  dispatch: AppDispatch
  /** Cards on the board right now; an undo never touches a card that left it */
  cards: RepoCardForRedux[]
  /** Columns on the board right now; a refused column undo goes back to them */
  statuses: StatusListDomain[]
}

interface UseKanbanUndoReturn {
  /** Push a card snapshot to the undo history stack (max 10) */
  pushCardHistory: (snapshot: RepoCardForRedux[]) => void
  /** Push a column snapshot to the undo history stack (max 10) */
  pushColumnHistory: (snapshot: StatusListDomain[]) => void
}

/**
 * Hook for Kanban board undo functionality.
 *
 * Manages card and column history stacks, handles undo operations with
 * DB sync, and registers the Z-key keyboard shortcut internally.
 *
 * @param params - Redux dispatch and the board's current cards and columns
 * @returns Push callbacks for DnD handlers to record history
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch, cards, statuses })
 * // DnD handlers call pushCardHistory(cards) before mutations
 */
export function useKanbanUndo(
  params: UseKanbanUndoParams,
): UseKanbanUndoReturn {
  const { dispatch, cards, statuses } = params

  // History stacks (max 10 entries each)
  const [history, setHistory] = useState<RepoCardForRedux[][]>([])
  const [columnHistory, setColumnHistory] = useState<StatusListDomain[][]>([])
  // The snapshot last put back after a refusal. A second refusal of that
  // same array is dropped, so a failure that will not go away cannot sit
  // in front of every older step.
  const retriedCardSnapshot = useRef<RepoCardForRedux[] | null>(null)
  const retriedColumnSnapshot = useRef<StatusListDomain[] | null>(null)

  const pushCardHistory = useCallback((snapshot: RepoCardForRedux[]) => {
    setHistory((prev) => [...prev, snapshot].slice(-10))
  }, [])

  const pushColumnHistory = useCallback((snapshot: StatusListDomain[]) => {
    setColumnHistory((prev) => [...prev, snapshot].slice(-10))
  }, [])

  /**
   * Undo the last drag & drop operation.
   * A column snapshot that still matches the board takes priority over a
   * card undo. A snapshot that names a deleted column, or that would stack
   * two columns on one cell, is skipped.
   * Syncs reverted state to database.
   */
  const handleUndo = useCallback(() => {
    // A snapshot that names a column the board no longer has is not put
    // back: the columns that remain would jump to that old layout. One Z
    // walks past those entries. The first snapshot whose columns are all
    // still here, and that does not stack two columns on one cell, is the
    // one that moves, and the card stack waits. When every column entry
    // was skipped, the card stack is tried in this Z.
    const stackLengthAtUndo = columnHistory.length
    let remainingColumns = columnHistory
    let appliedColumnSnapshot: StatusListDomain[] | null = null
    let columnsAfterUndo: StatusListDomain[] | null = null
    const commitColumnWalk = (): void => {
      setColumnHistory((stack) => {
        // Entries pushed while this undo's save is in flight stay above
        // the ones this Z already decided.
        const pushedAfter = stack.slice(stackLengthAtUndo)
        return [...remainingColumns, ...pushedAfter]
      })
    }
    while (remainingColumns.length > 0) {
      const candidate = remainingColumns[remainingColumns.length - 1]!
      remainingColumns = remainingColumns.slice(0, -1)
      if (!columnSnapshotFitsTheBoard(candidate, statuses)) continue
      const restored = reconcileColumnUndo(candidate, statuses)
      // A column added since this snapshot keeps its cell. Restoring
      // another column onto that cell stacks them, and the table allows
      // two columns on one cell. Leave this snapshot and keep walking.
      if (columnsShareACell(restored)) continue
      appliedColumnSnapshot = candidate
      columnsAfterUndo = restored
      break
    }

    if (appliedColumnSnapshot !== null && columnsAfterUndo !== null) {
      const snapshot = appliedColumnSnapshot
      const restoredColumns = columnsAfterUndo
      // Where the applied entry sat after the skipped ones were dropped.
      // A refusal puts this snapshot back there, and leaves the skipped
      // ones off the stack.
      const indexAfterPop = remainingColumns.length
      // `reconcileColumnUndo` returns a new array. The next drag pushes the
      // store's array back onto the history, and a second undo would
      // otherwise dispatch that same array. The failed-save rollback tells
      // writes apart by it. Positions come from the snapshot. A column renamed
      // or recolored since keeps what it is now, and a column added since
      // stays on the board.
      dispatch(setStatusLists(restoredColumns))
      commitColumnWalk()
      toast.success('Column order restored', { id: UNDO_TOAST_ID })

      const updates = restoredColumns.map((s) => ({
        id: s.id,
        gridRow: s.gridRow,
        gridCol: s.gridCol,
      }))
      const rememberColumnStep = (outcome: BoardRollbackOutcome): void => {
        rememberRefusedUndoStep(
          outcome,
          snapshot,
          retriedColumnSnapshot,
          indexAfterPop,
          setColumnHistory,
        )
      }
      rollbackIfPositionWriteFailed(
        trackBoardWrite(dispatch, batchUpdateStatusListPositions(updates), () =>
          reportUnconfirmedBoardSave('undoColumnPositions'),
        ),
        UNDO_FAILED_TOAST_TITLE,
        () => dispatch(rollbackStatusLists(restoredColumns, statuses)),
        UNDO_TOAST_ID,
      )
        .then((outcome) => {
          // Kept: this snapshot is no longer the one Z should retry.
          if (outcome === 'saved') {
            if (retriedColumnSnapshot.current === snapshot) {
              retriedColumnSnapshot.current = null
            }
            return
          }
          rememberColumnStep(outcome)
        })
        .catch((error: unknown) => {
          Sentry.captureException(error, {
            tags: { action: 'undoColumnPositions' },
          })
          // The write threw. The screen goes back when it still can, and the
          // step returns to the stack only while that screen is its own.
          const outcome = dispatch(
            rollbackStatusLists(restoredColumns, statuses),
          )
          reportThrownBoardSave(
            dispatch,
            UNDO_FAILED_TOAST_TITLE,
            outcome,
            UNDO_TOAST_ID,
          )
          rememberColumnStep(outcome)
        })
      return
    }

    // Every column snapshot named a deleted column, or would stack two
    // columns on one cell. Drop them, then try the card stack in this same
    // Z. With no card move either, say so.
    if (stackLengthAtUndo > 0) commitColumnWalk()

    if (history.length === 0) {
      if (stackLengthAtUndo > 0) {
        toast.info('Nothing to undo on this board')
      }
      return
    }

    // A drag that put the card back where it was is still on the stack.
    // One Z walks past it. A card aimed at a deleted column stays in its
    // current column and in its current place in that column. The other cards in that
    // snapshot still go back, in the snapshot's order, in the slots that
    // remain. The entry that returns is the first whose layout still
    // changes after that.
    const currentPositions = toColumnPositions(cards)
    let remaining = history
    let cardsAfterUndo = cards
    let positionsAfterUndo = currentPositions
    let appliedSnapshot: RepoCardForRedux[] | null = null
    while (remaining.length > 0) {
      const previousState = remaining[remaining.length - 1]!
      remaining = remaining.slice(0, -1)
      // The board may have changed since the snapshot (card moved to another
      // board, removed, added): only cards still here go back to their old place
      cardsAfterUndo = keepCardsOutOfDeletedColumns(
        reconcileUndoSnapshot(previousState, cards),
        cards,
        statuses,
      )
      positionsAfterUndo = toColumnPositions(cardsAfterUndo)
      if (hasSameLayout(currentPositions, positionsAfterUndo)) continue
      appliedSnapshot = previousState
      break
    }

    const indexAfterPop = remaining.length
    setHistory(remaining)

    // Every remembered drag left the board as it is, or the only change
    // was a card returning to a column that is gone. That card stays
    // where it is, so the walk records no snapshot.
    if (
      hasSameLayout(currentPositions, positionsAfterUndo) ||
      appliedSnapshot === null
    ) {
      toast.info('Nothing to undo on this board')
      return
    }

    const snapshot = appliedSnapshot
    dispatch(setRepoCards(cardsAfterUndo))
    toast.success('Card operation undone', { id: UNDO_TOAST_ID })

    // Positions come from the restored layout, not from each card's `order`
    // field, which drags never update

    trackBoardWrite(
      dispatch,
      batchUpdateRepoCardOrders(positionsAfterUndo),
      () => reportUnconfirmedBoardSave('undoCardPositions'),
    ).then(
      () => {
        // Kept: this snapshot is no longer the one Z should retry.
        if (retriedCardSnapshot.current === snapshot) {
          retriedCardSnapshot.current = null
        }
      },
      (error: unknown) => {
        Sentry.captureException(error, {
          tags: { action: 'undoCardPositions' },
        })
        // The write threw. Go back to the layout the database still holds
        // when the screen is still this undo, and leave the step on the
        // stack once so the next Z tries it again.
        const outcome = dispatch(rollbackRepoCards(cardsAfterUndo, cards))
        reportThrownBoardSave(
          dispatch,
          UNDO_FAILED_TOAST_TITLE,
          outcome,
          UNDO_TOAST_ID,
        )
        rememberRefusedUndoStep(
          outcome,
          snapshot,
          retriedCardSnapshot,
          indexAfterPop,
          setHistory,
        )
      },
    )
  }, [history, columnHistory, dispatch, cards, statuses])

  // Keyboard shortcut: Z key to execute undo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Skip if user is typing in an input field, textarea, or contentEditable element
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Bare Z key only (no Cmd/Ctrl/Alt modifiers to avoid conflict with browser undo)
      const isBareZKey =
        (event.key === 'z' || event.key === 'Z') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      if (!isBareZKey) return

      // A layer lies over the board: a dialog, a menu, a list of options,
      // the command palette, the Add Repositories panel, or the sidebar
      // below 768px. The key belongs to that layer (a Select reads a letter
      // as "jump to this option"), and the board behind it must not change.
      // Asked last: it searches the document, and every other key should
      // not pay for that.
      if (isOverlayOpen()) return

      event.preventDefault()
      handleUndo()
    }

    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo])

  return {
    pushCardHistory,
    pushColumnHistory,
  }
}

/**
 * Puts a refused undo step back, or leaves it off the stack.
 *
 * Called from {@link useKanbanUndo} after the save of an undo fails. A step
 * whose screen is still the layout it undoes (`restored`) goes back once, so
 * the next Z tries it again after a blip. The same snapshot refused a second
 * time, and a step whose screen has moved on (`reload-requested`), stays off
 * the stack: the top of the stack is always tried first, and a refusal that
 * will not go away would otherwise hide every older step.
 *
 * @param outcome - What the rollback did to the board on screen.
 * @param snapshot - The history entry that was popped for this undo.
 * @param alreadyRetried - The snapshot put back after the previous refusal.
 * @param indexAfterPop - Where the popped entry sat. Entries pushed while the
 *   save was in flight stay above it.
 * @param setStack - The history setter for this kind of undo.
 */
function rememberRefusedUndoStep<T extends object>(
  outcome: BoardRollbackOutcome,
  snapshot: T,
  alreadyRetried: { current: T | null },
  indexAfterPop: number,
  setStack: (update: (stack: T[]) => T[]) => void,
): void {
  // The board moved on, or this exact step was already refused once.
  if (outcome !== 'restored' || alreadyRetried.current === snapshot) {
    if (alreadyRetried.current === snapshot) alreadyRetried.current = null
    return
  }
  alreadyRetried.current = snapshot
  setStack((stack) => putUndoStepBack(stack, snapshot, indexAfterPop))
}

/**
 * Inserts a popped undo snapshot under anything pushed while its save was
 * still in flight.
 *
 * Called by {@link rememberRefusedUndoStep}. A second call with the same
 * snapshot at the same index returns the stack unchanged, so a strict-mode
 * updater does not insert it twice.
 *
 * @param stack - History after the pop, plus any later pushes.
 * @param snapshot - The entry to put back.
 * @param indexAfterPop - Index the entry had when it was popped.
 * @returns The stack with that entry back, capped at 10.
 */
function putUndoStepBack<T>(
  stack: T[],
  snapshot: T,
  indexAfterPop: number,
): T[] {
  // Already put back: a second updater pass must not insert it again.
  if (stack[indexAfterPop] === snapshot) return stack
  const older = stack.slice(0, indexAfterPop)
  const newer = stack.slice(indexAfterPop)
  return [...older, snapshot, ...newer].slice(-10)
}

/**
 * Tells whether two board layouts show every card in the same column and at
 * the same position. Used by {@link useKanbanUndo} to skip an undo that would
 * change nothing.
 *
 * @param current - Positions of the cards on the board now.
 * @param next - Positions the undo would produce.
 * @returns `true` when both hold the same cards at the same places.
 * @example
 * hasSameLayout([{ id: 'a', statusId: 'todo', order: 0 }], [{ id: 'a', statusId: 'done', order: 0 }]) // => false
 */
function hasSameLayout(
  current: CardColumnPosition[],
  next: CardColumnPosition[],
): boolean {
  if (current.length !== next.length) return false

  const currentPositionById = new Map(
    current.map((position) => [position.id, position]),
  )
  return next.every((position) => {
    const currentPosition = currentPositionById.get(position.id)
    return (
      currentPosition !== undefined &&
      currentPosition.statusId === position.statusId &&
      currentPosition.order === position.order
    )
  })
}

/**
 * Whether every column in an undo snapshot is still on the board.
 *
 * Called by {@link useKanbanUndo} before it replays a column drag. A
 * snapshot that names a column deleted since that drag is skipped. Putting
 * the other columns back to that layout is what Z used to do, and they
 * jumped.
 *
 * @param snapshot - Columns as they were before the drag.
 * @param currentColumns - Columns on the board now.
 * @returns `true` when every snapshot id is a column that is still here.
 * @example
 * columnSnapshotFitsTheBoard(
 *   [{ id: 'col-a' }, { id: 'col-gone' }],
 *   [{ id: 'col-a' }],
 * ) // => false
 */
function columnSnapshotFitsTheBoard(
  snapshot: StatusListDomain[],
  currentColumns: StatusListDomain[],
): boolean {
  const currentIds = new Set(currentColumns.map((column) => column.id))
  return snapshot.every((column) => currentIds.has(column.id))
}

/**
 * Whether a restored column layout puts two columns on one cell.
 *
 * Called by {@link useKanbanUndo} after {@link reconcileColumnUndo}. A
 * column added since the snapshot stays where it is, so an older snapshot
 * can move a survivor onto that cell. The table has no unique cell, so
 * the write would keep the overlap.
 *
 * @param columns - Columns about to be shown and saved.
 * @returns `true` when two of them share `gridRow` and `gridCol`.
 * @example
 * columnsShareACell([
 *   { gridRow: 0, gridCol: 1 },
 *   { gridRow: 0, gridCol: 1 },
 * ]) // => true
 */
function columnsShareACell(columns: StatusListDomain[]): boolean {
  const cells = new Set<string>()
  for (const column of columns) {
    const cell = `${column.gridRow}:${column.gridCol}`
    if (cells.has(cell)) return true
    cells.add(cell)
  }
  return false
}

/**
 * Leaves a card in its current column when the snapshot names a column
 * that is gone.
 *
 * Called by {@link useKanbanUndo} after {@link reconcileUndoSnapshot}.
 * The snapshot is the whole board, so dropping it would also drop an
 * earlier move of a different card. The card whose column was deleted
 * stays where it is now. The other cards still go back.
 *
 * @param restored - Cards the snapshot would show, including ones whose
 *   column was deleted since.
 * @param currentCards - Cards on the board now.
 * @param currentColumns - Columns on the board now.
 * @returns Cards in undo order. A card aimed at a deleted column keeps its
 *   place among the cards in its current column. The others fill the
 *   remaining places in that column, in snapshot order.
 * @example
 * keepCardsOutOfDeletedColumns(
 *   [cardThatWasInShipped, cardThatWasInIdeas],
 *   [cardNowInIdeas, cardNowInBuilding],
 *   [ideas, building],
 * )
 */
function keepCardsOutOfDeletedColumns(
  restored: RepoCardForRedux[],
  currentCards: RepoCardForRedux[],
  currentColumns: StatusListDomain[],
): RepoCardForRedux[] {
  const columnIds = new Set(currentColumns.map((column) => column.id))
  // Card-only tests, and a board with no columns loaded, have nothing to
  // compare. The columns of a real board are passed in.
  if (columnIds.size === 0) return restored
  const stayedIds = new Set(
    restored
      .filter((card) => !columnIds.has(card.statusId))
      .map((card) => card.id),
  )
  if (stayedIds.size === 0) return restored

  // Place is the card's index inside its column, not in the whole board
  // array. Pinning the board index moves it past a card from another column.
  const indexInColumn = new Map<string, number>()
  const seenInColumn = new Map<string, number>()
  for (const card of currentCards) {
    const index = seenInColumn.get(card.statusId) ?? 0
    indexInColumn.set(card.id, index)
    seenInColumn.set(card.statusId, index + 1)
  }

  const moversByColumn = new Map<string, RepoCardForRedux[]>()
  for (const card of restored) {
    if (stayedIds.has(card.id) || !columnIds.has(card.statusId)) continue
    const movers = moversByColumn.get(card.statusId) ?? []
    movers.push(card)
    moversByColumn.set(card.statusId, movers)
  }
  const stayedByColumn = new Map<string, RepoCardForRedux[]>()
  for (const card of currentCards) {
    if (!stayedIds.has(card.id)) continue
    const stayed = stayedByColumn.get(card.statusId) ?? []
    stayed.push(card)
    stayedByColumn.set(card.statusId, stayed)
  }

  const columnOrder = [
    ...currentColumns.map((column) => column.id),
    ...moversByColumn.keys(),
    ...stayedByColumn.keys(),
  ]
  const seenColumns = new Set<string>()
  const result: RepoCardForRedux[] = []
  for (const columnId of columnOrder) {
    if (seenColumns.has(columnId)) continue
    seenColumns.add(columnId)
    const stayed = stayedByColumn.get(columnId) ?? []
    const movers = moversByColumn.get(columnId) ?? []
    if (stayed.length === 0 && movers.length === 0) continue
    result.push(...placeColumn(stayed, movers, indexInColumn))
  }
  return result
}

/**
 * Puts the cards that must stay at their current place in one column, and
 * fills the other places from the snapshot.
 *
 * @param stayed - Cards already in this column whose old column is gone,
 *   in the order the board shows them.
 * @param movers - Cards the snapshot puts in this column, in snapshot order.
 * @param indexInColumn - Each card's current place in its column.
 * @returns The column's cards from top to bottom.
 */
function placeColumn(
  stayed: RepoCardForRedux[],
  movers: RepoCardForRedux[],
  indexInColumn: Map<string, number>,
): RepoCardForRedux[] {
  const slots: Array<RepoCardForRedux | undefined> = new Array(
    stayed.length + movers.length,
  )
  // Earlier cards keep their lead. A column that got shorter cannot hold
  // both old indexes, and the later card must not jump in front.
  const ordered = [...stayed].sort(
    (left, right) =>
      (indexInColumn.get(left.id) ?? 0) - (indexInColumn.get(right.id) ?? 0),
  )
  let previous = -1
  for (const [position, card] of ordered.entries()) {
    const roomForLaterCards = ordered.length - position - 1
    const latest = slots.length - 1 - roomForLaterCards
    const earliest = previous + 1
    const wanted = indexInColumn.get(card.id) ?? earliest
    const index = Math.min(Math.max(wanted, earliest), latest)
    slots[index] = card
    previous = index
  }
  let hole = 0
  for (const card of movers) {
    while (hole < slots.length && slots[hole] !== undefined) hole += 1
    if (hole >= slots.length) break
    slots[hole] = card
    hole += 1
  }
  return slots.filter((card): card is RepoCardForRedux => card !== undefined)
}
