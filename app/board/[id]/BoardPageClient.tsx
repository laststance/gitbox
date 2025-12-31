/**
 * Board Page Client Component
 *
 * Constitution requirements:
 * - Principle V: Security first
 * - Principle VI: TDD - Test-driven development
 *
 * User Story 4:
 * - Project Info modal integration
 * - Optimistic UI updates
 *
 * PRD 3.2:
 * - StatusList CRUD operations
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { Plus, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useState,
  useCallback,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react'
import { toast } from 'sonner'

import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox'
import { KanbanBoard } from '@/components/Board/KanbanBoard'
import { BoardSettingsDialog } from '@/components/Boards/BoardSettingsDialog'
import { NoteModal } from '@/components/Modals/NoteModal'
import type { ProjectInfo } from '@/components/Modals/ProjectInfoModal'
import { ProjectInfoModal } from '@/components/Modals/ProjectInfoModal'
import { StatusListDialog } from '@/components/Modals/StatusListDialog'
import { Button } from '@/components/ui/button'
import {
  createStatusList,
  updateStatusList,
  deleteStatusList,
} from '@/lib/actions/board'
import type { BoardInitialData } from '@/lib/actions/board-data'
import type { ProjectInfoData } from '@/lib/actions/project-info'
import { getProjectInfo, upsertProjectInfo } from '@/lib/actions/project-info'
import {
  moveToMaintenance,
  deleteRepoCard,
  type CreatedRepoCard,
} from '@/lib/actions/repo-cards'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  setStatusLists,
  setRepoCards,
  setActiveBoard,
  addRepoCards,
  removeRepoCard,
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { Board } from '@/lib/supabase/types'
import { applyTheme } from '@/lib/theme'
import type { CardDisplaySettings } from '@/lib/types/board-settings'
import {
  parseBoardSettings,
  DEFAULT_CARD_DISPLAY_SETTINGS,
} from '@/lib/types/board-settings'

interface BoardPageClientProps {
  /** Full board object from Supabase */
  board: Board
  /** Initial data fetched by Server Component (Phase 4) */
  initialData: BoardInitialData
}

