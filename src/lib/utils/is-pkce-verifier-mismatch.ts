/**
 * Tells a PKCE collision apart from any other failed code exchange.
 *
 * Two tabs that start GitHub sign-in share one code-verifier cookie. The
 * slower tab's `/auth/callback` then fails, because the verifier it sends
 * belongs to the other tab. That failure can be retried: a new sign-in
 * writes a new verifier. A reused or expired code cannot, and still has
 * to be shown as a failed sign-in.
 *
 * Called by the OAuth callback when `exchangeCodeForSession` returns an error.
 *
 * A bare `invalid grant` is an expired or reused code: GoTrue says so with
 * that text and no verifier code. A collision that surfaces as `invalid
 * grant` still carries `bad_code_verifier` (or names the verifier in the
 * message). Those restart; the bare grant does not.
 *
 * @param error - The code-exchange error. `code` is GoTrue's `error_code`.
 * @returns `true` when this failure is a verifier or flow-state mismatch.
 * @example
 * isPkceVerifierMismatch({
 *   message: 'invalid grant',
 *   code: 'bad_code_verifier',
 * })
 */
export function isPkceVerifierMismatch(error: {
  message: string
  code?: string
}): boolean {
  const code = error.code?.toLowerCase()
  // These codes are the collision even when the message is only "invalid grant".
  if (
    code === 'bad_code_verifier' ||
    code === 'flow_state_not_found' ||
    code === 'flow_state_expired'
  ) {
    return true
  }
  const normalized = error.message.toLowerCase()
  return (
    normalized.includes('code verifier') ||
    normalized.includes('code_verifier') ||
    normalized.includes('code challenge') ||
    normalized.includes('invalid flow state')
  )
}
