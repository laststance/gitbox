/**
 * Settings Page
 *
 * PRD: Settings screen
 * - Theme selection (12 themes)
 * - Typography settings
 * - Display settings
 * - WIP settings
 */

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { SettingsClient } from './SettingsClient'

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
