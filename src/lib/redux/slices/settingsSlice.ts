/**
 * Settings Slice
 *
 * User settings management (synchronized with LocalStorage)
 * - Theme
 * - Compact Mode
 * - Card Metadata visibility
 * - Organization Filter
 * - Sidebar collapsed state
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
}

const initialState: SettingsState = {
  theme: 'system',
  compactMode: false,
  showCardMetadata: true,
  organizationFilter: 'all',
  sidebarCollapsed: false,
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
  },
})

export const {
  setTheme,
  setCompactMode,
  setShowCardMetadata,
  setOrganizationFilter,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
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
