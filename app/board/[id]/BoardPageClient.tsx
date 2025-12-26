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

import { Plus } from 'lucide-react'
import { useState, useCallback, memo } from 'react'

import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox'
import { KanbanBoard } from '@/components/Board/KanbanBoard'
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
import type { ProjectInfoData } from '@/lib/actions/project-info'
import { getProjectInfo, upsertProjectInfo } from '@/lib/actions/project-info'
import {
  moveToMaintenance,
  type CreatedRepoCard,
} from '@/lib/actions/repo-cards'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  setStatusLists,
  setRepoCards,
  addRepoCards,
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

interface BoardPageClientProps {
  boardId: string
  boardName: string
}

export const BoardPageClient = memo(function BoardPageClient({
  boardId,
  boardName,
}: BoardPageClientProps) {
  const dispatch = useAppDispatch()
  const statusLists = useAppSelector(selectStatusLists)
  const repoCards = useAppSelector(selectRepoCards)

  // Project Info Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [_isLoading, setIsLoading] = useState(false)

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
        quickNote: data?.quickNote || '',
        links: data?.links || [],
      })
      setIsModalOpen(true)
    } catch (error) {
      console.error('Failed to load project info:', error)
      // Open modal with empty state even on error
      setProjectInfo({
        id: cardId,
        quickNote: '',
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
              quickNote: data.quickNote,
              links: data.links,
            }
          : null,
      )

      try {
        // Backend save (asynchronous)
        await upsertProjectInfo(selectedCardId, data)

        // TODO: Update Redux state as well (implement in Phase 6)
        // dispatch(updateProjectInfo({ cardId: selectedCardId, data }));
      } catch (error) {
        console.error('Failed to save project info:', error)

        // Rollback on error
        try {
          const rollbackData = await getProjectInfo(selectedCardId)
          setProjectInfo({
            id: selectedCardId,
            quickNote: rollbackData?.quickNote || '',
            links: rollbackData?.links || [],
          })
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError)
        }

        // Notify user of error
        // TODO: Toast notification (implement in Phase 6)
        alert('Failed to save project information. Please try again.')
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
        console.error('Move to maintenance failed:', error)
        alert('Failed to move to maintenance. Please try again.')
      }
    },
    [repoCards, dispatch],
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
        setInitialNote(data?.quickNote || '')
      } catch (error) {
        console.error('Failed to load note:', error)
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
        quickNote: note,
        links: [],
        credentials: [],
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
    async (data: { name: string; color: string; wipLimit: number | null }) => {
      if (statusDialogMode === 'create') {
        // Create new
        const newStatus = await createStatusList(
          boardId,
          data.name,
          data.color,
          data.wipLimit ?? undefined,
        )
        // Update Redux
        dispatch(setStatusLists([...statusLists, newStatus]))
      } else if (selectedStatus) {
        // Update existing
        await updateStatusList(selectedStatus.id, {
          name: data.name,
          color: data.color,
          wipLimit: data.wipLimit,
        })
        // Update Redux
        const updatedLists = statusLists.map((s) =>
          s.id === selectedStatus.id
            ? {
                ...s,
                title: data.name,
                color: data.color,
                wipLimit: data.wipLimit ?? 0,
              }
            : s,
        )
        dispatch(setStatusLists(updatedLists))
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
      } catch (error) {
        console.error('Failed to delete status list:', error)
        alert('Failed to delete column. Please try again.')
      }
    },
    [boardId, dispatch, statusLists],
  )

  /**
   * Add card (future implementation)
   */
  const handleAddCard = useCallback((statusId: string) => {
    // TODO: Open AddRepositoryCombobox
    console.log('Add card to status:', statusId)
  }, [])

  return (
    <>
      <main className="flex h-screen flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {boardName}
            </h1>

            {/* Board operation buttons */}
            <div className="flex items-center gap-2">
              {/* Add Repositories - PRD 3.1 */}
              <AddRepositoryCombobox
                boardId={boardId}
                statusId={statusLists[0]?.id || ''} // Add to first column (empty string if none)
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
                      note: card.note,
                      order: card.order,
                      meta: card.meta,
                      createdAt: card.createdAt,
                      updatedAt: card.updatedAt,
                    }),
                  )
                  dispatch(addRepoCards(newCards))
                }}
                onQuickNoteFocus={() => {
                  // TODO: Focus on quick note field
                  console.log('Focus quick note')
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
              <Button variant="outline" size="sm">
                Board Settings
              </Button>
            </div>
          </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          <KanbanBoard
            boardId={boardId}
            onEditProjectInfo={handleEditProjectInfo}
            onMoveToMaintenance={handleMoveToMaintenance}
            onNote={handleOpenNote}
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
    </>
  )
})
