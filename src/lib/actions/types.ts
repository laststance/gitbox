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
 * Discriminated union for Server Action results.
 *
 * @param T - The data type on success
 * @returns Either `{ success: true, data: T }` or `{ success: false, error: string }`
 *
 * @example
 * type Result = ActionResult<User[]>
 * // => { success: true; data: User[] } | { success: false; error: string }
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
