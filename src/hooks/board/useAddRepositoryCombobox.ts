/**
 * useAddRepositoryCombobox Hook
 *
 * Manages AddRepositoryCombobox state including:
 * - User-selected status ID
 * - Combobox open/close state
 * - Derived status ID for adding repos
 */

import { useSearchParams } from 'next/navigation'
import { useState, useCallback, useMemo } from 'react'

import type { StatusListDomain } from '@/lib/models/domain'
import type { StatusListId } from '@/lib/types/brands'

/** Carries the target column through GitHub reauthentication so the picker can resume. */
export const ADD_REPOSITORY_RETURN_PARAM = 'addRepositoryTo'

interface UseAddRepositoryComboboxParams {
  /** Status lists from Redux store */
  statusLists: StatusListDomain[]
}

interface UseAddRepositoryComboboxReturn {
  /** Whether the combobox is open */
  isOpen: boolean
  /** Derived status ID: user selection or first available column (null when no columns) */
  statusId: StatusListId | null
  /** Open combobox for a specific column */
  openForStatus: (statusId: StatusListId) => void
  /** Handle open state changes (resets to default when closing) */
  handleOpenChange: (open: boolean) => void
}

/**
 * Manages {@link AddRepositoryCombobox} state for {@link BoardPageClient}.
 * Restores the target column from the URL after GitHub reauthentication.
 *
 * Provides derived state that computes the target status ID:
 * - User-selected status when specified
 * - First column as default fallback
 *
 * @param params - Hook parameters including statusLists
 * @returns State and action handlers for add repository combobox
 *
 * @example
 * const addRepoCombobox = useAddRepositoryCombobox({ statusLists })
 *
 * // Open for specific column
 * <button onClick={() => addRepoCombobox.openForStatus(statusId)}>
 *   Add Repo
 * </button>
 *
 * // Render combobox
 * <AddRepositoryCombobox
 *   statusId={addRepoCombobox.statusId}
 *   isOpen={addRepoCombobox.isOpen}
 *   onOpenChange={addRepoCombobox.handleOpenChange}
 *   ...
 * />
 */
export function useAddRepositoryCombobox({
  statusLists,
}: UseAddRepositoryComboboxParams): UseAddRepositoryComboboxReturn {
  const searchParams = useSearchParams()
  const returnStatusId = searchParams.get(ADD_REPOSITORY_RETURN_PARAM)
  // Wait for Redux hydration and only restore a column belonging to this board.
  const resumedStatusId =
    statusLists.find((status) => status.id === returnStatusId)?.id ?? null

  // User-selected status ID (null = restore the target or use the first column)
  const [userSelectedStatusId, setUserSelectedStatusId] =
    useState<StatusListId | null>(null)
  const [isOpen, setIsOpen] = useState<boolean | null>(null)

  const statusId = useMemo<StatusListId | null>(() => {
    if (userSelectedStatusId) return userSelectedStatusId
    return resumedStatusId ?? statusLists[0]?.id ?? null
  }, [userSelectedStatusId, resumedStatusId, statusLists])

  /**
   * Opens the AddRepositoryCombobox for the specified column
   *
   * @param targetStatusId - The status list ID where new repos will be added
   */
  const openForStatus = useCallback((targetStatusId: StatusListId) => {
    setUserSelectedStatusId(targetStatusId)
    setIsOpen(true)
  }, [])

  /**
   * Handles AddRepositoryCombobox open state changes
   * Resets to default (first column) when closing
   */
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Reset to default (null = useMemo computes first column)
      setUserSelectedStatusId(null)
      // Consume the return marker so closing or adding does not reopen the picker.
      const url = new URL(window.location.href)
      if (url.searchParams.has(ADD_REPOSITORY_RETURN_PARAM)) {
        url.searchParams.delete(ADD_REPOSITORY_RETURN_PARAM)
        // Next.js preserves its router state and synchronizes search params for null data.
        window.history.replaceState(
          null,
          '',
          `${url.pathname}${url.search}${url.hash}`,
        )
      }
    }
  }, [])

  return {
    isOpen: isOpen ?? resumedStatusId !== null,
    statusId,
    openForStatus,
    handleOpenChange,
  }
}
