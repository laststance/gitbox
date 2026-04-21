/**
 * Settings Page
 *
 * PRD: Settings screen
 * - Theme selection (14 themes)
 * - Display settings
 */

import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/require-user'

import { SettingsClient } from './SettingsClient'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Customize your GitBox experience',
}

export default async function SettingsPage() {
  await requireUser()
  return <SettingsClient />
}
