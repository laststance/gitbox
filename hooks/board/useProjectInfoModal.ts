/**
 * useProjectInfoModal Hook
 *
 * Manages Project Info modal state including:
 * - Modal open/close state
 * - Selected card ID
 * - Project info data
 * - Loading state
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import type { ProjectInfo } from '@/components/Modals/ProjectInfoModal'
import type { ProjectInfoData } from '@/lib/actions/project-info'
import { getProjectInfo, upsertProjectInfo } from '@/lib/actions/project-info'

interface UseProjectInfoModalReturn {
  /** Whether the modal is open */
  isOpen: boolean
  /** Currently selected card ID */
  selectedCardId: string | null
  /** Project info data for the selected card */
  projectInfo: ProjectInfo | null
  /** Open modal and fetch project info for a card */
  openModal: (cardId: string) => Promise<void>
  /** Close modal and reset state */
  closeModal: () => void
  /** Save project info with optimistic update */
  saveProjectInfo: (data: ProjectInfoData) => Promise<void>
}

/**
 * Hook for managing Project Info modal state.
 *
 * Handles fetching, displaying, and saving project info with optimistic updates.
 *
 * @returns State and action handlers for project info modal
 *
 * @example
 * const projectInfoModal = useProjectInfoModal()
 *
 * // Open modal for a card
 * <button onClick={() => projectInfoModal.openModal(cardId)}>
 *   Edit Info
 * </button>
 *
 * // Render modal
 * {projectInfoModal.projectInfo && (
 *   <ProjectInfoModal
 *     isOpen={projectInfoModal.isOpen}
 *     onClose={projectInfoModal.closeModal}
 *     onSave={projectInfoModal.saveProjectInfo}
 *     projectInfo={projectInfoModal.projectInfo}
 *   />
 * )}
 */
export function useProjectInfoModal(): UseProjectInfoModalReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [, setIsLoading] = useState(false)

  /**
   * Open Project Info modal
   * Constitution requirement: Principle VI - TDD
   */
  const openModal = useCallback(async (cardId: string) => {
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
      setIsOpen(true)
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'loadProjectInfo' } })
      // Open modal with empty state even on error
      setProjectInfo({
        id: cardId,
        note: '',
        comment: '',
        links: [],
      })
      setIsOpen(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Close modal and reset state
   */
  const closeModal = useCallback(() => {
    setIsOpen(false)
    setSelectedCardId(null)
    setProjectInfo(null)
  }, [])

  /**
   * Save Project Info with optimistic update
   * Constitution requirement: Principle V - Security first
   * T069: Optimistic updates implementation
   */
  const saveProjectInfo = useCallback(
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

  return {
    isOpen,
    selectedCardId,
    projectInfo,
    openModal,
    closeModal,
    saveProjectInfo,
  }
}
