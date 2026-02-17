/**
 * Note Modal Hook for Maintenance Page
 *
 * Manages note modal state with lazy project info loading.
 * Uses a ref guard to prevent stale data when switching repos quickly.
 *
 * @example
 * const { noteModalOpen, openNoteModal, handleProjectInfoSave } =
 *   useMaintenanceNoteModal()
 */

import { useState, useCallback, useRef, useTransition } from 'react'

import { type ProjectLink } from '@/components/ui/editable-url-item'
import {
  getMaintenanceProjectInfo,
  upsertMaintenanceProjectInfo,
} from '@/lib/actions/maintenance-project-info'

import type { MaintenanceRepo } from '../MaintenanceClient'

/**
 * Hook for managing the maintenance note modal
 *
 * @returns Modal state, open/close handlers, and save handler
 */
export function useMaintenanceNoteModal() {
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
        const result = await getMaintenanceProjectInfo(repo.id)
        // Guard: only update if this repo is still active
        if (activeNoteRepoId.current !== repo.id) return
        if (result.success && result.data) {
          setCurrentNote(result.data.note || '')
          setCurrentLinks(result.data.links || [])
        } else {
          setCurrentNote('')
          setCurrentLinks([])
        }
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
      await upsertMaintenanceProjectInfo(selectedRepoForNote.id, {
        note,
        links,
      })
      setNoteModalOpen(false)
      setSelectedRepoForNote(null)
      setCurrentNote('')
      setCurrentLinks([])
    },
    [selectedRepoForNote],
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
