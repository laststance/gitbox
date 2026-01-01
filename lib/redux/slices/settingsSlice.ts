/**
 * Settings Slice
 *
 * User settings management (synchronized with LocalStorage)
 * - Theme
 * - Typography
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { Theme } from '@/lib/supabase/types'

interface TypographySettings {
  baseSize: number // 14-18px
  scale: number // 1.2-1.4
}

interface SettingsState {
  theme: Theme
  typography: TypographySettings
  compactMode: boolean
  /** Display stars, language, and last updated on cards */
  showCardMetadata: boolean
  /** Organization filter for AddRepositoryCombobox ('all' or organization login name) */
  organizationFilter: string
}

const initialState: SettingsState = {
  theme: 'sunrise',
  typography: {
    baseSize: 16,
    scale: 1.25,
  },
  compactMode: false,
  showCardMetadata: true,
  organizationFilter: 'all',
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload
    },
    setTypography: (state, action: PayloadAction<TypographySettings>) => {
      state.typography = action.payload
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
    resetSettings: () => initialState,
  },
})

export const {
  setTheme,
  setTypography,
  setCompactMode,
  setShowCardMetadata,
  setOrganizationFilter,
  resetSettings,
} = settingsSlice.actions

export default settingsSlice.reducer

// Selectors
export const selectTheme = (state: { settings: SettingsState }) =>
  state.settings.theme
export const selectTypography = (state: { settings: SettingsState }) =>
  state.settings.typography
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
