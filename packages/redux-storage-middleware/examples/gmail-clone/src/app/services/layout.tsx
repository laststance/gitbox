import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Google Services Demo - redux-storage-middleware',
  description:
    'Demo services for testing localStorage persistence across navigation',
}

/**
 * Services Layout
 *
 * Wraps all service pages without the Redux provider to test
 * that localStorage persistence works across page navigation.
 * The Redux store is already provided in the root layout.
 */
export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
