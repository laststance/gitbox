/**
 * Root Layout
 *
 * Application-wide root layout
 * - Redux Provider
 * - Theme application
 * - Global keyboard shortcuts (ShortcutsHelp)
 * - MSW initialization (server-side for SSR, client-side via MSWProvider)
 */

import '@/styles/globals.css'

// Theme file imports - Light themes
import '@/styles/themes/light/sunrise.css'
import '@/styles/themes/light/sandstone.css'
import '@/styles/themes/light/mint.css'
import '@/styles/themes/light/sky.css'
import '@/styles/themes/light/lavender.css'
import '@/styles/themes/light/rose.css'
// Theme file imports - Dark themes
import '@/styles/themes/dark/midnight.css'
import '@/styles/themes/dark/graphite.css'
import '@/styles/themes/dark/forest.css'
import '@/styles/themes/dark/ocean.css'
import '@/styles/themes/dark/plum.css'
import '@/styles/themes/dark/rust.css'

import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { Providers } from '@/lib/redux/providers'
import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'

import { MSWProvider } from './msw-provider'

// Server-side MSW initialization (runs at module load time)
// Uses require() to avoid bundling issues with Next.js SSR
if (process.env.NEXT_RUNTIME === 'nodejs' && isMSWEnabled()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { server } = require('../mocks/server')
  server.listen({ onUnhandledRequest: 'bypass' })
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Manage GitHub repositories in Kanban board format"
        />
        <title>GitBox - GitHub Repository Manager</title>
      </head>
      <body>
        <Providers>
          <MSWProvider>
            {children}
            <ShortcutsHelp />
            <CommandPalette />
            <Toaster richColors position="bottom-right" />
            <Analytics />
          </MSWProvider>
        </Providers>
      </body>
    </html>
  )
}
