/**
 * MSW Provider Component
 *
 * Renders the page on the server and on the first client render. The browser
 * worker is started from `src/instrumentation-client.ts` before hydration,
 * which also holds fetch and XMLHttpRequest until the worker can answer.
 * Withholding the page here left the server HTML as "Initializing MSW...",
 * so a browser test hydrated that placeholder and could not see a hydration
 * error.
 *
 * @see https://mswjs.io/docs/integrations/react
 */
'use client'

import { memo } from 'react'

import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'

type MSWProviderProps = Readonly<{
  children: React.ReactNode
}>

/**
 * Passes the page through so the server HTML and the first client render match.
 *
 * @param children - The page the server rendered.
 * @returns The same page, on the server and in the browser.
 *
 * @example
 * // In layout.tsx:
 * <MSWProvider>{children}</MSWProvider>
 */
function MSWProviderComponent({ children }: MSWProviderProps): React.ReactNode {
  return children
}

export const MSWProvider = memo(
  MSWProviderComponent,
  areServerRenderedPropsEqual,
)
