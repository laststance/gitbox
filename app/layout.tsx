/**
 * Root Layout
 *
 * Application-wide root layout
 * - Redux Provider
 * - Theme application
 * - Global keyboard shortcuts (ShortcutsHelp)
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

import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { ServiceWorkerRegister } from '@/components/PWA/ServiceWorkerRegister'
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
        
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GitBox" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        <Providers>
          {children}
          <ShortcutsHelp />
          <CommandPalette />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  )
}