export const BoardPageClient = memo(function BoardPageClient({
  board,
  initialData,
}: BoardPageClientProps) {
  // Extract board properties
  const boardId = board.id
  const boardName = board.name
  const boardTheme = board.theme

  const router = useRouter()
  const dispatch = useAppDispatch()
  const statusLists = useAppSelector(selectStatusLists)
  const repoCards = useAppSelector(selectRepoCards)

  // Phase 4: Hydrate Redux store with server-fetched data
  // useLayoutEffect ensures data is available before first paint (no flicker)
  useLayoutEffect(() => {
    dispatch(setStatusLists(initialData.statusLists))
    dispatch(setRepoCards(initialData.repoCards))
  }, [dispatch, initialData.statusLists, initialData.repoCards])

  // Board Settings Dialog state
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false)
  const [displayName, setDisplayName] = useState(boardName)
  const [currentTheme, setCurrentTheme] = useState<string | null>(
    boardTheme ?? null,
  )
  // Card display settings (parsed from board.settings JSON)
  const [cardDisplaySettings, setCardDisplaySettings] =
    useState<CardDisplaySettings>(() => {
      const parsed = parseBoardSettings(board.settings)
      return parsed.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS
    })

  // Set activeBoard in Redux on mount
  // This enables other components to know which board is currently being viewed
  useEffect(() => {
    dispatch(setActiveBoard(board))
    return () => {
      // Clear activeBoard when leaving the page
      dispatch(setActiveBoard(null))
    }
  }, [dispatch, board])

  // Apply board theme synchronously before paint
  // useLayoutEffect prevents flash of unstyled content on initial render
  useLayoutEffect(() => {
    if (currentTheme) {
      applyTheme(currentTheme as Parameters<typeof applyTheme>[0])
    }
  }, [currentTheme])

  // Project Info Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [, setIsLoading] = useState(false)

  // StatusList Dialog state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<StatusListDomain | null>(
    null,
  )
  const [statusDialogMode, setStatusDialogMode] = useState<'create' | 'edit'>(
    'create',
  )

  // NoteModal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [noteCardId, setNoteCardId] = useState<string | null>(null)
  const [noteCardTitle, setNoteCardTitle] = useState('')
  const [initialNote, setInitialNote] = useState('')

  // AddRepositoryCombobox controlled state
  // User-selected status ID (null = use default first column)
  const [userSelectedStatusId, setUserSelectedStatusId] = useState<
    string | null
  >(null)
  const [isAddRepoComboboxOpen, setIsAddRepoComboboxOpen] = useState(false)

  // Derived: user selection or first available column
  // No useEffect needed - computed directly from state
  const addRepoStatusId = useMemo(() => {
    if (userSelectedStatusId) return userSelectedStatusId
    if (statusLists.length > 0) return statusLists[0].id
    return ''
  }, [userSelectedStatusId, statusLists])

  /**
   * Open Project Info modal
   * Constitution requirement: Principle VI - TDD
   */
  const handleEditProjectInfo = useCallback(async (cardId: string) => {
    setSelectedCardId(cardId)
    setIsLoading(true)

    try {
      // Fetch Project Info
      const data = await getProjectInfo(cardId)
      setProjectInfo({
        id: cardId,
        note: data?.note || '',
        comment: data?.comment || '',
        links: data?.links || [],
      })
      setIsModalOpen(true)
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'loadProjectInfo' } })
      // Open modal with empty state even on error
      setProjectInfo({
        id: cardId,
        note: '',
        comment: '',
        links: [],
      })
      setIsModalOpen(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Save Project Info (Optimistic Update)
   * Constitution requirement: Principle V - Security first
   * T069: Optimistic updates implementation
   */
  const handleSaveProjectInfo = useCallback(
    async (data: ProjectInfoData) => {
      if (!selectedCardId) return

      // Optimistic Update: Immediately update UI
      setProjectInfo((prev) =>
        prev
          ? {
              ...prev,
              note: data.note,
              comment: data.comment,
              links: data.links,
            }
          : null,
      )

      try {
        // Backend save (asynchronous)
        await upsertProjectInfo(selectedCardId, data)
        toast.success('Project info saved', {
          description: 'Your project information has been saved.',
        })

        // TODO: Update Redux state as well (implement in Phase 6)
        // dispatch(updateProjectInfo({ cardId: selectedCardId, data }));
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'saveProjectInfo' } })

        // Rollback on error
        try {
          const rollbackData = await getProjectInfo(selectedCardId)
          setProjectInfo({
            id: selectedCardId,
            note: rollbackData?.note || '',
            comment: rollbackData?.comment || '',
            links: rollbackData?.links || [],
          })
        } catch (rollbackError) {
          Sentry.captureException(rollbackError, {
            tags: { action: 'saveProjectInfoRollback' },
          })
        }

        toast.error('Failed to save project info', {
          description: 'Please try again.',
        })
      }
    },
    [selectedCardId],
  )

  /**
   * Close modal
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedCardId(null)
    setProjectInfo(null)
  }, [])

  /**
   * Move to Maintenance Mode
   *
   * Transfers a card from the active board to maintenance archive.
   * Uses optimistic UI update for immediate feedback.
   *
   * @param cardId - The card ID to move to maintenance
   */
  const handleMoveToMaintenance = useCallback(
    async (cardId: string) => {
      // Find card to remove for optimistic update
      const cardToRemove = repoCards.find((c) => c.id === cardId)
      if (!cardToRemove) return

      // Optimistic update: remove from state immediately
      const previousCards = repoCards
      dispatch(setRepoCards(repoCards.filter((c) => c.id !== cardId)))

      try {
        const result = await moveToMaintenance(cardId)
        if (!result.success) {
          // Revert on error
          dispatch(setRepoCards(previousCards))
          alert(`Failed to move to maintenance: ${result.error}`)
        }
      } catch (error) {
        // Revert on error
        dispatch(setRepoCards(previousCards))
        Sentry.captureException(error, {
          tags: { action: 'moveToMaintenance' },
        })
        alert('Failed to move to maintenance. Please try again.')
      }
    },
    [repoCards, dispatch],
  )

  /**
   * Remove Repository from Board
   *
   * Permanently deletes a card from the board.
   * Uses optimistic UI update for immediate feedback.
   *
   * @param cardId - The card ID to remove
   */
  const handleRemoveFromBoard = useCallback(
    async (cardId: string) => {
      // Optimistic update: remove from state immediately
      dispatch(removeRepoCard(cardId))

      try {
        const result = await deleteRepoCard(cardId)
        if (!result.success) {
          // Revert on error - refetch data
          Sentry.captureMessage('Delete repo card failed', {
            level: 'error',
            tags: { action: 'deleteRepoCard' },
            extra: { error: result.error },
          })
          toast.error('Failed to remove from board', {
            description: result.error,
          })
          // Note: We'd need to restore the card here, but since we don't have
          // a simple way to get it back, we'll just alert the user
        } else {
          toast.success('Repository removed', {
            description: 'The repository has been removed from the board.',
          })
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'removeFromBoard' } })
        toast.error('Failed to remove from board', {
          description: 'Please try again.',
        })
      }
    },
    [dispatch],
  )

  // ========================================
  // NoteModal handlers
  // ========================================

  /**
   * Open NoteModal for a card
   * Fetches current note from Supabase
   */
  const handleOpenNote = useCallback(
    async (cardId: string) => {
      const card = repoCards.find((c) => c.id === cardId)
      if (!card) return

      setNoteCardId(cardId)
      setNoteCardTitle(card.title)

      try {
        const data = await getProjectInfo(cardId)
        setInitialNote(data?.note || '')
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'loadNote' } })
        setInitialNote('')
      }

      setIsNoteModalOpen(true)
    },
    [repoCards],
  )

  /**
   * Save note to Supabase
   * Called by NoteModal with optimistic update
   */
  const handleSaveNote = useCallback(
    async (note: string) => {
      if (!noteCardId) return

      await upsertProjectInfo(noteCardId, {
        note: note,
        comment: '',
        links: [],
      })
    },
    [noteCardId],
  )

  /**
   * Close NoteModal
   */
  const handleCloseNote = useCallback(() => {
    setIsNoteModalOpen(false)
    setNoteCardId(null)
    setNoteCardTitle('')
    setInitialNote('')
  }, [])

  // ========================================
  // StatusList CRUD handlers
  // ========================================

  /**
   * Open StatusList add dialog
   */
  const handleOpenAddStatus = useCallback(() => {
    setSelectedStatus(null)
    setStatusDialogMode('create')
    setIsStatusDialogOpen(true)
  }, [])

  /**
   * Open StatusList edit dialog
   */
  const handleEditStatus = useCallback((status: StatusListDomain) => {
    setSelectedStatus(status)
    setStatusDialogMode('edit')
    setIsStatusDialogOpen(true)
  }, [])

  /**
   * Save StatusList (create/update)
   */
  const handleSaveStatus = useCallback(
    async (data: { name: string; color: string }) => {
      try {
        if (statusDialogMode === 'create') {
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
          statusDialogMode === 'create'
            ? 'Failed to create column'
            : 'Failed to update column',
          {
            description: 'Please try again.',
          },
        )
      }
    },
    [boardId, dispatch, statusLists, statusDialogMode, selectedStatus],
  )

  /**
   * Delete StatusList
   */
  const handleDeleteStatus = useCallback(
    async (statusId: string) => {
      const targetStatus = statusLists.find((s) => s.id === statusId)
      if (!targetStatus) return

      // Confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to delete "${targetStatus.title}"? This action cannot be undone.`,
      )
      if (!confirmed) return

      try {
        await deleteStatusList(statusId, boardId)
        // Update Redux
        const filteredLists = statusLists.filter((s) => s.id !== statusId)
        dispatch(setStatusLists(filteredLists))
        toast.success('Column deleted', {
          description: `"${targetStatus.title}" has been deleted.`,
        })
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'deleteStatusList' } })
        toast.error('Failed to delete column', {
          description: 'Please try again.',
        })
      }
    },
    [boardId, dispatch, statusLists],
  )

  /**
   * Opens the AddRepositoryCombobox for the specified column
   *
   * @param statusId - The status list ID where new repos will be added
   * @example
   * // Clicking "Add Repo" button in a column
   * handleAddCard("status-123") // Opens combobox targeting that column
   */
  const handleAddCard = useCallback((statusId: string) => {
    setUserSelectedStatusId(statusId)
    setIsAddRepoComboboxOpen(true)
  }, [])

  /**
   * Handles AddRepositoryCombobox open state changes
   * Resets to default (first column) when closing
   */
  const handleAddRepoOpenChange = useCallback((open: boolean) => {
    setIsAddRepoComboboxOpen(open)
    if (!open) {
      // Reset to default (null = useMemo computes first column)
      setUserSelectedStatusId(null)
    }
  }, [])

  // ========================================
  // Board Settings Dialog handlers
  // ========================================

  /**
   * Open Board Settings dialog
   */
  const handleOpenBoardSettings = useCallback(() => {
    setIsBoardSettingsOpen(true)
  }, [])

  /**
   * Close Board Settings dialog
   * IMPORTANT: Must be stable (useCallback with empty deps) to prevent
   * infinite loops in BoardSettingsDialog effects that depend on onClose.
   */
  const handleCloseBoardSettings = useCallback(() => {
    setIsBoardSettingsOpen(false)
  }, [])

  /**
   * Handle board rename success (optimistic update)
   */
  const handleRenameSuccess = useCallback((newName: string) => {
    setDisplayName(newName)
  }, [])

  /**
   * Handle theme change (optimistic update)
   */
  const handleThemeChange = useCallback((newTheme: string) => {
    setCurrentTheme(newTheme)
    applyTheme(newTheme as Parameters<typeof applyTheme>[0])
  }, [])

  /**
   * Handle board delete success
   */
  const handleDeleteSuccess = useCallback(() => {
    router.push('/boards')
  }, [router])

  /**
   * Handle card display settings change (optimistic update)
   */
  const handleCardDisplayChange = useCallback(
    (newSettings: CardDisplaySettings) => {
      setCardDisplaySettings(newSettings)
    },
    [],
  )

  return (
    <>
      <main className="flex h-screen flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {displayName}
            </h1>

            {/* Board operation buttons */}
            <div className="flex items-center gap-2">
              {/* Add Repositories - PRD 3.1 */}
              <AddRepositoryCombobox
                boardId={boardId}
                statusId={addRepoStatusId || statusLists[0]?.id || ''}
                isOpen={isAddRepoComboboxOpen}
                onOpenChange={handleAddRepoOpenChange}
                onRepositoriesAdded={(createdCards: CreatedRepoCard[]) => {
                  // Optimistic UI update: Add cards to Redux state immediately
                  // No page reload needed - cards appear instantly
                  const newCards: RepoCardForRedux[] = createdCards.map(
                    (card) => ({
                      id: card.id,
                      title: `${card.repoOwner}/${card.repoName}`,
                      description:
                        (card.meta as { description?: string })?.description ||
                        '',
                      statusId: card.statusId,
                      boardId: card.boardId,
                      repoOwner: card.repoOwner,
                      repoName: card.repoName,
                      order: card.order,
                      meta: card.meta,
                      createdAt: card.createdAt,
                      updatedAt: card.updatedAt,
                    }),
                  )
                  dispatch(addRepoCards(newCards))
                }}
                onQuickNoteFocus={() => {
                  // TODO: Focus on quick note field (not yet implemented)
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddStatus}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenBoardSettings}
                className="gap-1"
              >
                <Settings className="h-4 w-4" />
                Board Settings
              </Button>
            </div>
          </div>
        </header>

        {/* Kanban Board - horizontal scroll enabled for 6+ columns */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <KanbanBoard
            boardId={boardId}
            initialComments={initialData.comments}
            cardDisplaySettings={cardDisplaySettings}
            onEditProjectInfo={handleEditProjectInfo}
            onMoveToMaintenance={handleMoveToMaintenance}
            onNote={handleOpenNote}
            onRemove={handleRemoveFromBoard}
            onEditStatus={handleEditStatus}
            onDeleteStatus={handleDeleteStatus}
            onAddCard={handleAddCard}
          />
        </div>
      </main>

      {/* Project Info Modal */}
      {projectInfo && (
        <ProjectInfoModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveProjectInfo}
          projectInfo={projectInfo}
        />
      )}

      {/* StatusList Dialog */}
      <StatusListDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        onSave={handleSaveStatus}
        statusList={selectedStatus}
        mode={statusDialogMode}
      />

      {/* NoteModal */}
      {noteCardId && (
        <NoteModal
          isOpen={isNoteModalOpen}
          onClose={handleCloseNote}
          onSave={handleSaveNote}
          cardId={noteCardId}
          initialNote={initialNote}
          cardTitle={noteCardTitle}
        />
      )}

      {/* Board Settings Dialog */}
      <BoardSettingsDialog
        isOpen={isBoardSettingsOpen}
        onClose={handleCloseBoardSettings}
        boardId={boardId}
        boardName={displayName}
        currentTheme={currentTheme}
        boardSettings={parseBoardSettings(board.settings)}
        onRenameSuccess={handleRenameSuccess}
        onThemeChange={handleThemeChange}
        onCardDisplayChange={handleCardDisplayChange}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  )
})
