/**
 * Auth Slice Tests
 *
 * T028.4 (Part 1/3): Unit test for authSlice
 * - Actions のテスト
 * - Reducers のテスト
 * - Selectors のテスト
 */

import { describe, it, expect } from 'vitest'
import authReducer, {
  setUser,
  setSession,
  setLoading,
  setError,
  clearAuth,
  selectUser,
  selectSession,
  selectAuthLoading,
  selectAuthError,
  selectIsAuthenticated,
} from '@/lib/redux/slices/authSlice'
import type { User, Session } from '@supabase/supabase-js'

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
}

const mockSession: Session = {
  user: mockUser,
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: Date.now() + 3600000,
  token_type: 'bearer',
}

describe('Auth Slice (lib/redux/slices/authSlice.ts)', () => {
  const initialState = {
    user: null,
    session: null,
    loading: true,
    error: null,
  }

  describe('Reducers', () => {
    it('should return initial state', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState)
    })

    it('should handle setUser', () => {
      const state = authReducer(initialState, setUser(mockUser))

      expect(state.user).toEqual(mockUser)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should handle setUser with null', () => {
      const stateWithUser = { ...initialState, user: mockUser }
      const state = authReducer(stateWithUser, setUser(null))

      expect(state.user).toBeNull()
    })

    it('should handle setSession', () => {
      const state = authReducer(initialState, setSession(mockSession))

      expect(state.session).toEqual(mockSession)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should handle setSession with null', () => {
      const stateWithSession = { ...initialState, session: mockSession }
      const state = authReducer(stateWithSession, setSession(null))

      expect(state.session).toBeNull()
    })

    it('should handle setLoading', () => {
      const state = authReducer(initialState, setLoading(false))

      expect(state.loading).toBe(false)
    })

    it('should handle setError', () => {
      const errorMessage = 'Authentication failed'
      const state = authReducer(initialState, setError(errorMessage))

      expect(state.error).toBe(errorMessage)
      expect(state.loading).toBe(false)
    })

    it('should handle clearAuth', () => {
      const authenticatedState = {
        user: mockUser,
        session: mockSession,
        loading: false,
        error: 'Some error',
      }

      const state = authReducer(authenticatedState, clearAuth())

      // clearAuth sets loading to false, not true
      expect(state.user).toBeNull()
      expect(state.session).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('Selectors', () => {
    const mockState = {
      auth: {
        user: mockUser,
        session: mockSession,
        loading: false,
        error: null,
      },
    }

    it('selectUser should return user', () => {
      expect(selectUser(mockState)).toEqual(mockUser)
    })

    it('selectSession should return session', () => {
      expect(selectSession(mockState)).toEqual(mockSession)
    })

    it('selectAuthLoading should return loading state', () => {
      expect(selectAuthLoading(mockState)).toBe(false)
    })

    it('selectAuthError should return error', () => {
      expect(selectAuthError(mockState)).toBeNull()
    })

    it('selectIsAuthenticated should return true when authenticated', () => {
      expect(selectIsAuthenticated(mockState)).toBe(true)
    })

    it('selectIsAuthenticated should return false when user is null', () => {
      const unauthenticatedState = {
        auth: { ...mockState.auth, user: null },
      }

      expect(selectIsAuthenticated(unauthenticatedState)).toBe(false)
    })

    it('selectIsAuthenticated should return false when session is null', () => {
      const unauthenticatedState = {
        auth: { ...mockState.auth, session: null },
      }

      expect(selectIsAuthenticated(unauthenticatedState)).toBe(false)
    })
  })

  describe('Action Creators', () => {
    it('setUser should create action with user payload', () => {
      const action = setUser(mockUser)

      expect(action.type).toBe('auth/setUser')
      expect(action.payload).toEqual(mockUser)
    })

    it('setSession should create action with session payload', () => {
      const action = setSession(mockSession)

      expect(action.type).toBe('auth/setSession')
      expect(action.payload).toEqual(mockSession)
    })

    it('setLoading should create action with boolean payload', () => {
      const action = setLoading(true)

      expect(action.type).toBe('auth/setLoading')
      expect(action.payload).toBe(true)
    })

    it('setError should create action with error message', () => {
      const action = setError('Error message')

      expect(action.type).toBe('auth/setError')
      expect(action.payload).toBe('Error message')
    })

    it('clearAuth should create action with no payload', () => {
      const action = clearAuth()

      expect(action.type).toBe('auth/clearAuth')
      expect(action.payload).toBeUndefined()
    })
  })
})
