/**
 * Root Layout
 *
 * Application-wide root layout
 * - Navigation progress bar (NextTopLoader) - Algora-style green bar
 * - Redux Provider
 * - Global keyboard shortcuts (ShortcutsHelp)
 * - MSW initialization (server-side for SSR, client-side via MSWProvider)
 *
 * Note: Theme is applied in authenticated route layouts only.
 * Landing page uses default shadcn/ui light theme.
 */

import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from 'sonner'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { ReduxProvider } from '@/lib/redux/reduxProvider'
import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'
import '@/styles/globals.css'

import { MSWProvider } from './msw-provider'

/**
 * Metadata Configuration
 *
 * Defines SEO, Open Graph, and Twitter Card metadata.
 * Icons (favicon, apple-icon) and OG images are handled by
 * convention-based files: icon.svg, apple-icon.tsx, opengraph-image.tsx
 */
export const metadata: Metadata = {
  title: {
    default: 'GitBox - GitHub Repository Manager',
    template: '%s | GitBox',
  },
  description: 'Manage GitHub repositories in Kanban board format',
  applicationName: 'GitBox',
  authors: [{ name: 'Laststance.io', url: 'https://github.com/laststance' }],
  creator: 'Laststance.io',
  publisher: 'Laststance.io',
  keywords: [
    'GitHub',
    'Kanban',
    'Repository',
    'Project Management',
    'Developer Tools',
  ],
  metadataBase: new URL('https://gitbox-laststance.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'GitBox',
    title: 'GitBox - GitHub Repository Manager',
    description: 'Manage GitHub repositories in Kanban board format',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitBox - GitHub Repository Manager',
    description: 'Manage GitHub repositories in Kanban board format',
    creator: '@because0and1',
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
}

// Server-side MSW initialization (runs at module load time)
// Uses require() to avoid bundling issues with Next.js SSR
if (process.env.NEXT_RUNTIME === 'nodejs' && isMSWEnabled()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { server } = require('../../mocks/server')
  server.listen({ onUnhandledRequest: 'bypass' })
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body>
        <NextTopLoader
          color="oklch(0.696 0.17 162.48)"
          height={3}
          showSpinner={false}
          crawl={true}
          speed={200}
          shadow="0 0 10px oklch(0.696 0.17 162.48), 0 0 5px oklch(0.696 0.17 162.48)"
          zIndex={9999}
        />
        <ReduxProvider>
          <MSWProvider>
            {children}
            <ShortcutsHelp />
            <CommandPalette />
            <Toaster richColors position="bottom-right" />
            <Analytics />
          </MSWProvider>
        </ReduxProvider>
      </body>
    </html>
  )
}
