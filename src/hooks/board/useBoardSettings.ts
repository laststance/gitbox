/**
 * useBoardSettings Hook
 *
 * Manages board settings dialog state including:
 * - Dialog open/close state
 * - Display name (for optimistic rename)
 * - Display subtitle (for optimistic update)
 * - Card display settings
 *
 * Note: Theme is now managed globally via Redux and Sidebar ThemeToggle.
 */

import { useState, useCallback } from 'react'

import type { CardDisplaySettings } from '@/lib/types/board-settings'
import {
  parseBoardSettings,
  DEFAULT_CARD_DISPLAY_SETTINGS,
} from '@/lib/types/board-settings'

interface UseBoardSettingsParams {
  /** Initial board name */
  boardName: string
  /** Initial board subtitle (null if not set) */
  boardSubtitle: string | null
  /** Board settings JSON from database */
  boardSettings: unknown
}

interface UseBoardSettingsReturn {
  /** Whether the settings dialog is open */
  isOpen: boolean
  /** Current display name (may differ from DB during optimistic update) */
  displayName: string
  /** Current display subtitle (empty string if not set) */
  displaySubtitle: string
  /** Card display settings */
  cardDisplaySettings: CardDisplaySettings
  /** Whether to show subtitle in the board header */
  showSubtitle: boolean
  /** Open the settings dialog */
  open: () => void
  /** Close the settings dialog */
  close: () => void
  /** Handle successful rename (optimistic update) */
  handleRenameSuccess: (newName: string) => void
  /** Handle successful subtitle change (optimistic update) */
  handleSubtitleChange: (newSubtitle: string) => void
  /** Handle card display settings change (optimistic update) */
  handleCardDisplayChange: (newSettings: CardDisplaySettings) => void
  /** Handle show subtitle toggle change (optimistic update) */
  handleShowSubtitleChange: (show: boolean) => void
}

/**
 * Hook for managing board settings dialog state.
 *
 * @param params - Initial board data
 * @returns State and action handlers for board settings
 *
 * @example
 * const settings = useBoardSettings({
 *   boardName: board.name,
 *   boardSubtitle: board.subtitle,
 *   boardSettings: board.settings,
 * })
 *
 * // In render
 * <BoardSettingsDialog
 *   isOpen={settings.isOpen}
 *   onClose={settings.close}
 *   onRenameSuccess={settings.handleRenameSuccess}
 *   onCardDisplayChange={settings.handleCardDisplayChange}
 *   ...
 * />
 */
export function useBoardSettings({
  boardName,
  boardSubtitle,
  boardSettings,
}: UseBoardSettingsParams): UseBoardSettingsReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [displayName, setDisplayName] = useState(boardName)
  const [displaySubtitle, setDisplaySubtitle] = useState(boardSubtitle ?? '')
  const [cardDisplaySettings, setCardDisplaySettings] =
    useState<CardDisplaySettings>(() => {
      const parsed = parseBoardSettings(boardSettings)
      return parsed.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS
    })
  const [showSubtitle, setShowSubtitle] = useState<boolean>(() => {
    const parsed = parseBoardSettings(boardSettings)
    return parsed.showSubtitle ?? true
  })

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  // IMPORTANT: Must be stable (useCallback with empty deps) to prevent
  // infinite loops in BoardSettingsDialog effects that depend on onClose.
  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleRenameSuccess = useCallback((newName: string) => {
    setDisplayName(newName)
  }, [])

  const handleSubtitleChange = useCallback((newSubtitle: string) => {
    setDisplaySubtitle(newSubtitle)
  }, [])

  const handleCardDisplayChange = useCallback(
    (newSettings: CardDisplaySettings) => {
      setCardDisplaySettings(newSettings)
    },
    [],
  )

  const handleShowSubtitleChange = useCallback((show: boolean) => {
    setShowSubtitle(show)
  }, [])

  return {
    isOpen,
    displayName,
    displaySubtitle,
    cardDisplaySettings,
    showSubtitle,
    open,
    close,
    handleRenameSuccess,
    handleSubtitleChange,
    handleCardDisplayChange,
    handleShowSubtitleChange,
  }
}
