/**
 * Note Modal Hook for Maintenance Page
 *
 * Manages note modal state with lazy project info loading.
 * Uses a ref guard to prevent stale data when switching repos quickly.
 *
 * @example
 * const { noteModalOpen, openNoteModal, handleProjectInfoSave } =
 *   useMaintenanceNoteModal({ comments })
 */

import { useState, useCallback, useRef, useTransition } from 'react'

import { type ProjectLink } from '@/components/ui/editable-url-item'
import {
  getMaintenanceProjectInfo,
  upsertMaintenanceProjectInfo,
  type CommentData,
} from '@/lib/actions/maintenance-project-info'

import type { MaintenanceRepo } from '../MaintenanceClient'

interface UseMaintenanceNoteModalProps {
  /** Current comments state (needed to preserve comment on project info save) */
  comments: Record<string, CommentData>
}

/**
 * Hook for managing the maintenance note modal
 *
 * @param props.comments - Current comments state for preserving on save
 * @returns Modal state, open/close handlers, and save handler
 */
export function useMaintenanceNoteModal({
  comments,
}: UseMaintenanceNoteModalProps) {
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedRepoForNote, setSelectedRepoForNote] =
    useState<MaintenanceRepo | null>(null)
  const [currentNote, setCurrentNote] = useState<string>('')
  const [currentLinks, setCurrentLinks] = useState<ProjectLink[]>([])
  const [, startLoadingProjectInfo] = useTransition()
  // Guard for async project info fetch - prevents stale data on repo switch
  const activeNoteRepoId = useRef<string | null>(null)

  /**
   * Open note modal for a specific repo.
   * Uses activeNoteRepoId ref to guard against stale data on repo switch.
   */
  const openNoteModal = useCallback((repo: MaintenanceRepo) => {
    activeNoteRepoId.current = repo.id
    setSelectedRepoForNote(repo)
    setNoteModalOpen(true)
    // Reset state before async load to prevent showing stale data
    setCurrentNote('')
    setCurrentLinks([])
    // Lazy load project info with guard
    startLoadingProjectInfo(async () => {
      try {
        const data = await getMaintenanceProjectInfo(repo.id)
        // Guard: only update if this repo is still active
        if (activeNoteRepoId.current !== repo.id) return
        setCurrentNote(data?.note || '')
        setCurrentLinks(data?.links || [])
      } catch {
        // Guard: only reset if this repo is still active
        if (activeNoteRepoId.current !== repo.id) return
        setCurrentNote('')
        setCurrentLinks([])
      }
    })
  }, [])

  /**
   * Handle saving project info from modal
   */
  const handleProjectInfoSave = useCallback(
    async (note: string, links: ProjectLink[]) => {
      if (!selectedRepoForNote) return
      const currentComment = comments[selectedRepoForNote.id]?.comment || ''
      await upsertMaintenanceProjectInfo(selectedRepoForNote.id, {
        note,
        comment: currentComment,
        links,
      })
      setNoteModalOpen(false)
      setSelectedRepoForNote(null)
      setCurrentNote('')
      setCurrentLinks([])
    },
    [selectedRepoForNote, comments],
  )

  /**
   * Close the note modal and reset state
   */
  const closeNoteModal = useCallback(() => {
    setNoteModalOpen(false)
    setSelectedRepoForNote(null)
    activeNoteRepoId.current = null
    setCurrentNote('')
    setCurrentLinks([])
  }, [])

  return {
    noteModalOpen,
    selectedRepoForNote,
    currentNote,
    currentLinks,
    openNoteModal,
    handleProjectInfoSave,
    closeNoteModal,
  }
}
