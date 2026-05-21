import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

/**
 * Standard JWT claims returned by `supabase.auth.getClaims()`.
 *
 * Mirrors the relevant subset of `@supabase/auth-js` JwtPayload, narrowed to the
 * fields GitBox actually reads on the server. `sub` (user UUID) is the new
 * source of truth for what was previously `user.id`.
 */
export interface SupabaseClaims {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  role: string
  email?: string
  phone?: string
  session_id?: string
  is_anonymous?: boolean
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

/**
 * Request-scoped, cached fetch of the current Supabase JWT claims.
 *
 * Uses React.cache so multiple callers within the same Server Component
 * tree (proxy → page → layout → server action) share a single `getClaims()`
 * round-trip. With asymmetric signing keys this is a local WebCrypto verify
 * (~5ms) against the JWKS endpoint — orders of magnitude faster than the
 * ~300ms `getUser()` round-trip.
 *
 * A defensive `exp` check is layered on top of the SDK's own expiry
 * validation. The SDK rejects expired tokens by default, but a manual
 * `Date.now() / 1000 > claims.exp` guard protects against clock skew and
 * any edge case where the SDK validation is bypassed.
 *
 * @returns A `{ supabase, claims }` tuple when the JWT is present and valid,
 *   or `null` when the request is unauthenticated or the token has expired.
 *
 * @example
 * ```ts
 * const result = await getCachedClaims()
 * if (!result) redirect('/login')
 * const { supabase, claims } = result
 * const { data } = await supabase.from('board').select().eq('user_id', claims.sub)
 * ```
 */
export const getCachedClaims = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  // No session, network failure, or expired token — treat as unauthenticated.
  if (error || !data?.claims) return null

  const claims = data.claims as SupabaseClaims

  // Defensive expiry check on top of SDK validation: fail closed if exp is
  // missing, non-numeric, or already past (handles clock skew + malformed JWT).
  const nowInSeconds = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || nowInSeconds > claims.exp) return null

  return { supabase, claims }
})
