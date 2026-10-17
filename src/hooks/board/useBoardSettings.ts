/**
 * useBoardSettings Hook
 *
 * Manages board settings dialog state including:
 * - Dialog open/close state
 * - Display name (for optimistic rename)
 * - Display subtitle (for optimistic update)
 * - Card display settings
 *
 * A refetch does not rebuild the page. The name, the subtitle and the card
 * display settings of a fetch that was applied replace what this tab shows,
 * except a field that still matches the last copy taken from the server: that
 * one was read before a save on this tab landed, and the save stays.
 *
 * Note: Theme is now managed globally via Redux and Sidebar ThemeToggle.
 */

import { useState, useCallback } from 'react'

import type { CardDisplaySettings } from '@/lib/types/board-settings'
import {
  adoptFetchedBoardDetails,
  shownBoardDetailsFromFetch,
  shownBoardDetailsFromProps,
  type FetchedBoardDetails,
  type ShownBoardDetails,
} from '@/lib/utils/adopt-fetched-board-details'

interface UseBoardSettingsParams {
  /**
   * Board the page is showing. When it changes, the name and the settings
   * reset to that board's props. Omitted by tests that never leave the board.
   */
  boardId?: string
  /** Initial board name */
  boardName: string
  /** Initial board subtitle (null if not set) */
  boardSubtitle: string | null
  /** Board settings JSON from database */
  boardSettings: unknown
  /**
   * Name, subtitle and settings of a refetch that was applied. `null` until
   * then. The same object until the next applied fetch: a new object on every
   * render never settles. A fetch of another board is ignored.
   */
  fetchedDetails?: FetchedBoardDetails | null
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
  boardId,
  boardName,
  boardSubtitle,
  boardSettings,
  fetchedDetails = null,
}: UseBoardSettingsParams): UseBoardSettingsReturn {
  const initial = shownBoardDetailsFromProps(
    boardName,
    boardSubtitle,
    boardSettings,
  )
  const [isOpen, setIsOpen] = useState(false)
  const [displayName, setDisplayName] = useState(initial.name)
  const [displaySubtitle, setDisplaySubtitle] = useState(initial.subtitle)
  const [cardDisplaySettings, setCardDisplaySettings] =
    useState<CardDisplaySettings>(initial.cardDisplay)
  const [showSubtitle, setShowSubtitle] = useState<boolean>(
    initial.showSubtitle,
  )
  // The last copy taken from the server. A save on this tab moves the screen
  // and leaves this, so a fetch that still has it does not undo the save.
  const [baseline, setBaseline] = useState<ShownBoardDetails>(initial)
  const [shownBoardId, setShownBoardId] = useState(boardId)
  const [seenDetails, setSeenDetails] = useState<FetchedBoardDetails | null>(
    null,
  )

  let screen: ShownBoardDetails = {
    name: displayName,
    subtitle: displaySubtitle,
    cardDisplay: cardDisplaySettings,
    showSubtitle,
  }
  let nextBaseline = baseline
  let nextSeen = seenDetails

  // The page moved to another board. Its props are the copy to show, and a
  // fetch of the board that was just left does not apply to this one.
  if (boardId !== shownBoardId) {
    const reset = shownBoardDetailsFromProps(
      boardName,
      boardSubtitle,
      boardSettings,
    )
    screen = reset
    nextBaseline = reset
    nextSeen = null
    setShownBoardId(boardId)
    setBaseline(reset)
    setSeenDetails(null)
    setDisplayName(reset.name)
    setDisplaySubtitle(reset.subtitle)
    setCardDisplaySettings(reset.cardDisplay)
    setShowSubtitle(reset.showSubtitle)
  }

  // A refetch was applied. Take the fields that differ from the last server
  // copy, and leave a field that copy still has so a save on this tab stays.
  if (
    fetchedDetails !== null &&
    fetchedDetails !== nextSeen &&
    (boardId === undefined || fetchedDetails.boardId === boardId)
  ) {
    const adopted = adoptFetchedBoardDetails(
      screen,
      nextBaseline,
      shownBoardDetailsFromFetch(fetchedDetails),
    )
    setSeenDetails(fetchedDetails)
    if (adopted.baseline !== nextBaseline) setBaseline(adopted.baseline)
    if (adopted.screen !== screen) {
      setDisplayName(adopted.screen.name)
      setDisplaySubtitle(adopted.screen.subtitle)
      setCardDisplaySettings(adopted.screen.cardDisplay)
      setShowSubtitle(adopted.screen.showSubtitle)
    }
  }

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
