/**
 * MSW Provider Component
 *
 * The server HTML holds the page, so a browser test can see a hydration
 * error. The browser worker starts from `src/instrumentation-client.ts`.
 * With the mock on, the page stays invisible until hydration: the buttons
 * are already in the HTML, and a press before hydration reached nothing.
 *
 * @see https://mswjs.io/docs/integrations/react
 */
'use client'

import { memo } from 'react'

import { useMounted } from '@/hooks/use-mounted'
import { env } from '@/lib/env'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'

type MSWProviderProps = Readonly<{
  children: React.ReactNode
}>

/**
 * Renders the page, hidden until hydration when the mock worker is on.
 *
 * The public flag is the same on the server and in the browser, so the
 * hidden wrapper matches. {@link useMounted} stays false through hydration
 * and becomes true after it, which is when a test can press a button.
 *
 * @param children - The page the server rendered.
 * @returns The page, invisible until hydration when the mock is on.
 *
 * @example
 * // In layout.tsx:
 * <MSWProvider>{children}</MSWProvider>
 */
function MSWProviderComponent({ children }: MSWProviderProps): React.ReactNode {
  const mounted = useMounted()
  // The buttons are in the HTML either way. Hiding them until hydration
  // keeps a press off a control that does not have its handler yet.
  if (env.NEXT_PUBLIC_ENABLE_MSW_MOCK === true && !mounted) {
    return <div className="invisible">{children}</div>
  }
  return children
}

export const MSWProvider = memo(
  MSWProviderComponent,
  areServerRenderedPropsEqual,
)
