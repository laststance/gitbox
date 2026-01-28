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

interface SettingsState {
  theme: ThemeType
  compactMode: boolean
  /** Display stars, language, and last updated on cards */
  showCardMetadata: boolean
  /** Organization filter for AddRepositoryCombobox ('all' or organization login name) */
  organizationFilter: string
  /** Whether the sidebar is collapsed to icon-only view */
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
    setOrganizationFilter: (state, action: PayloadAction<string>) => {
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
