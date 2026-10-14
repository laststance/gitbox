/**
 * Board-related custom hooks
 *
 * These hooks extract state management logic from BoardPageClient
 * to reduce complexity and improve testability.
 */

export { useBoardSettings } from './useBoardSettings'
export { useStatusListDialog } from './useStatusListDialog'
export { useNoteModal } from './useNoteModal'
export { useNoteModalDraft } from './useNoteModalDraft'
export { useAddRepositoryCombobox } from './useAddRepositoryCombobox'
export { useOptimisticCardAction } from './useOptimisticCardAction'
export { useRepositoryCatalog } from './useRepositoryCatalog'
export { useRepositorySearch } from './useRepositorySearch'
export { useRepoPlacements } from './useRepoPlacements'
export { useMoveDestinations } from './useMoveDestinations'
export { useMoveDialogState } from './useMoveDialogState'
export { useCardDialogFocusReturn } from './useCardDialogFocusReturn'
export { useKanbanDnD, forgivingCollisionDetection } from './useKanbanDnD'
export { useKanbanUndo } from './useKanbanUndo'
export { useBoardRollback } from './useBoardRollback'
export { useBoardServerSync } from './useBoardServerSync'
export { useCommentState } from './useCommentState'
