/**
 * Settings Page
 *
 * PRD: Settings画面
 * - Theme選択 (12テーマ)
 * - Typography設定
 * - Display設定
 * - WIP設定
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
