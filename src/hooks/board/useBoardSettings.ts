/**
 * useBoardSettings Hook
 *
 * Manages board settings dialog state including:
 * - Dialog open/close state
 * - Display name (for optimistic rename)
 * - Display subtitle (for optimistic update)
 * - Card display settings
 * - Share slug while the board is shared by link
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
  /** Whether the board is shared by link when the page loads (default: false) */
  isPublic?: boolean
  /** The board's share slug; a board that was shared once keeps it while private */
  shareSlug?: string | null
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
  /** Share slug while the board is shared by link, `null` while it is private */
  publicShareSlug: string | null
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
  /** Handle the sharing switch being turned on or off */
  handlePublicChange: (isPublic: boolean, shareSlug: string | null) => void
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
 *   isPublic: board.is_public,
 *   shareSlug: board.share_slug,
 * })
 *
 * // In render
 * <BoardSettingsDialog
 *   isOpen={settings.isOpen}
 *   onClose={settings.close}
 *   onRenameSuccess={settings.handleRenameSuccess}
 *   onCardDisplayChange={settings.handleCardDisplayChange}
 *   onPublicChange={settings.handlePublicChange}
 *   ...
 * />
 */
export function useBoardSettings({
  boardName,
  boardSubtitle,
  boardSettings,
  isPublic = false,
  shareSlug = null,
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
  const [publicShareSlug, setPublicShareSlug] = useState<string | null>(
    isPublic ? shareSlug : null,
  )

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

  const handlePublicChange = useCallback(
    (nextIsPublic: boolean, nextShareSlug: string | null) => {
      // The slug outlives the switch being turned off, so it alone says nothing
      setPublicShareSlug(nextIsPublic ? nextShareSlug : null)
    },
    [],
  )

  return {
    isOpen,
    displayName,
    displaySubtitle,
    cardDisplaySettings,
    showSubtitle,
    publicShareSlug,
    open,
    close,
    handleRenameSuccess,
    handleSubtitleChange,
    handleCardDisplayChange,
    handleShowSubtitleChange,
    handlePublicChange,
  }
}
