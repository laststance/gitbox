/**
 * Standardized Server Action Result Types
 *
 * Provides a discriminated union type for Server Action return values,
 * replacing the mix of throw-based and ad-hoc result patterns.
 *
 * Pattern:
 * - Client-consumed Server Actions → return ActionResult<T>
 * - Internal helpers / server-component-only functions → may still throw
 *
 * @see https://github.com/laststance/gitbox/issues/68
 *
 * @example
 * // Server Action
 * export async function createItem(name: string): Promise<ActionResult<Item>> {
 *   try {
 *     const item = await db.items.create({ name })
 *     return { success: true, data: item }
 *   } catch (error) {
 *     return { success: false, error: 'Failed to create item' }
 *   }
 * }
 *
 * // Client caller
 * const result = await createItem('foo')
 * if (result.success) {
 *   console.log(result.data) // Item (narrowed)
 * } else {
 *   toast.error(result.error) // string (narrowed)
 * }
 */

/**
 * Machine-readable error codes for Server Action failures.
 *
 * Use sparingly — only add a code when the client needs to branch on it
 * (e.g., trigger silent re-auth on `GITHUB_TOKEN_MISSING`). The human-readable
 * `error` field remains the source of UI copy.
 *
 * @example
 * if (!result.success && result.errorCode === 'GITHUB_TOKEN_MISSING') {
 *   handleGitHubTokenMissing(window.location.pathname)
 * }
 */
export type ActionErrorCode = 'GITHUB_TOKEN_MISSING'

/**
 * Discriminated union for Server Action results.
 *
 * @param T - The data type on success
 * @returns Either `{ success: true, data: T }` or `{ success: false, error: string, errorCode?: ActionErrorCode }`
 *
 * @example
 * type Result = ActionResult<User[]>
 * // => { success: true; data: User[] } | { success: false; error: string; errorCode?: ActionErrorCode }
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode?: ActionErrorCode }
