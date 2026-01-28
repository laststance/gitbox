/**
 * Maintenance Layout
 *
 * Layout for /maintenance route
 * - Theme application for authenticated users
 */

import { redirect } from 'next/navigation'

import { ThemeApplicator } from '@/components/ThemeApplicator'
import { createClient } from '@/lib/supabase/server'

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <ThemeApplicator />
      {children}
    </>
  )
}
