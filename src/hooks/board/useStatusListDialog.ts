/**
 * useStatusListDialog Hook
 *
 * Manages StatusList (column) dialog state including:
 * - Dialog open/close state
 * - Selected status for editing
 * - Dialog mode (create/edit)
 * - Delete confirmation dialog
 * - CRUD operations
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import {
  createStatusList,
  updateStatusList,
  deleteStatusList,
} from '@/lib/actions/board'
import type { StatusListDomain } from '@/lib/models/domain'
import { setStatusLists } from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { StatusListId } from '@/lib/types/brands'

type DialogMode = 'create' | 'edit'

interface UseStatusListDialogParams {
  /** Board ID for creating new status lists */
  boardId: string
}

interface UseStatusListDialogReturn {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Currently selected status for editing (null for create mode) */
  selectedStatus: StatusListDomain | null
  /** Dialog mode: 'create' or 'edit' */
  mode: DialogMode
  /** Whether delete confirmation dialog is open */
  isDeleteConfirmOpen: boolean
  /** Status ID pending deletion */
  pendingDeleteStatusId: StatusListId | null
  /** Status title for delete confirmation (computed from pendingDeleteStatusId) */
  pendingDeleteStatusTitle: string | undefined
  /** Open dialog in create mode */
  openCreate: () => void
  /** Open dialog in edit mode for a specific status */
  openEdit: (status: StatusListDomain) => void
  /** Close the dialog */
  close: () => void
  /** Save status (create or update based on mode) */
  save: (data: { name: string; color: string }) => Promise<void>
  /** Request deletion (opens confirmation dialog) */
  requestDelete: (statusId: StatusListId) => void
  /** Cancel delete (closes confirmation dialog) */
  cancelDelete: () => void
  /** Confirm and execute delete */
  confirmDelete: () => Promise<void>
  /** Handle delete confirmation dialog open state change */
  setDeleteConfirmOpen: (open: boolean) => void
}

/**
 * Hook for managing StatusList dialog state and CRUD operations.
 *
 * @param params - Hook parameters including boardId
 * @returns State and action handlers for status list dialog
 *
 * @example
 * const statusDialog = useStatusListDialog({ boardId })
 *
 * // Open in create mode
 * <button onClick={statusDialog.openCreate}>Add Column</button>
 *
 * // Open in edit mode
 * <button onClick={() => statusDialog.openEdit(status)}>Edit</button>
 *
 * // Render dialog
 * <StatusListDialog
 *   isOpen={statusDialog.isOpen}
 *   onClose={statusDialog.close}
 *   onSave={statusDialog.save}
 *   statusList={statusDialog.selectedStatus}
 *   mode={statusDialog.mode}
 * />
 *
 * // Render delete confirmation
 * <AlertDialog open={statusDialog.isDeleteConfirmOpen}>
 *   ...
 *   <Button onClick={statusDialog.confirmDelete}>Delete</Button>
 * </AlertDialog>
 */
export function useStatusListDialog({
  boardId,
}: UseStatusListDialogParams): UseStatusListDialogReturn {
  const dispatch = useAppDispatch()
  const statusLists = useAppSelector((state) => state.board.statusLists)

  const [isOpen, setIsOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<StatusListDomain | null>(
    null,
  )
  const [mode, setMode] = useState<DialogMode>('create')

  // Delete confirmation state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [pendingDeleteStatusId, setPendingDeleteStatusId] =
    useState<StatusListId | null>(null)

  // Computed: title of the status pending deletion
  const pendingDeleteStatusTitle = statusLists.find(
    (s) => s.id === pendingDeleteStatusId,
  )?.title

  /**
   * Open dialog in create mode
   */
  const openCreate = useCallback(() => {
    setSelectedStatus(null)
    setMode('create')
    setIsOpen(true)
  }, [])

  /**
   * Open dialog in edit mode
   */
  const openEdit = useCallback((status: StatusListDomain) => {
    setSelectedStatus(status)
    setMode('edit')
    setIsOpen(true)
  }, [])

  /**
   * Close the dialog
   */
  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  /**
   * Save status (create or update)
   */
  const save = useCallback(
    async (data: { name: string; color: string }) => {
      try {
        if (mode === 'create') {
          // Create new
          const newStatus = await createStatusList(
            boardId,
            data.name,
            data.color,
          )
          // Update Redux
          dispatch(setStatusLists([...statusLists, newStatus]))
          toast.success('Column created', {
            description: `"${data.name}" has been created.`,
          })
        } else if (selectedStatus) {
          // Update existing
          await updateStatusList(selectedStatus.id, {
            name: data.name,
            color: data.color,
          })
          // Update Redux
          const updatedLists = statusLists.map((s) =>
            s.id === selectedStatus.id
              ? {
                  ...s,
                  title: data.name,
                  color: data.color,
                }
              : s,
          )
          dispatch(setStatusLists(updatedLists))
          toast.success('Column updated', {
            description: `"${data.name}" has been updated.`,
          })
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'saveStatusList' } })
        toast.error(
          mode === 'create'
            ? 'Failed to create column'
            : 'Failed to update column',
          {
            description: 'Please try again.',
          },
        )
      }
    },
    [boardId, dispatch, statusLists, mode, selectedStatus],
  )

  /**
   * Request deletion - opens confirmation dialog
   */
  const requestDelete = useCallback((statusId: StatusListId) => {
    setPendingDeleteStatusId(statusId)
    setIsDeleteConfirmOpen(true)
  }, [])

  /**
   * Cancel delete - closes confirmation dialog
   */
  const cancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false)
    setPendingDeleteStatusId(null)
  }, [])

  /**
   * Confirm and execute delete
   */
  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteStatusId) return

    const targetStatus = statusLists.find((s) => s.id === pendingDeleteStatusId)
    if (!targetStatus) {
      setIsDeleteConfirmOpen(false)
      setPendingDeleteStatusId(null)
      return
    }

    try {
      await deleteStatusList(pendingDeleteStatusId, boardId)
      // Update Redux
      const filteredLists = statusLists.filter(
        (s) => s.id !== pendingDeleteStatusId,
      )
      dispatch(setStatusLists(filteredLists))
      toast.success('Column deleted', {
        description: `"${targetStatus.title}" has been deleted.`,
      })
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'deleteStatusList' } })
      toast.error('Failed to delete column', {
        description: 'Please try again.',
      })
    } finally {
      setIsDeleteConfirmOpen(false)
      setPendingDeleteStatusId(null)
    }
  }, [boardId, dispatch, statusLists, pendingDeleteStatusId])

  /**
   * Handle delete confirmation dialog open state change
   */
  const setDeleteConfirmOpen = useCallback((open: boolean) => {
    setIsDeleteConfirmOpen(open)
    if (!open) {
      setPendingDeleteStatusId(null)
    }
  }, [])

  return {
    isOpen,
    selectedStatus,
    mode,
    isDeleteConfirmOpen,
    pendingDeleteStatusId,
    pendingDeleteStatusTitle,
    openCreate,
    openEdit,
    close,
    save,
    requestDelete,
    cancelDelete,
    confirmDelete,
    setDeleteConfirmOpen,
  }
}
