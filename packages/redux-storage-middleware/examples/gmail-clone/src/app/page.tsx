'use client'

import GmailLayout from '@/components/gmail/GmailLayout'

/**
 * Gmail Clone Demo App
 *
 * Showcases redux-storage-middleware with:
 * - 1000+ email localStorage persistence
 * - SSR-safe hydration
 * - Debounced writes (500ms)
 * - requestIdleCallback optimization
 */
export default function Home() {
  return <GmailLayout />
}
