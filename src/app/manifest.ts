/**
 * Web App Manifest
 *
 * PWA configuration for GitBox.
 * Enables "Add to Home Screen" functionality and PWA features.
 */

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GitBox',
    short_name: 'GitBox',
    description: 'Manage GitHub repositories in Kanban format',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1f2328',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
