'use client'

/**
 * Redux Providers
 *
 * Client Component wrapper for Redux Provider
 * Next.js 13+ App Router requires Provider to be in a Client Component
 *
 * Monitors Supabase session and synchronizes with Redux
 */

import { useEffect, memo } from 'react'
import { Provider } from 'react-redux'

import { I18nProvider } from '@/lib/i18n'
import { supabase } from '@/lib/supabase/client'

import { setSession, setUser, setLoading } from './slices/authSlice'
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
    // Get initial session
    const initSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) {
          console.error('Failed to get session:', error)
          store.dispatch(setLoading(false))
          return
        }

        if (session) {
          store.dispatch(setSession(session))
          store.dispatch(setUser(session.user))
        } else {
          store.dispatch(setLoading(false))
        }
      } catch (err) {
        console.error('Session init error:', err)
        store.dispatch(setLoading(false))
      }
    }

    initSession()

    // Monitor session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        store.dispatch(setSession(session))
        store.dispatch(setUser(session.user))
      } else {
        store.dispatch(setSession(null))
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
      <I18nProvider>
        <AuthSync>{children}</AuthSync>
      </I18nProvider>
    </Provider>
  )
})
