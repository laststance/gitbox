import type { SupabaseClaims } from '@/lib/auth/get-cached-claims'

interface ClaimsDisplayInfo {
  userName: string
  userAvatar: string | undefined
}

/**
 * Extracts display-safe header info (name, avatar URL) from Supabase JWT claims.
 *
 * Used by the board layout so the header chrome can render without paying for
 * the ~50ms `auth.getUser()` GoTrue round-trip — `requireClaims()` verifies the
 * JWT locally in ~5ms and this helper pulls the metadata fields needed for the
 * sidebar. `user_metadata` is typed as `Record<string, unknown>` on the claim,
 * so each field is narrowed at runtime before use.
 *
 * @param claims - Decoded Supabase JWT claims returned by `getCachedClaims`.
 * @returns
 * - `userName`: `user_metadata.full_name` (when string), else `claims.email`, else literal `'User'`
 * - `userAvatar`: `user_metadata.avatar_url` (when string), else `undefined`
 *
 * @example
 * getClaimsDisplayInfo({
 *   sub: '00000000-0000-0000-0000-000000000001',
 *   email: 'alice@example.com',
 *   user_metadata: { full_name: 'Alice', avatar_url: 'https://cdn/x.png' },
 *   // ...rest of SupabaseClaims
 * } as SupabaseClaims)
 * // => { userName: 'Alice', userAvatar: 'https://cdn/x.png' }
 *
 * @example
 * // Missing user_metadata.full_name → falls back to email
 * getClaimsDisplayInfo({ email: 'bob@example.com', user_metadata: {} } as SupabaseClaims)
 * // => { userName: 'bob@example.com', userAvatar: undefined }
 */
export function getClaimsDisplayInfo(
  claims: SupabaseClaims,
): ClaimsDisplayInfo {
  const fullNameClaim = claims.user_metadata?.full_name
  const avatarClaim = claims.user_metadata?.avatar_url

  const fullName = typeof fullNameClaim === 'string' ? fullNameClaim : null
  const userAvatar = typeof avatarClaim === 'string' ? avatarClaim : undefined

  return {
    userName: fullName || claims.email || 'User',
    userAvatar,
  }
}
