import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'

/**
 * Server Component auth guard. Redirects when no authenticated user.
 *
 * IMPORTANT: Uses getUser() (Auth server-validated), not getSession()
 * (unvalidated cookie read).
 */
export async function requireUser(redirectTo: string = ROUTES.LOGIN) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(redirectTo)
  return { supabase, user }
}
