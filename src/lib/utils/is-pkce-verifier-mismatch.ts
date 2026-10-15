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
 * @param message - `error.message` from the code exchange.
 * @returns `true` when the message is a verifier or flow-state mismatch.
 * @example
 * isPkceVerifierMismatch(
 *   'code challenge does not match previously saved code verifier',
 * )
 */
export function isPkceVerifierMismatch(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('code verifier') ||
    normalized.includes('code_verifier') ||
    normalized.includes('code challenge') ||
    normalized.includes('invalid flow state')
  )
}
