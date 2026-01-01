/**
 * useBoardSettings Hook
 *
 * Manages board settings dialog state including:
 * - Dialog open/close state
 * - Display name (for optimistic rename)
 * - Current theme
 * - Card display settings
 */

import { useState, useCallback, useLayoutEffect } from 'react'

import { applyTheme } from '@/lib/theme'
import type { CardDisplaySettings } from '@/lib/types/board-settings'
import {
  parseBoardSettings,
  DEFAULT_CARD_DISPLAY_SETTINGS,
} from '@/lib/types/board-settings'

interface UseBoardSettingsParams {
  /** Initial board name */
  boardName: string
  /** Initial board theme (nullable) */
  boardTheme: string | null
  /** Board settings JSON from database */
  boardSettings: unknown
}

interface UseBoardSettingsReturn {
  /** Whether the settings dialog is open */
  isOpen: boolean
  /** Current display name (may differ from DB during optimistic update) */
  displayName: string
  /** Current theme (may differ from DB during optimistic update) */
  currentTheme: string | null
  /** Card display settings */
  cardDisplaySettings: CardDisplaySettings
  /** Open the settings dialog */
  open: () => void
  /** Close the settings dialog */
  close: () => void
  /** Handle successful rename (optimistic update) */
  handleRenameSuccess: (newName: string) => void
  /** Handle theme change (optimistic update) */
  handleThemeChange: (newTheme: string) => void
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
 *   boardTheme: board.theme,
 *   boardSettings: board.settings,
 * })
 *
 * // In render
 * <BoardSettingsDialog
 *   isOpen={settings.isOpen}
 *   onClose={settings.close}
 *   onRenameSuccess={settings.handleRenameSuccess}
 *   ...
 * />
 */
export function useBoardSettings({
  boardName,
  boardTheme,
  boardSettings,
}: UseBoardSettingsParams): UseBoardSettingsReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [displayName, setDisplayName] = useState(boardName)
  const [currentTheme, setCurrentTheme] = useState<string | null>(
    boardTheme ?? null,
  )
  const [cardDisplaySettings, setCardDisplaySettings] =
    useState<CardDisplaySettings>(() => {
      const parsed = parseBoardSettings(boardSettings)
      return parsed.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS
    })

  // Apply board theme synchronously before paint
  // useLayoutEffect prevents flash of unstyled content on initial render
  useLayoutEffect(() => {
    if (currentTheme) {
      applyTheme(currentTheme as Parameters<typeof applyTheme>[0])
    }
  }, [currentTheme])

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

  const handleThemeChange = useCallback((newTheme: string) => {
    setCurrentTheme(newTheme)
    applyTheme(newTheme as Parameters<typeof applyTheme>[0])
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
    currentTheme,
    cardDisplaySettings,
    open,
    close,
    handleRenameSuccess,
    handleThemeChange,
    handleCardDisplayChange,
  }
}
