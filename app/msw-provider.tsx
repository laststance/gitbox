/**
 * MSW Provider Component
 *
 * Client component that initializes Mock Service Worker before rendering children.
 * Uses useLayoutEffect to ensure MSW is ready before any fetch requests.
 *
 * @description
 * - Blocks rendering until MSW is initialized (prevents race conditions)
 * - Dynamically imports mocks/browser.ts only when needed
 * - Shows loading state during initialization
 * - Gracefully handles initialization failures
 *
 * @see https://mswjs.io/docs/integrations/react
 */
'use client'

import { memo, useLayoutEffect, useState } from 'react'

import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'

type MSWProviderProps = Readonly<{
  children: React.ReactNode
}>

/**
 * Wraps children with MSW initialization logic
 *
 * @param children - React children to render after MSW is ready
 * @returns Children after MSW initialization, or loading state during init
 *
 * @example
 * // In layout.tsx:
 * <MSWProvider>{children}</MSWProvider>
 */
function MSWProviderComponent({ children }: MSWProviderProps): React.ReactNode {
  const [isMSWReady, setIsMSWReady] = useState(false)

  useLayoutEffect(() => {
    const enabled = isMSWEnabled()

    // If MSW is not enabled or we're not in the browser, skip initialization
    if (!enabled || typeof window === 'undefined') {
      setIsMSWReady(true)
      return
    }

    // Dynamically import browser worker to avoid bundling in production
    import('../mocks/browser')
      .then(async ({ worker }) => {
        try {
          await worker.start({
            // 'bypass' allows unhandled requests to pass through to the network
            // Change to 'warn' or 'error' to debug missing handlers
            onUnhandledRequest: 'bypass',
          })
          setIsMSWReady(true)
        } catch {
          // Worker failed to start, but we should still render the app
          // This can happen if Service Worker is not supported
          setIsMSWReady(true)
        }
      })
      .catch(() => {
        // Import failed, but we should still render the app
        setIsMSWReady(true)
      })
  }, [])

  // Block rendering until MSW is ready to prevent race conditions
  // where fetch requests are made before MSW can intercept them
  if (isMSWEnabled() && !isMSWReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Initializing MSW...</p>
      </div>
    )
  }

  return children
}

export const MSWProvider = memo(MSWProviderComponent)
