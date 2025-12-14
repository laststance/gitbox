/**
 * Root Layout
 *
 * Application-wide root layout
 * - Redux Provider
 * - Theme application
 * - Global keyboard shortcuts (ShortcutsHelp)
 */

import '@/styles/globals.css'

// Theme file imports
import '@/styles/themes/light/sunrise.css'
import '@/styles/themes/dark/midnight.css'
// Import other theme files here

import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { Providers } from '@/lib/redux/providers'

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
        <meta name="description" content="GitHub Repositoryを Kanban Board 形式で管理" />
        <title>GitBox - GitHub Repository Manager</title>
      </head>
      <body>
        <Providers>
          {children}
          <ShortcutsHelp />
        </Providers>
      </body>
    </html>
  )
}
