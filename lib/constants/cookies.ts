/**
 * Cookie Name Constants
 *
 * Environment-specific cookie names to prevent conflicts
 * when running dev and prod environments on localhost.
 */

/**
 * Get environment-specific GitHub token cookie name
 *
 * Uses Supabase project ID (first 8 chars) to differentiate between environments.
 * This prevents cookie conflicts when switching between dev/prod on localhost.
 *
 * @returns Cookie name like "gh_token_jqtxjzdx" (dev) or "gh_token_mfeesjmt" (prod)
 * @example
 * // Dev: https://jqtxjzdxczqwsrvevmyk.supabase.co
 * getGitHubTokenCookieName() // => "gh_token_jqtxjzdx"
 *
 * // Prod: https://mfeesjmtofgayktirswf.supabase.co
 * getGitHubTokenCookieName() // => "gh_token_mfeesjmt"
 */
export function getGitHubTokenCookieName(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Extract project ID from URL: https://PROJECT_ID.supabase.co
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  const projectId = match?.[1]?.slice(0, 8) || 'default'
  return `gh_token_${projectId}`
}
