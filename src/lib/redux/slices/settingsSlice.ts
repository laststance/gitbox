/**
 * Settings Slice
 *
 * User settings management (synchronized with LocalStorage)
 * - Theme
 * - Compact Mode
 * - Card Metadata visibility
 * - Organization Filter
 * - Sidebar collapsed state
 * - Destination of the last move from each board
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { ThemeType } from '@/lib/constants/themes'
import type { OrganizationFilter } from '@/lib/types/domain-primitives'

/** Shape of the `state.settings` Redux slice. */
interface SettingsState {
  /** Active theme (one of the 14 themes or `'system'`). */
  theme: ThemeType
  /** Compact-mode toggle — denser spacing/typography when `true`. */
  compactMode: boolean
  /** Display stars, language, and last-updated chips on repo cards. */
  showCardMetadata: boolean
  /**
   * Current filter in the "Add repository" picker.
   * Either `'all'` (no filter) or a GitHub org login.
   */
  organizationFilter: OrganizationFilter
  /** `true` when the sidebar is collapsed to icon-only view. */
  sidebarCollapsed: boolean
  /**
   * For each board a card was moved away from, the board that move went to
   * (board ids on both sides). {@link MoveToAnotherBoardDialog} opens on that
   * destination the next time, so setting several cards aside takes no
   * picking. This browser only.
   *
   * Optional: state persisted before the field existed has no such key, and
   * the storage middleware puts the persisted slice in place of the initial
   * one as a whole.
   */
  moveDestinationByBoard?: Record<string, string>
}

const initialState: SettingsState = {
  theme: 'system',
  compactMode: false,
  showCardMetadata: true,
  organizationFilter: 'all',
  sidebarCollapsed: false,
  moveDestinationByBoard: {},
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeType>) => {
      state.theme = action.payload
    },
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload
    },
    setShowCardMetadata: (state, action: PayloadAction<boolean>) => {
      state.showCardMetadata = action.payload
    },
    setOrganizationFilter: (
      state,
      action: PayloadAction<OrganizationFilter>,
    ) => {
      state.organizationFilter = action.payload
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    /**
     * Remembers where the last move from a board went. Dispatched by
     * {@link MoveToAnotherBoardDialog} after a move succeeded.
     *
     * @param action.payload.sourceBoardId - Board the card was moved from.
     * @param action.payload.destinationBoardId - Board the card was moved to.
     */
    setMoveDestination: (
      state,
      action: PayloadAction<{
        sourceBoardId: string
        destinationBoardId: string
      }>,
    ) => {
      // Spread, not an assignment into the map: the map is missing in state
      // persisted before the field existed
      state.moveDestinationByBoard = {
        ...state.moveDestinationByBoard,
        [action.payload.sourceBoardId]: action.payload.destinationBoardId,
      }
    },
  },
})

export const {
  setTheme,
  setCompactMode,
  setShowCardMetadata,
  setOrganizationFilter,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  setMoveDestination,
} = settingsSlice.actions

export default settingsSlice.reducer

// Selectors
/**
 * Selector for theme with safe default during hydration
 * @param state - Redux state with settings slice
 * @returns Theme value, defaults to 'system' if state is hydrating
 */
export const selectTheme = (state: { settings?: SettingsState }) =>
  state.settings?.theme ?? 'system'
export const selectCompactMode = (state: { settings: SettingsState }) =>
  state.settings.compactMode
export const selectShowCardMetadata = (state: { settings: SettingsState }) =>
  state.settings.showCardMetadata
/**
 * Selector for organization filter with safe default
 * @param state - Redux state with settings slice
 * @returns Organization filter value, defaults to 'all' if state is hydrating
 */
export const selectOrganizationFilter = (state: { settings?: SettingsState }) =>
  state.settings?.organizationFilter ?? 'all'

/**
 * Selector for sidebar collapsed state with safe default
 * @param state - Redux state with settings slice
 * @returns Sidebar collapsed value, defaults to false (expanded) if state is hydrating
 */
export const selectSidebarCollapsed = (state: { settings?: SettingsState }) =>
  state.settings?.sidebarCollapsed ?? false

/**
 * Reads the board the last move from a board went to. Called by
 * {@link MoveToAnotherBoardDialog} to choose the board it opens on.
 *
 * @param state - Redux state with settings slice
 * @param sourceBoardId - Board the card is about to be moved from.
 * @returns
 * - the destination board id of the last move from that board
 * - `undefined` when no card was moved from it in this browser yet, and while
 *   the state is hydrating
 * @example
 * selectMoveDestination(state, 'board-work') // => 'board-archive'
 */
export const selectMoveDestination = (
  state: { settings?: SettingsState },
  sourceBoardId: string,
): string | undefined => state.settings?.moveDestinationByBoard?.[sourceBoardId]
