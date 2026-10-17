/**
 * MSW Provider Component
 *
 * The server HTML holds the page, so a browser test can see a hydration
 * error. The browser worker starts from `src/instrumentation-client.ts`.
 * With the mock on, the same wrapper stays invisible until hydration: the
 * buttons are already in the HTML, and a press before hydration reached
 * nothing. The wrapper is not removed, or a mismatch leaves a second copy.
 *
 * @see https://mswjs.io/docs/integrations/react
 */
'use client'

import { memo, useLayoutEffect, useState } from 'react'

import { env } from '@/lib/env'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'

type MSWProviderProps = Readonly<{
  children: React.ReactNode
}>

/**
 * Renders the page, hidden until hydration when the mock worker is on.
 *
 * The public flag is the same on the server and in the browser, so the
 * wrapper matches. It stays hidden through hydration and is shown after,
 * which is when a test can press a button.
 *
 * @param children - The page the server rendered.
 * @returns The page, invisible until hydration when the mock is on.
 *
 * @example
 * // In layout.tsx:
 * <MSWProvider>{children}</MSWProvider>
 */
function MSWProviderComponent({ children }: MSWProviderProps): React.ReactNode {
  const mockOn = env.NEXT_PUBLIC_ENABLE_MSW_MOCK === true
  // False on the server and on the first client render, so the wrapper
  // matches. The effect runs after hydration.
  const [hydrated, setHydrated] = useState(false)
  useLayoutEffect(() => {
    if (!mockOn) return
    setHydrated(true)
  }, [mockOn])
  if (!mockOn) return children
  // The wrapper stays a real box. display:contents makes elementFromPoint
  // miss the control, so a press never reaches it. Removing the element
  // instead left the server's copy behind.
  return <div className={hydrated ? undefined : 'invisible'}>{children}</div>
}

export const MSWProvider = memo(
  MSWProviderComponent,
  areServerRenderedPropsEqual,
)
