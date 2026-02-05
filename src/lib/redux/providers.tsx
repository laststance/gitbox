'use client'

/**
 * Redux Providers
 *
 * Client Component wrapper for Redux Provider
 * Next.js 13+ App Router requires Provider to be in a Client Component
 *
 * Monitors Supabase session and synchronizes with Redux
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect, memo } from 'react'
import { Provider } from 'react-redux'

import { supabase } from '@/lib/supabase/client'

import { setUser, setLoading } from './slices/authSlice'
import { store } from './store'

/**
 * Component that monitors Supabase session and synchronizes with Redux
 */
const AuthSync = memo(function AuthSync({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  useEffect(() => {
    // Get initial user (use getUser() instead of getSession() for security)
    // getSession() reads from cookies without verification, getUser() validates with Auth server
    const initSession = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (error) {
          Sentry.captureException(error, {
            extra: { context: 'Get Supabase user' },
          })
          store.dispatch(setLoading(false))
          return
        }

        if (user) {
          store.dispatch(setUser(user))
          store.dispatch(setLoading(false))
        } else {
          store.dispatch(setLoading(false))
        }
      } catch (err) {
        Sentry.captureException(err, {
          extra: { context: 'User initialization' },
        })
        store.dispatch(setLoading(false))
      }
    }

    initSession()

    // Monitor auth state changes
    // Note: session from onAuthStateChange is from cookies, use session.user for UI sync only
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        store.dispatch(setUser(session.user))
      } else {
        store.dispatch(setUser(null))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return children
})

export const Providers = memo(function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Provider store={store}>
      <AuthSync>{children}</AuthSync>
    </Provider>
  )
})
