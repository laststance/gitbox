/**
 * Settings Slice
 *
 * ユーザー設定の管理（LocalStorage と同期）
 * - テーマ
 * - 言語
 * - タイポグラフィ
 * - WIP 制限
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Theme } from '@/lib/supabase/types'

export type Locale = 'en' | 'ja'

interface TypographySettings {
  baseSize: number // 14-18px
  scale: number // 1.2-1.4
}

interface SettingsState {
  theme: Theme
  locale: Locale
  typography: TypographySettings
  compactMode: boolean
  showArchived: boolean
}

const initialState: SettingsState = {
  theme: 'sunrise',
  locale: 'ja',
  typography: {
    baseSize: 16,
    scale: 1.25,
  },
  compactMode: false,
  showArchived: false,
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload
    },
    setLocale: (state, action: PayloadAction<Locale>) => {
      state.locale = action.payload
    },
    setTypography: (state, action: PayloadAction<TypographySettings>) => {
      state.typography = action.payload
    },
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload
    },
    setShowArchived: (state, action: PayloadAction<boolean>) => {
      state.showArchived = action.payload
    },
    resetSettings: () => initialState,
  },
})

export const {
  setTheme,
  setLocale,
  setTypography,
  setCompactMode,
  setShowArchived,
  resetSettings,
} = settingsSlice.actions

export default settingsSlice.reducer

// Selectors
export const selectTheme = (state: { settings: SettingsState }) =>
  state.settings.theme
export const selectLocale = (state: { settings: SettingsState }) =>
  state.settings.locale
export const selectTypography = (state: { settings: SettingsState }) =>
  state.settings.typography
export const selectCompactMode = (state: { settings: SettingsState }) =>
  state.settings.compactMode
export const selectShowArchived = (state: { settings: SettingsState }) =>
  state.settings.showArchived
