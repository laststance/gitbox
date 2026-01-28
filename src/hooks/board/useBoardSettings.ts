/**
 * useBoardSettings Hook
 *
 * Manages board settings dialog state including:
 * - Dialog open/close state
 * - Display name (for optimistic rename)
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
  /** Board settings JSON from database */
  boardSettings: unknown
}

interface UseBoardSettingsReturn {
  /** Whether the settings dialog is open */
  isOpen: boolean
  /** Current display name (may differ from DB during optimistic update) */
  displayName: string
  /** Card display settings */
  cardDisplaySettings: CardDisplaySettings
  /** Open the settings dialog */
  open: () => void
  /** Close the settings dialog */
  close: () => void
  /** Handle successful rename (optimistic update) */
  handleRenameSuccess: (newName: string) => void
  /** Handle card display settings change (optimistic update) */
  handleCardDisplayChange: (newSettings: CardDisplaySettings) => void
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
  boardSettings,
}: UseBoardSettingsParams): UseBoardSettingsReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [displayName, setDisplayName] = useState(boardName)
  const [cardDisplaySettings, setCardDisplaySettings] =
    useState<CardDisplaySettings>(() => {
      const parsed = parseBoardSettings(boardSettings)
      return parsed.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS
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

  const handleCardDisplayChange = useCallback(
    (newSettings: CardDisplaySettings) => {
      setCardDisplaySettings(newSettings)
    },
    [],
  )

  return {
    isOpen,
    displayName,
    cardDisplaySettings,
    open,
    close,
    handleRenameSuccess,
    handleCardDisplayChange,
  }
}
