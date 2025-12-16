/**
 * Auth Slice
 *
 * 認証状態の管理
 * - ユーザー情報
 * - セッション状態
 * - ロード状態
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  session: null,
  loading: true,
  error: null,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload
      state.loading = false
      state.error = null
    },
    setSession: (state, action: PayloadAction<Session | null>) => {
      state.session = action.payload
      state.loading = false
      state.error = null
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.loading = false
    },
    clearAuth: state => {
      state.user = null
      state.session = null
      state.loading = false
      state.error = null
    },
  },
})

export const { setUser, setSession, setLoading, setError, clearAuth } =
  authSlice.actions

export default authSlice.reducer

// Selectors
export const selectUser = (state: { auth: AuthState }) => state.auth.user
export const selectSession = (state: { auth: AuthState }) => state.auth.session
export const selectAuthLoading = (state: { auth: AuthState }) =>
  state.auth.loading
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  !!state.auth.user && !!state.auth.session
