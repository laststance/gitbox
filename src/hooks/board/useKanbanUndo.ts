/**
 * useKanbanUndo Hook
 *
 * Manages undo history for both card and column drag operations.
 * Includes keyboard shortcut (Z key) registration internally.
 *
 * History stacks are capped at 10 entries to prevent unbounded memory growth.
 * Column undo takes priority over card undo.
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch })
 * // Pass to useKanbanDnD:
 * useKanbanDnD({ ...params, pushCardHistory, pushColumnHistory })
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

import {
  batchUpdateRepoCardOrders,
  batchUpdateStatusListPositions,
} from '@/lib/actions/board'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import { setStatusLists, setRepoCards } from '@/lib/redux/slices/boardSlice'
import type { AppDispatch } from '@/lib/redux/store'

interface UseKanbanUndoParams {
  /** Redux dispatch function */
  dispatch: AppDispatch
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
 * @param params - Redux dispatch
 * @returns Push callbacks for DnD handlers to record history
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch })
 * // DnD handlers call pushCardHistory(cards) before mutations
 */
export function useKanbanUndo(
  params: UseKanbanUndoParams,
): UseKanbanUndoReturn {
  const { dispatch } = params

  // History stacks (max 10 entries each)
  const [history, setHistory] = useState<RepoCardForRedux[][]>([])
  const [columnHistory, setColumnHistory] = useState<StatusListDomain[][]>([])

  const pushCardHistory = useCallback((snapshot: RepoCardForRedux[]) => {
    setHistory((prev) => [...prev, snapshot].slice(-10))
  }, [])

  const pushColumnHistory = useCallback((snapshot: StatusListDomain[]) => {
    setColumnHistory((prev) => [...prev, snapshot].slice(-10))
  }, [])

  /**
   * Undo the last drag & drop operation.
   * Column undo takes priority over card undo.
   * Syncs reverted state to database.
   */
  const handleUndo = useCallback(() => {
    // Try column undo first, then card undo
    if (columnHistory.length > 0) {
      const previousState = columnHistory[columnHistory.length - 1]
      if (previousState) {
        dispatch(setStatusLists(previousState))
        setColumnHistory((prev) => prev.slice(0, -1))
        toast.success('Column order restored')

        // P1-8: Sync reverted column positions to DB
        const updates = previousState.map((s) => ({
          id: s.id,
          gridRow: s.gridRow,
          gridCol: s.gridCol,
        }))
        batchUpdateStatusListPositions(updates).catch((error) => {
          Sentry.captureException(error, {
            tags: { action: 'undoColumnPositions' },
          })
          toast.error('Failed to sync undo to database')
        })
      }
      return
    }

    if (history.length > 0) {
      const previousState = history[history.length - 1]
      if (previousState) {
        dispatch(setRepoCards(previousState))
        setHistory((prev) => prev.slice(0, -1))
        toast.success('Card operation undone')

        // P1-8: Sync reverted card positions to DB
        const updates = previousState.map((c, index) => ({
          id: c.id,
          statusId: c.statusId,
          order: c.order ?? index,
        }))
        batchUpdateRepoCardOrders(updates).catch((error) => {
          Sentry.captureException(error, {
            tags: { action: 'undoCardPositions' },
          })
          toast.error('Failed to sync undo to database')
        })
      }
    }
  }, [history, columnHistory, dispatch])

  // Keyboard shortcut: Z key to execute undo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
      if (
        (event.key === 'z' || event.key === 'Z') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo])

  return {
    pushCardHistory,
    pushColumnHistory,
  }
}
