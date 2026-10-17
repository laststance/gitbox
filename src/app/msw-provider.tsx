/**
 * MSW Provider Component
 *
 * The server HTML holds the page, so a browser test can see a hydration
 * error. The browser worker starts from `src/instrumentation-client.ts`.
 * With the mock on, a wrapper hides the page until hydration: the buttons
 * are already in the HTML, and a press before hydration reached nothing.
 * The wrapper generates no box, so a measurement taken while it is still
 * there matches the page, and it is removed before the next paint.
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
 * hidden wrapper matches. {@link useMounted} cannot gate this: its client
 * snapshot is already true while React hydrates, and the server's copy
 * stays in the document.
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
  // After hydration the page is the children alone, as it is with the
  // mock off. A wrapper that stays makes a press miss the control.
  if (!mockOn || hydrated) return children
  // contents: the wrapper hides the page and does not move it. A box
  // here shifted "Create Board" by 16px for a measurement that ran
  // before hydration. The element is gone before the next paint, so a
  // press is not aimed through display:contents.
  return <div className="invisible contents">{children}</div>
}

export const MSWProvider = memo(
  MSWProviderComponent,
  areServerRenderedPropsEqual,
)
