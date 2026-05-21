import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

import { getCachedClaims } from './get-cached-claims'

/**
 * Server Component / Server Action auth gate backed by JWT claims.
 *
 * Wraps `getCachedClaims()` and short-circuits to `/login` (or a caller-
 * provided destination) when there is no valid session. Use this in place of
 * `requireUser()` anywhere the calling code only needs the user UUID
 * (`claims.sub`) and not the full Supabase `User` row — which is most of
 * GitBox's server code.
 *
 * Falls back to `requireUser()` in `account/page.tsx`, which still needs
 * `created_at` from the User object.
 *
 * @param redirectTo - Path to redirect to when unauthenticated. Defaults to `/login`.
 * @returns `{ supabase, claims }` for use in the calling Server Component.
 *
 * @example
 * ```ts
 * export default async function BoardsPage() {
 *   const { supabase, claims } = await requireClaims()
 *   const { data } = await supabase
 *     .from('board')
 *     .select('*')
 *     .eq('user_id', claims.sub)
 *   // ...
 * }
 * ```
 */
export async function requireClaims(redirectTo: string = ROUTES.LOGIN) {
  const result = await getCachedClaims()
  if (!result) redirect(redirectTo)
  return result
}
