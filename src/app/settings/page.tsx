/**
 * Settings Page
 *
 * PRD: Settings screen
 * - Theme selection (14 themes)
 * - Typography settings
 * - Display settings
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { SettingsClient } from './SettingsClient'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Customize your GitBox experience',
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <SettingsClient />
}
