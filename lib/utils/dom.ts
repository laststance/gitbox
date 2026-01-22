/**
 * DOM Element Type Guards
 *
 * Type-safe utilities for narrowing unknown DOM elements.
 */

/**
 * Check if an unknown value is an HTMLElement.
 * @param element - The value to check
 * @returns True if element is an HTMLElement
 * @example
 * const el = document.activeElement
 * if (isHTMLElement(el)) {
 *   el.focus() // TypeScript knows el is HTMLElement
 * }
 */
export function isHTMLElement(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement
}

/**
 * Check if an unknown value is an HTMLInputElement.
 * @param element - The value to check
 * @returns True if element is an HTMLInputElement
 * @example
 * const el = document.activeElement
 * if (isHTMLInputElement(el)) {
 *   el.value = 'test' // TypeScript knows el is HTMLInputElement
 * }
 */
export function isHTMLInputElement(
  element: unknown,
): element is HTMLInputElement {
  return element instanceof HTMLInputElement
}

/**
 * Check if an unknown value is an HTMLTextAreaElement.
 * @param element - The value to check
 * @returns True if element is an HTMLTextAreaElement
 * @example
 * const el = document.activeElement
 * if (isHTMLTextAreaElement(el)) {
 *   el.value = 'text' // TypeScript knows el is HTMLTextAreaElement
 * }
 */
export function isHTMLTextAreaElement(
  element: unknown,
): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement
}

/**
 * Check if an unknown value is an HTMLButtonElement.
 * @param element - The value to check
 * @returns True if element is an HTMLButtonElement
 * @example
 * const el = event.target
 * if (isHTMLButtonElement(el)) {
 *   el.disabled = true // TypeScript knows el is HTMLButtonElement
 * }
 */
export function isHTMLButtonElement(
  element: unknown,
): element is HTMLButtonElement {
  return element instanceof HTMLButtonElement
}
