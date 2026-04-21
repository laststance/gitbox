/**
 * useAddRepositoryCombobox Hook
 *
 * Manages AddRepositoryCombobox state including:
 * - User-selected status ID
 * - Combobox open/close state
 * - Derived status ID for adding repos
 */

import { useState, useCallback, useMemo } from 'react'

import type { StatusListDomain } from '@/lib/models/domain'
import type { StatusListId } from '@/lib/types/brands'

interface UseAddRepositoryComboboxParams {
  /** Status lists from Redux store */
  statusLists: StatusListDomain[]
}

interface UseAddRepositoryComboboxReturn {
  /** Whether the combobox is open */
  isOpen: boolean
  /** Derived status ID: user selection or first available column (empty string when no columns) */
  statusId: StatusListId | ''
  /** Open combobox for a specific column */
  openForStatus: (statusId: StatusListId) => void
  /** Handle open state changes (resets to default when closing) */
  handleOpenChange: (open: boolean) => void
}

/**
 * Hook for managing AddRepositoryCombobox state.
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
  // User-selected status ID (null = use default first column)
  const [userSelectedStatusId, setUserSelectedStatusId] =
    useState<StatusListId | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Derived: user selection or first available column
  // No useEffect needed - computed directly from state
  const statusId = useMemo<StatusListId | ''>(() => {
    if (userSelectedStatusId) return userSelectedStatusId
    if (statusLists.length > 0) return statusLists[0]?.id ?? ''
    return ''
  }, [userSelectedStatusId, statusLists])

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
    }
  }, [])

  return {
    isOpen,
    statusId,
    openForStatus,
    handleOpenChange,
  }
}
