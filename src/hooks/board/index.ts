/**
 * Board-related custom hooks
 *
 * These hooks extract state management logic from BoardPageClient
 * to reduce complexity and improve testability.
 */

export { useBoardSettings } from './useBoardSettings'
export { useStatusListDialog } from './useStatusListDialog'
export { useNoteModal } from './useNoteModal'
export { useAddRepositoryCombobox } from './useAddRepositoryCombobox'
export { useOptimisticCardAction } from './useOptimisticCardAction'
export { useOrganizationData } from './useOrganizationData'
export { useRepositoryData } from './useRepositoryData'
export { useRepositorySearch } from './useRepositorySearch'
export { useKanbanDnD, forgivingCollisionDetection } from './useKanbanDnD'
