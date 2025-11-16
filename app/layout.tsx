/**
 * Root Layout
 *
 * Application-wide root layout
 * - Redux Provider
 * - Theme application
 */

import '@/styles/globals.css'

// Theme file imports
import '@/styles/themes/light/sunrise.css'
import '@/styles/themes/dark/midnight.css'
// Import other theme files here

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Manage GitHub Repositories in Kanban Board Format" />
        <title>Vibe Rush - GitHub Repository Manager</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
